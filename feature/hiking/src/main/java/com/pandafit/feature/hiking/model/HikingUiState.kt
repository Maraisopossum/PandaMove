package com.pandafit.feature.hiking.model

import com.pandafit.core.database.entities.WorkoutEntity

data class HikingListUiState(
    val isLoading: Boolean = true,
    val completed: List<WorkoutEntity> = emptyList(),
    val error: String? = null,
    /** Non-null juste après "Randonnée directe" — déclenche la navigation vers l'exécution GPS. */
    val quickStartWorkoutId: Long? = null,
)

data class HikingExecuteUiState(
    val isLoading: Boolean = true,
    val workout: WorkoutEntity? = null,
    /** Id réel une fois la séance créée en base (créée seulement au tap "Démarrer"). Null tant que la rando directe est en brouillon. */
    val workoutId: Long? = null,
    val resultDistanceKm: String = "",
    val resultDurationStr: String = "",
    val resultSpeedKmh: String = "",
    val resultElevationM: String = "",
    val resultHrAvg: String = "",
    val resultHrMax: String = "",
    val resultRpe: String = "",
    val resultCalories: String = "",
    val resultNotes: String = "",
    val isCompleted: Boolean = false,
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
