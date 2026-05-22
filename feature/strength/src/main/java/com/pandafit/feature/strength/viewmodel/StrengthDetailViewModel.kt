package com.pandafit.feature.strength.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.dao.ExerciseDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.ExerciseSetEntity
import com.pandafit.core.database.entities.ExerciseCategory
import com.pandafit.core.database.entities.ExerciseEntity
import com.pandafit.core.database.entities.SetType
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutExerciseEntity
import com.pandafit.core.database.entities.WorkoutExerciseType
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.feature.strength.model.StrengthDetailUiState
import com.pandafit.feature.strength.model.StrengthExerciseDraft
import com.pandafit.feature.strength.model.StrengthSetDraft
import com.pandafit.feature.strength.model.StrengthWorkoutMode
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime
import javax.inject.Inject

@HiltViewModel
class StrengthDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val workoutDao: WorkoutDao,
    private val exerciseDao: ExerciseDao,
) : ViewModel() {

    private val workoutId: Long? = savedStateHandle.get<String>("workoutId")?.toLongOrNull()
    private val _uiState = MutableStateFlow(StrengthDetailUiState())
    val uiState: StateFlow<StrengthDetailUiState> = _uiState.asStateFlow()

    init {
        if (workoutId != null) loadWorkout(workoutId)
        loadAvailableExercises()
    }

    private fun loadWorkout(id: Long) {
        viewModelScope.launch {
            val full = workoutDao.getWithBlocksById(id) ?: return@launch
            val exercisesWithSets = exerciseDao.getWithSets(id)
            val drafts = exercisesWithSets.map { eWithSets ->
                StrengthExerciseDraft(
                    workoutExerciseId = eWithSets.workoutExercise.id,
                    exercise = eWithSets.exercise,
                    position = eWithSets.workoutExercise.position,
                    exerciseType = eWithSets.workoutExercise.exerciseType,
                    supersetGroup = eWithSets.workoutExercise.supersetGroup,
                    restBetweenSetsSeconds = eWithSets.workoutExercise.restBetweenSetsSeconds,
                    restAfterExerciseSeconds = eWithSets.workoutExercise.restAfterExerciseSeconds,
                    notes = eWithSets.workoutExercise.notes,
                    sets = eWithSets.sets.sortedBy { it.setNumber }.map { s ->
                        StrengthSetDraft(
                            id = s.id, setNumber = s.setNumber,
                            targetReps = s.targetReps, targetWeightKg = s.targetWeightKg,
                            targetDurationSeconds = s.targetDurationSeconds, targetRpe = s.targetRpe,
                            actualReps = s.actualReps, actualWeightKg = s.actualWeightKg,
                            setType = s.setType,
                        )
                    },
                )
            }
            _uiState.value = StrengthDetailUiState(
                isLoading = false, isNew = false,
                name = full.workout.name, scheduledDate = full.workout.scheduledDate,
                notes = full.workout.notes, exercises = drafts,
            )
        }
    }

    private fun loadAvailableExercises() {
        viewModelScope.launch {
            exerciseDao.observeAll().collect { exercises ->
                _uiState.value = _uiState.value.copy(availableExercises = exercises)
            }
        }
    }

    // ===== Séance =====
    fun updateName(name: String) { _uiState.value = _uiState.value.copy(name = name) }
    fun updateDate(date: LocalDate) { _uiState.value = _uiState.value.copy(scheduledDate = date) }
    fun updateNotes(notes: String) { _uiState.value = _uiState.value.copy(notes = notes) }
    fun updateMode(mode: StrengthWorkoutMode) { _uiState.value = _uiState.value.copy(mode = mode) }

    // ===== Exercices =====
    fun showExercisePicker() { _uiState.value = _uiState.value.copy(showExercisePicker = true) }
    fun hideExercisePicker() { _uiState.value = _uiState.value.copy(showExercisePicker = false) }

    fun addExercise(exercise: ExerciseEntity) {
        val exercises = _uiState.value.exercises.toMutableList()
        exercises.add(
            StrengthExerciseDraft(
                exercise = exercise,
                position = exercises.size,
                sets = listOf(
                    StrengthSetDraft(setNumber = 1),
                    StrengthSetDraft(setNumber = 2),
                    StrengthSetDraft(setNumber = 3),
                ),
            )
        )
        _uiState.value = _uiState.value.copy(exercises = exercises, showExercisePicker = false)
    }

    fun removeExercise(index: Int) {
        val exercises = _uiState.value.exercises.toMutableList()
        if (index in exercises.indices) { exercises.removeAt(index); _uiState.value = _uiState.value.copy(exercises = exercises) }
    }

    fun duplicateExercise(index: Int) {
        val exercises = _uiState.value.exercises.toMutableList()
        if (index in exercises.indices) {
            exercises.add(index + 1, exercises[index].copy(workoutExerciseId = 0))
            _uiState.value = _uiState.value.copy(exercises = exercises)
        }
    }

    fun updateExercise(index: Int, updated: StrengthExerciseDraft) {
        val exercises = _uiState.value.exercises.toMutableList()
        if (index in exercises.indices) { exercises[index] = updated; _uiState.value = _uiState.value.copy(exercises = exercises) }
    }

    // ===== Séries =====
    fun addSet(exerciseIndex: Int) {
        val exercises = _uiState.value.exercises.toMutableList()
        if (exerciseIndex in exercises.indices) {
            val exercise = exercises[exerciseIndex]
            val lastSet = exercise.sets.lastOrNull()
            val newSet = StrengthSetDraft(
                setNumber = exercise.sets.size + 1,
                targetReps = lastSet?.targetReps,
                targetWeightKg = lastSet?.targetWeightKg,
            )
            exercises[exerciseIndex] = exercise.copy(sets = exercise.sets + newSet)
            _uiState.value = _uiState.value.copy(exercises = exercises)
        }
    }

    fun removeSet(exerciseIndex: Int, setIndex: Int) {
        val exercises = _uiState.value.exercises.toMutableList()
        if (exerciseIndex in exercises.indices) {
            val sets = exercises[exerciseIndex].sets.toMutableList()
            if (setIndex in sets.indices && sets.size > 1) {
                sets.removeAt(setIndex)
                exercises[exerciseIndex] = exercises[exerciseIndex].copy(
                    sets = sets.mapIndexed { i, s -> s.copy(setNumber = i + 1) }
                )
                _uiState.value = _uiState.value.copy(exercises = exercises)
            }
        }
    }

    fun updateSet(exerciseIndex: Int, setIndex: Int, updated: StrengthSetDraft) {
        val exercises = _uiState.value.exercises.toMutableList()
        if (exerciseIndex in exercises.indices) {
            val sets = exercises[exerciseIndex].sets.toMutableList()
            if (setIndex in sets.indices) {
                sets[setIndex] = updated
                exercises[exerciseIndex] = exercises[exerciseIndex].copy(sets = sets)
                _uiState.value = _uiState.value.copy(exercises = exercises)
            }
        }
    }

    // ===== Sauvegarde =====
    fun save() {
        val state = _uiState.value
        if (state.name.isBlank()) { _uiState.value = state.copy(error = "Nom requis"); return }
        viewModelScope.launch {
            _uiState.value = state.copy(isSaving = true)
            try {
                val entity = WorkoutEntity(
                    id = workoutId ?: 0,
                    workoutType = WorkoutType.STRENGTH,
                    name = state.name.trim(),
                    notes = state.notes.trim(),
                    scheduledDate = state.scheduledDate,
                    updatedAt = LocalDateTime.now(),
                )
                val savedId = if (state.isNew) workoutDao.insert(entity) else { workoutDao.update(entity); workoutId!! }

                // Supprime et recrée les exercices + séries
                exerciseDao.deleteAllForWorkout(savedId)
                state.exercises.forEachIndexed { exIdx, draft ->
                    val exerciseId = exerciseDao.insertWorkoutExercise(
                        WorkoutExerciseEntity(
                            id = if (state.isNew) 0 else draft.workoutExerciseId,
                            workoutId = savedId,
                            exerciseId = draft.exercise.id,
                            position = exIdx,
                            exerciseType = draft.exerciseType,
                            supersetGroup = draft.supersetGroup,
                            restBetweenSetsSeconds = draft.restBetweenSetsSeconds,
                            restAfterExerciseSeconds = draft.restAfterExerciseSeconds,
                            notes = draft.notes,
                        )
                    )
                    exerciseDao.insertSets(
                        draft.sets.mapIndexed { sIdx, set ->
                            ExerciseSetEntity(
                                workoutExerciseId = exerciseId,
                                setNumber = sIdx + 1,
                                targetReps = set.targetReps,
                                targetWeightKg = set.targetWeightKg,
                                targetDurationSeconds = set.targetDurationSeconds,
                                targetRpe = set.targetRpe,
                                setType = set.setType,
                            )
                        }
                    )
                }
                _uiState.value = _uiState.value.copy(isSaving = false, isNew = false, savedWorkoutId = savedId)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isSaving = false, error = e.message)
            }
        }
    }
}
