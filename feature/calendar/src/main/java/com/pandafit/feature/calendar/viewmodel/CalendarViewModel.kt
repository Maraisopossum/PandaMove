package com.pandafit.feature.calendar.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.dao.BreathingSessionDao
import com.pandafit.core.database.dao.InstanceSeanceDao
import com.pandafit.core.database.dao.SeanceDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.InstanceSeanceEntity
import com.pandafit.core.database.entities.SeanceCategory
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.feature.calendar.model.CalendarUiState
import com.pandafit.feature.calendar.model.CalendarViewMode
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.YearMonth
import javax.inject.Inject

@HiltViewModel
class CalendarViewModel @Inject constructor(
    private val workoutDao: WorkoutDao,
    private val instanceSeanceDao: InstanceSeanceDao,
    private val seanceDao: SeanceDao,
    private val breathingSessionDao: BreathingSessionDao,
) : ViewModel() {

    private val _uiState = MutableStateFlow(CalendarUiState())
    val uiState: StateFlow<CalendarUiState> = _uiState.asStateFlow()

    init {
        loadMonth(YearMonth.now())
        // Charge uniquement les séances STRENGTH pour le picker (pas les WARMUP)
        viewModelScope.launch {
            seanceDao.observeByCategory(SeanceCategory.STRENGTH).collect { seances ->
                _uiState.value = _uiState.value.copy(availableSeances = seances)
            }
        }
        // Charge les templates running et vélo pour le picker "+"
        viewModelScope.launch {
            workoutDao.observeTemplatesByType(WorkoutType.RUNNING).collect { workouts ->
                _uiState.value = _uiState.value.copy(availableRunningWorkouts = workouts)
            }
        }
        viewModelScope.launch {
            workoutDao.observeTemplatesByType(WorkoutType.CYCLING).collect { workouts ->
                _uiState.value = _uiState.value.copy(availableCyclingWorkouts = workouts)
            }
        }
    }

    fun loadMonth(month: YearMonth) {
        val startDate = month.atDay(1)
        val endDate = month.atEndOfMonth()

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(currentMonth = month)

            combine(
                workoutDao.observeByDateRange(startDate, endDate),
                instanceSeanceDao.observeByDateRange(startDate, endDate),
                breathingSessionDao.observeByDateRange(startDate, endDate),
            ) { workouts, instances, breathingSessions -> Triple(workouts, instances, breathingSessions) }
                .catch { e -> _uiState.value = _uiState.value.copy(error = e.message) }
                .collect { (workouts, instances, breathingSessions) ->
                    val workoutsByDate = workouts.filter { !it.isTemplate }.groupBy { it.scheduledDate }
                    val instancesByDate = instances.groupBy { it.date }
                    val breathingByDate = breathingSessions.groupBy { it.sessionDate }

                    val seanceIds = instances.map { it.seanceId }.toSet()
                    val seancesById = seanceIds.mapNotNull { id ->
                        seanceDao.getById(id)?.let { id to it }
                    }.toMap()

                    // Exclure les instances liées à des séances WARMUP — elles restent dans leur module dédié
                    val strengthInstancesByDate = instancesByDate.mapValues { (_, inst) ->
                        inst.filter { seancesById[it.seanceId]?.seanceCategory == SeanceCategory.STRENGTH }
                    }.filter { it.value.isNotEmpty() }

                    val selectedDate = _uiState.value.selectedDate
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        workoutsByDate = workoutsByDate,
                        instancesByDate = strengthInstancesByDate,
                        breathingSessionsByDate = breathingByDate,
                        seancesById = seancesById,
                        selectedDayWorkouts = workoutsByDate[selectedDate] ?: emptyList(),
                        selectedDayInstances = strengthInstancesByDate[selectedDate] ?: emptyList(),
                        selectedDayBreathingSessions = breathingByDate[selectedDate] ?: emptyList(),
                    )
                }
        }
    }

    fun selectDate(date: LocalDate) {
        val workouts = _uiState.value.workoutsByDate[date] ?: emptyList()
        val instances = _uiState.value.instancesByDate[date] ?: emptyList()
        val breathingSessions = _uiState.value.breathingSessionsByDate[date] ?: emptyList()
        _uiState.value = _uiState.value.copy(
            selectedDate = date,
            selectedDayWorkouts = workouts,
            selectedDayInstances = instances,
            selectedDayBreathingSessions = breathingSessions,
        )
        val month = YearMonth.of(date.year, date.month)
        if (month != _uiState.value.currentMonth) loadMonth(month)
    }

    fun previousMonth() { loadMonth(_uiState.value.currentMonth.minusMonths(1)) }
    fun nextMonth() { loadMonth(_uiState.value.currentMonth.plusMonths(1)) }

    fun setViewMode(mode: CalendarViewMode) {
        _uiState.value = _uiState.value.copy(viewMode = mode)
    }

    fun toggleFilter(type: WorkoutType) {
        val current = _uiState.value.activeFilters.toMutableSet()
        if (type in current) current.remove(type) else current.add(type)
        _uiState.value = _uiState.value.copy(activeFilters = current)
    }

    fun deleteInstance(instance: InstanceSeanceEntity) {
        viewModelScope.launch { instanceSeanceDao.deleteInstance(instance) }
    }

    fun deleteWorkout(workout: WorkoutEntity) {
        viewModelScope.launch { workoutDao.deleteById(workout.id) }
    }

    fun createInstanceForDate(seanceId: Long, date: LocalDate) {
        viewModelScope.launch {
            instanceSeanceDao.insertInstance(InstanceSeanceEntity(seanceId = seanceId, date = date))
        }
    }

    /** Déplace une instance strength vers une nouvelle date. Ignoré si déjà terminée. */
    fun rescheduleInstance(id: Long, newDate: LocalDate) {
        viewModelScope.launch {
            val instance = instanceSeanceDao.getById(id) ?: return@launch
            if (!instance.isCompleted) instanceSeanceDao.updateInstance(instance.copy(date = newDate))
        }
    }

    /** Déplace une séance running/vélo planifiée vers une nouvelle date. Ignoré si template ou terminée. */
    fun rescheduleWorkout(id: Long, newDate: LocalDate) {
        viewModelScope.launch {
            val w = workoutDao.getById(id) ?: return@launch
            if (!w.isCompleted && !w.isTemplate) workoutDao.update(w.copy(scheduledDate = newDate))
        }
    }

    /** Affecte un template running/vélo à une date en créant une copie planifiée. */
    fun assignWorkoutToDate(templateId: Long, date: LocalDate) {
        viewModelScope.launch {
            val template = workoutDao.getById(templateId) ?: return@launch
            workoutDao.insert(
                template.copy(
                    id = 0,
                    isTemplate = false,
                    scheduledDate = date,
                    isCompleted = false,
                    completedAt = null,
                    resultDistanceKm = null,
                    resultDurationSec = null,
                    resultPaceAvgMinPerKm = null,
                    resultHrAvg = null,
                    resultHrMax = null,
                    resultElevationM = null,
                    resultRpe = null,
                    resultNotes = "",
                )
            )
        }
    }
}
