package com.pandafit.feature.hiking.model

import com.pandafit.core.database.entities.WorkoutEntity

data class HikingListUiState(
    val isLoading: Boolean = true,
    val completed: List<WorkoutEntity> = emptyList(),
    val error: String? = null,
)

data class HikingDetailUiState(
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val workoutId: Long? = null,
    val name: String = "",
    val dateStr: String = "",
    val distanceKm: String = "",
    val durationH: String = "",
    val durationMin: String = "",
    val elevationM: String = "",
    val speedKmh: String = "",
    val hrAvg: String = "",
    val rpe: String = "",
    val notes: String = "",
    val savedId: Long? = null,
    val error: String? = null,
)

data class HikingReportUiState(
    val isLoading: Boolean = true,
    val workout: WorkoutEntity? = null,
    val error: String? = null,
)
