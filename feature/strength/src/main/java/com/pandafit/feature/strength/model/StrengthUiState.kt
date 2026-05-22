package com.pandafit.feature.strength.model

import com.pandafit.core.database.entities.ExerciseCategory
import com.pandafit.core.database.entities.ExerciseEntity
import com.pandafit.core.database.entities.SetType
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutExerciseType
import java.time.LocalDate

// ===== Types de séances renforcement =====

enum class StrengthWorkoutMode {
    CLASSIC, SUPERSET, CIRCUIT
}

// ===== Liste =====

data class StrengthListUiState(
    val isLoading: Boolean = true,
    val workouts: List<WorkoutEntity> = emptyList(),
    val error: String? = null,
)

// ===== Détail / Création =====

data class StrengthDetailUiState(
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val isNew: Boolean = true,
    val name: String = "",
    val scheduledDate: LocalDate = LocalDate.now(),
    val notes: String = "",
    val mode: StrengthWorkoutMode = StrengthWorkoutMode.CLASSIC,
    val exercises: List<StrengthExerciseDraft> = emptyList(),
    val restBetweenExercisesSeconds: Int = 120,
    val savedWorkoutId: Long? = null,
    val error: String? = null,
    // Pour la sélection d'exercices
    val showExercisePicker: Boolean = false,
    val exercisePickerQuery: String = "",
    val availableExercises: List<ExerciseEntity> = emptyList(),
)

data class StrengthExerciseDraft(
    val workoutExerciseId: Long = 0,
    val exercise: ExerciseEntity,
    val position: Int = 0,
    val exerciseType: WorkoutExerciseType = WorkoutExerciseType.STANDARD,
    val supersetGroup: Int? = null,
    val sets: List<StrengthSetDraft> = listOf(StrengthSetDraft()),
    val restBetweenSetsSeconds: Int = 90,
    val restAfterExerciseSeconds: Int = 120,
    val notes: String = "",
) {
    val totalVolume: Double
        get() = sets.sumOf { (it.targetWeightKg ?: 0.0) * (it.targetReps ?: 0) }
}

data class StrengthSetDraft(
    val id: Long = 0,
    val setNumber: Int = 1,
    val targetReps: Int? = null,
    val targetWeightKg: Double? = null,
    val targetDurationSeconds: Int? = null,
    val targetRpe: Int? = null,
    val actualReps: Int? = null,
    val actualWeightKg: Double? = null,
    val actualDurationSeconds: Int? = null,
    val actualRpe: Int? = null,
    val isCompleted: Boolean = false,
    val setType: SetType = SetType.WORKING,
)

// ===== Bibliothèque d'exercices =====

data class ExerciseLibraryUiState(
    val isLoading: Boolean = true,
    val exercises: List<ExerciseEntity> = emptyList(),
    val filteredExercises: List<ExerciseEntity> = emptyList(),
    val searchQuery: String = "",
    val selectedCategory: ExerciseCategory? = null,
)

// ===== Exécution =====

data class StrengthExecuteUiState(
    val isLoading: Boolean = true,
    val workout: WorkoutEntity? = null,
    val exercises: List<StrengthExerciseExecution> = emptyList(),
    val currentExerciseIndex: Int = 0,
    val currentSetIndex: Int = 0,
    val isCompleted: Boolean = false,
    val restTimerSeconds: Int? = null,
)

data class StrengthExerciseExecution(
    val draft: StrengthExerciseDraft,
    val completedSets: List<StrengthSetDraft> = emptyList(),
    val isCompleted: Boolean = false,
)
