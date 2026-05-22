package com.pandafit.feature.home.model

import com.pandafit.core.database.entities.InstanceSeanceEntity
import com.pandafit.core.database.entities.SeanceEntity
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutType

data class HomeUiState(
    val isLoading: Boolean = true,
    val userName: String = "",
    val upcomingWorkouts: List<WorkoutEntity> = emptyList(),
    val upcomingInstances: List<Pair<InstanceSeanceEntity, SeanceEntity?>> = emptyList(),
    val weeklySummary: WeeklySummary = WeeklySummary(),
    val sectionTags: List<String> = emptyList(),
    val error: String? = null,
)

data class WeeklySummary(
    val totalSessions: Int = 0,
    val totalDurationMinutes: Int = 0,
    val runningDistanceKm: Double = 0.0,
    val runningCount: Int = 0,
    val cyclingCount: Int = 0,
    val strengthCount: Int = 0,
    val breakdown: Map<WorkoutType, Int> = emptyMap(),
)
