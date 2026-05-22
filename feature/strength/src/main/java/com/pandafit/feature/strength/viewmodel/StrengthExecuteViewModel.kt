package com.pandafit.feature.strength.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.dao.ExerciseDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.ExerciseSetEntity
import com.pandafit.feature.strength.model.StrengthExerciseExecution
import com.pandafit.feature.strength.model.StrengthExecuteUiState
import com.pandafit.feature.strength.model.StrengthExerciseDraft
import com.pandafit.feature.strength.model.StrengthSetDraft
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject

@HiltViewModel
class StrengthExecuteViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val workoutDao: WorkoutDao,
    private val exerciseDao: ExerciseDao,
) : ViewModel() {

    private val workoutId: Long = requireNotNull(savedStateHandle.get<String>("workoutId")?.toLongOrNull())
    private val _uiState = MutableStateFlow(StrengthExecuteUiState())
    val uiState: StateFlow<StrengthExecuteUiState> = _uiState.asStateFlow()

    init { loadWorkout() }

    private fun loadWorkout() {
        viewModelScope.launch {
            val workout = workoutDao.getById(workoutId) ?: return@launch
            val exercisesWithSets = exerciseDao.getWithSets(workoutId)

            val drafts = exercisesWithSets.map { eWithSets ->
                val sets = eWithSets.sets.sortedBy { it.setNumber }.map { s ->
                    StrengthSetDraft(
                        id = s.id, setNumber = s.setNumber,
                        targetReps = s.targetReps, targetWeightKg = s.targetWeightKg,
                        setType = s.setType,
                    )
                }
                StrengthExerciseDraft(
                    workoutExerciseId = eWithSets.workoutExercise.id,
                    exercise = eWithSets.exercise,
                    position = eWithSets.workoutExercise.position,
                    sets = sets,
                    restBetweenSetsSeconds = eWithSets.workoutExercise.restBetweenSetsSeconds,
                )
            }

            _uiState.value = StrengthExecuteUiState(
                isLoading = false,
                workout = workout,
                exercises = drafts.map { StrengthExerciseExecution(draft = it) },
            )
        }
    }

    fun completeSet(exerciseIndex: Int, setIndex: Int, completedSet: StrengthSetDraft) {
        val exercises = _uiState.value.exercises.toMutableList()
        if (exerciseIndex !in exercises.indices) return

        val execution = exercises[exerciseIndex]
        val newCompleted = execution.completedSets + completedSet
        val allSetsComplete = newCompleted.size >= execution.draft.sets.size

        exercises[exerciseIndex] = execution.copy(
            completedSets = newCompleted,
            isCompleted = allSetsComplete,
        )

        val nextExerciseIndex = if (allSetsComplete) {
            (exerciseIndex + 1).coerceAtMost(exercises.size - 1)
        } else {
            exerciseIndex
        }

        _uiState.value = _uiState.value.copy(
            exercises = exercises,
            currentExerciseIndex = nextExerciseIndex,
            isCompleted = exercises.all { it.isCompleted },
        )
    }

    fun finishWorkout() {
        viewModelScope.launch {
            val now = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            workoutDao.updateCompletion(workoutId, true, now)

            _uiState.value.exercises.forEach { execution ->
                execution.completedSets.forEach { completedSet ->
                    exerciseDao.updateSet(
                        ExerciseSetEntity(
                            id = completedSet.id,
                            workoutExerciseId = execution.draft.workoutExerciseId,
                            setNumber = completedSet.setNumber,
                            targetReps = completedSet.targetReps,
                            targetWeightKg = completedSet.targetWeightKg,
                            actualReps = completedSet.actualReps,
                            actualWeightKg = completedSet.actualWeightKg,
                            actualRpe = completedSet.actualRpe,
                            isCompleted = true,
                            setType = completedSet.setType,
                        )
                    )
                }
            }
        }
    }
}
