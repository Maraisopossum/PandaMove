package com.pandafit.feature.home.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.catalog.UserPreferencesRepository
import com.pandafit.core.database.dao.InstanceSeanceDao
import com.pandafit.core.database.dao.SeanceDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.feature.home.model.HomeUiState
import com.pandafit.feature.home.model.WeeklySummary
import com.pandafit.feature.home.repository.HomePreferencesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.TemporalAdjusters
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val userPrefs: UserPreferencesRepository,
    private val homePrefs: HomePreferencesRepository,
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
            homePrefs.sectionOrderFlow.collect { tags ->
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
            homePrefs.saveSectionOrder(current)
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
