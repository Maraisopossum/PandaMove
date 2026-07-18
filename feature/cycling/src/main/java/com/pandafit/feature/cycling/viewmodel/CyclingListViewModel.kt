package com.pandafit.feature.cycling.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.dao.GpsTrackPointDao
import com.pandafit.core.database.dao.WorkoutBlockDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.feature.cycling.model.CyclingListUiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime
import javax.inject.Inject

@HiltViewModel
class CyclingListViewModel @Inject constructor(
    private val workoutDao: WorkoutDao,
    private val blockDao: WorkoutBlockDao,
    private val gpsDao: GpsTrackPointDao,
) : ViewModel() {

    private val _uiState = MutableStateFlow(CyclingListUiState())
    val uiState: StateFlow<CyclingListUiState> = _uiState.asStateFlow()

    init { observeWorkouts() }

    private fun observeWorkouts() {
        viewModelScope.launch {
            combine(
                workoutDao.observeTemplatesByType(WorkoutType.CYCLING),
                workoutDao.observePlannedByType(WorkoutType.CYCLING),
                workoutDao.observeCompletedByType(WorkoutType.CYCLING),
            ) { templates, planned, completed ->
                Triple(templates, planned, completed)
            }
            .map { (templates, planned, completed) ->
                val thumbnails = if (completed.isEmpty()) emptyMap() else {
                    gpsDao.getByWorkoutIds(completed.map { it.id })
                        .groupBy({ it.workoutId }, { Pair(it.latitude, it.longitude) })
                }
                CyclingListUiState(isLoading = false, templates = templates, planned = planned, completed = completed, routeThumbnails = thumbnails)
            }
            .catch { e -> _uiState.value = _uiState.value.copy(isLoading = false, error = e.message) }
            // Préserver quickStartWorkoutId : Room peut émettre entre l'insert et la mise à jour de l'état
            .collect { newState -> _uiState.value = newState.copy(quickStartWorkoutId = _uiState.value.quickStartWorkoutId) }
        }
    }

    fun deleteWorkouts(ids: Set<Long>) {
        viewModelScope.launch { ids.forEach { workoutDao.deleteById(it) } }
    }

    fun assignToDate(templateId: Long, date: LocalDate) {
        viewModelScope.launch { cloneTemplate(templateId, date) }
    }

    fun assignToDates(templateId: Long, dates: Set<LocalDate>) {
        viewModelScope.launch { dates.forEach { cloneTemplate(templateId, it) } }
    }

    fun assignRecurring(templateId: Long, startDate: LocalDate, intervalDays: Int, occurrences: Int) {
        viewModelScope.launch {
            repeat(occurrences) { i ->
                cloneTemplate(templateId, startDate.plusDays((i * intervalDays).toLong()))
            }
        }
    }

    /** Déplace une séance planifiée vers une nouvelle date, sans la recréer. Ignoré si template ou terminée. */
    fun rescheduleWorkout(id: Long, newDate: LocalDate) {
        viewModelScope.launch {
            val w = workoutDao.getById(id) ?: return@launch
            if (!w.isCompleted && !w.isTemplate) workoutDao.update(w.copy(scheduledDate = newDate))
        }
    }

    private suspend fun cloneTemplate(templateId: Long, date: LocalDate) {
        val template = workoutDao.getById(templateId) ?: return
        val now = LocalDateTime.now()
        val newId = workoutDao.insert(
            template.copy(
                id = 0, isTemplate = false, scheduledDate = date,
                isCompleted = false, resultDistanceKm = null, resultDurationSec = null,
                resultPaceAvgMinPerKm = null, resultHrAvg = null, resultHrMax = null,
                resultRpe = null, resultNotes = "", resultElevationM = null,
                createdAt = now, updatedAt = now,
            )
        )
        val blocks = blockDao.getByWorkout(templateId)
        blockDao.insertAll(blocks.map { it.copy(id = 0, workoutId = newId) })
    }

    /**
     * "Séance directe" : navigue vers l'exécution GPS en mode brouillon, sans créer de sortie en
     * base. La séance n'est créée qu'au tap "Démarrer" (voir [CyclingExecuteViewModel]), pour
     * éviter les lignes orphelines si l'utilisateur quitte sans avoir démarré le suivi GPS.
     */
    fun quickStartDirectRide() {
        _uiState.value = _uiState.value.copy(quickStartWorkoutId = 0L)
    }

    fun onQuickStartHandled() {
        _uiState.value = _uiState.value.copy(quickStartWorkoutId = null)
    }

    fun duplicateWorkout(id: Long) {
        viewModelScope.launch {
            val original = workoutDao.getById(id) ?: return@launch
            val now = LocalDateTime.now()
            val newId = workoutDao.insert(
                original.copy(
                    id = 0, name = "${original.name} (copie)", isTemplate = true,
                    isCompleted = false, resultDistanceKm = null, resultDurationSec = null,
                    resultPaceAvgMinPerKm = null, resultHrAvg = null, resultHrMax = null,
                    resultRpe = null, resultNotes = "", resultElevationM = null,
                    createdAt = now, updatedAt = now,
                )
            )
            val blocks = blockDao.getByWorkout(id)
            blockDao.insertAll(blocks.map { it.copy(id = 0, workoutId = newId) })
        }
    }
}
