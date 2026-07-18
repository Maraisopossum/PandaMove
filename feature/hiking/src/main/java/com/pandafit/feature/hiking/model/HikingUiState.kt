package com.pandafit.feature.hiking.model

import com.pandafit.core.database.analysis.DistanceSplitAnalysis
import com.pandafit.core.database.analysis.MascotVariant
import com.pandafit.core.database.analysis.MetricItem
import com.pandafit.core.database.analysis.SignatureMetric
import com.pandafit.core.database.analysis.WorkoutFeedback
import com.pandafit.core.database.entities.WorkoutEntity

data class HikingListUiState(
    val isLoading: Boolean = true,
    val completed: List<WorkoutEntity> = emptyList(),
    val error: String? = null,
    /** Non-null juste après "Randonnée directe" — déclenche la navigation vers l'exécution GPS. */
    val quickStartWorkoutId: Long? = null,
    /** Tracé GPS (lat, lon) par workoutId, pour la miniature de parcours des séances terminées — absent si pas de tracé. */
    val routeThumbnails: Map<Long, List<Pair<Double, Double>>> = emptyMap(),
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
    val gpsPoints: List<Pair<Double, Double>> = emptyList(),
    val signatureMetric: SignatureMetric? = null,
    val feedback: WorkoutFeedback? = null,
    val availableMetrics: List<MetricItem> = emptyList(),
    val mascotVariant: MascotVariant = MascotVariant.JOY_MALE,
    /** Analyse "sortie libre" (vitesse + dénivelé par split) — null si aucune donnée exploitable (pas de GPS ni de laps). */
    val splitAnalysis: DistanceSplitAnalysis? = null,
)
