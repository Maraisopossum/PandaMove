package com.pandafit.feature.running.model

import kotlinx.serialization.Serializable
import com.pandafit.core.database.model.IntervalRepResult
import com.pandafit.core.database.entities.RunEndType
import com.pandafit.core.database.entities.RunEndUnit
import com.pandafit.core.database.entities.RunRepeatEntity
import com.pandafit.core.database.entities.RunStepEntity
import com.pandafit.core.database.entities.RunStepType
import com.pandafit.core.database.entities.RunTargetType
import com.pandafit.core.database.entities.WorkoutEntity
import java.time.LocalDate

// ── List ──────────────────────────────────────────────────────────────────────

data class RunningListUiState(
    val isLoading: Boolean = true,
    val templates: List<WorkoutEntity> = emptyList(),
    val planned: List<WorkoutEntity> = emptyList(),
    val completed: List<WorkoutEntity> = emptyList(),
    val error: String? = null,
    /** Workout libre créé par "Séance directe" : déclenche la navigation vers l'exécution puis se réinitialise. */
    val quickStartWorkoutId: Long? = null,
)

// ── Detail (create/edit) ──────────────────────────────────────────────────────

data class RunningDetailUiState(
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val isNew: Boolean = true,
    val isTemplate: Boolean = true,
    val name: String = "",
    val scheduledDate: LocalDate = LocalDate.now(),
    val withStroller: Boolean = false,
    val items: List<RunItemDraft> = listOf(
        RunItemDraft.Step(stepType = RunStepType.WARMUP,   endType = RunEndType.DURATION, endValue = "900",  endUnit = RunEndUnit.SECONDS),
        RunItemDraft.Step(stepType = RunStepType.RECOVERY, endType = RunEndType.DURATION, endValue = "600",  endUnit = RunEndUnit.SECONDS),
    ),
    val savedWorkoutId: Long? = null,
    val error: String? = null,
)

sealed class RunItemDraft {
    data class Step(
        val id: Long = 0,
        val repeatId: Long? = null,
        val position: Int = 0,
        val stepType: RunStepType = RunStepType.RUNNING,
        val endType: RunEndType = RunEndType.DISTANCE,
        val endValue: String = "",
        val endUnit: RunEndUnit = RunEndUnit.METERS,
        val note: String = "",
        val targetType: RunTargetType = RunTargetType.NONE,
        val targetMin: String = "",
        val targetMax: String = "",
    ) : RunItemDraft()

    data class Repeat(
        val id: Long = 0,
        val position: Int = 0,
        val repeatCount: Int = 4,
        val steps: List<Step> = emptyList(),
    ) : RunItemDraft()
}

// ── Execute (results entry) ───────────────────────────────────────────────────

data class RunningExecuteUiState(
    val isLoading: Boolean = true,
    val workout: WorkoutEntity? = null,
    val freeSteps: List<FreeStepExecution> = emptyList(),
    val repeatBlocks: List<RunRepeatExecution> = emptyList(),
    val isCompleted: Boolean = false,
    val resultDistanceKm: String = "",
    val resultDurationStr: String = "",
    val resultPaceStr: String = "",
    val resultHrAvg: String = "",
    val resultHrMax: String = "",
    val resultElevationM: String = "",
    val resultRpe: String = "",
    val resultCalories: String = "",
    val resultCadenceAvgPpm: String = "",
    val resultNotes: String = "",
)

data class FreeStepExecution(
    val step: RunStepEntity,
    val result: FreeStepResult,
)

@Serializable
data class FreeStepResult(
    val timeStr: String = "",
    val actualIntensity: String = "",
    val rpeStr: String = "",
    val done: Boolean = false,
)

data class RunRepeatExecution(
    val repeat: RunRepeatEntity,
    val targetStep: RunStepEntity?,
    val reps: List<IntervalRepResult>,
)


// ── Utilities ─────────────────────────────────────────────────────────────────

fun parsePace(s: String): Double? {
    if (s.isBlank()) return null
    val parts = s.split(":")
    if (parts.size != 2) return s.replace(",", ".").toDoubleOrNull()
    val min = parts[0].toIntOrNull() ?: return null
    val sec = parts[1].toIntOrNull() ?: return null
    return min + sec / 60.0
}

fun formatPace(d: Double?): String {
    if (d == null) return ""
    val min = d.toInt()
    val sec = ((d - min) * 60).toInt()
    return "$min:${sec.toString().padStart(2, '0')}"
}

fun formatPaceRange(minPace: Double?, maxPace: Double?): String = when {
    minPace != null && maxPace != null -> "${formatPace(minPace)}→${formatPace(maxPace)}/km"
    minPace != null -> "${formatPace(minPace)}/km"
    else -> ""
}
