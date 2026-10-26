package com.pandafit.feature.cycling.model

import com.pandafit.core.database.entities.BlockType
import com.pandafit.core.database.entities.WorkoutBlockEntity
import com.pandafit.core.database.entities.WorkoutEntity
import java.time.LocalDate

data class CyclingListUiState(
    val isLoading: Boolean = true,
    val templates: List<WorkoutEntity> = emptyList(),
    val planned: List<WorkoutEntity> = emptyList(),
    val completed: List<WorkoutEntity> = emptyList(),
    val error: String? = null,
    val quickStartWorkoutId: Long? = null,
    /** Tracé GPS (lat, lon) par workoutId, pour la miniature de parcours des séances terminées — absent si pas de tracé. */
    val routeThumbnails: Map<Long, List<Pair<Double, Double>>> = emptyMap(),
)

data class CyclingDetailUiState(
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val isNew: Boolean = true,
    val isTemplate: Boolean = true,
    val isCompleted: Boolean = false,
    val name: String = "",
    val scheduledDate: LocalDate = LocalDate.now(),
    val notes: String = "",
    val objective: String = "",
    val blocks: List<CyclingBlockDraft> = listOf(
        CyclingBlockDraft(blockType = BlockType.WARMUP, name = "Échauffement"),
        CyclingBlockDraft(blockType = BlockType.MAIN, name = "Bloc principal"),
        CyclingBlockDraft(blockType = BlockType.COOLDOWN, name = "Retour au calme"),
    ),
    val savedWorkoutId: Long? = null,
    val error: String? = null,
    /** Tracé GPS (lat, lon) — vide si non disponible. */
    val gpsPoints: List<Pair<Double, Double>> = emptyList(),
)

data class CyclingBlockDraft(
    val id: Long = 0,
    val blockType: BlockType,
    val name: String,
    val position: Int = 0,
    val durationMinutes: Int? = null,
    val distanceKm: Double? = null,
    val targetPowerWatts: Int? = null,
    val targetCadenceRpm: Int? = null,
    val targetHeartRateBpm: Int? = null,
    val rpeTarget: Int? = null,
    val recoveryMinutes: Int? = null,
    val repetitions: Int? = null,
    val notes: String = "",
) {
    fun toEntity(workoutId: Long, position: Int) = WorkoutBlockEntity(
        id = id,
        workoutId = workoutId,
        blockType = blockType,
        name = name,
        position = position,
        durationMinutes = durationMinutes,
        distanceKm = distanceKm,
        targetPowerWatts = targetPowerWatts,
        targetCadenceRpm = targetCadenceRpm,
        targetHeartRateBpm = targetHeartRateBpm,
        rpeTarget = rpeTarget,
        recoveryMinutes = recoveryMinutes,
        repetitions = repetitions,
        notes = notes,
    )
}
