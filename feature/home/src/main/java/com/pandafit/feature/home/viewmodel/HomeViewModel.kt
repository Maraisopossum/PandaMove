package com.pandafit.feature.home.viewmodel

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.catalog.UserPreferencesRepository
import com.pandafit.core.database.dao.InstanceSeanceDao
import com.pandafit.core.database.dao.SeanceDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.feature.home.model.HomeUiState
import com.pandafit.feature.home.model.WeeklySummary
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.TemporalAdjusters
import javax.inject.Inject

private val Context.homeDataStore: DataStore<Preferences> by preferencesDataStore(name = "pandamove_home_prefs")
private val KEY_SECTION_ORDER = stringPreferencesKey("section_order")
private const val DEFAULT_SECTION_ORDER =
    "panda_running,panda_cycling,panda_strength,panda_calendar,panda_timer,panda_stats,panda_profile"

@HiltViewModel
class HomeViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val userPrefs: UserPreferencesRepository,
    private val workoutDao: WorkoutDao,
    private val instanceSeanceDao: InstanceSeanceDao,
    private val seanceDao: SeanceDao,
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        loadData()
        loadSectionOrder()
        loadUserName()
    }

    private fun loadUserName() {
        viewModelScope.launch {
            userPrefs.userNameFlow.collect { name ->
                _uiState.value = _uiState.value.copy(userName = name)
            }
        }
    }

    private fun loadSectionOrder() {
        viewModelScope.launch {
            context.homeDataStore.data
                .map { prefs -> prefs[KEY_SECTION_ORDER] ?: DEFAULT_SECTION_ORDER }
                .collect { orderStr ->
                    val tags = orderStr.split(",").filter { it.isNotBlank() }
                    _uiState.value = _uiState.value.copy(sectionTags = tags)
                }
        }
    }

    fun reorderByTag(fromTag: String, toTag: String) {
        val current = _uiState.value.sectionTags.toMutableList()
        val fromIdx = current.indexOf(fromTag)
        val toIdx = current.indexOf(toTag)
        if (fromIdx < 0 || toIdx < 0) return
        current.add(toIdx, current.removeAt(fromIdx))
        _uiState.value = _uiState.value.copy(sectionTags = current)
        viewModelScope.launch {
            context.homeDataStore.edit { it[KEY_SECTION_ORDER] = current.joinToString(",") }
        }
    }

    private fun loadData() {
        val today = LocalDate.now()
        val weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
        val weekEnd = today.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY))

        viewModelScope.launch {
            combine(
                workoutDao.observeByDate(today),
                workoutDao.observeByDateRange(weekStart, weekEnd),
                instanceSeanceDao.observeAll(),
                seanceDao.observeAll(),
            ) { todayWorkouts, weekWorkouts, allInstances, seances ->
                val seancesById = seances.associateBy { it.id }

                val upcomingInstances = allInstances
                    .filter { it.date == today }
                    .sortedBy { it.isCompleted }
                    .map { inst -> inst to seancesById[inst.seanceId] }

                val weekStrengthDone = allInstances.count { inst ->
                    inst.isCompleted && !inst.date.isBefore(weekStart) && !inst.date.isAfter(weekEnd)
                }

                val completedWorkouts = weekWorkouts.filter { it.isCompleted && !it.isTemplate }
                val summary = WeeklySummary(
                    totalSessions = completedWorkouts.size + weekStrengthDone,
                    totalDurationMinutes = completedWorkouts.sumOf {
                        it.resultDurationSec?.let { s -> s / 60 } ?: (it.durationMinutes ?: 0)
                    },
                    runningDistanceKm = completedWorkouts
                        .filter { it.workoutType == WorkoutType.RUNNING }
                        .sumOf { it.resultDistanceKm ?: 0.0 },
                    runningCount = completedWorkouts.count { it.workoutType == WorkoutType.RUNNING },
                    cyclingCount = completedWorkouts.count { it.workoutType == WorkoutType.CYCLING },
                    strengthCount = completedWorkouts.count { it.workoutType == WorkoutType.STRENGTH } + weekStrengthDone,
                    breakdown = completedWorkouts.groupingBy { it.workoutType }.eachCount(),
                )
                _uiState.value.copy(
                    isLoading = false,
                    upcomingWorkouts = todayWorkouts.filter { !it.isTemplate },
                    upcomingInstances = upcomingInstances,
                    weeklySummary = summary,
                )
            }.collect { _uiState.value = it }
        }
    }
}
