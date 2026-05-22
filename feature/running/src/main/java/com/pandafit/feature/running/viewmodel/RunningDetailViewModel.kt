package com.pandafit.feature.running.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.dao.RunRepeatDao
import com.pandafit.core.database.dao.RunStepDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.RunEndType
import com.pandafit.core.database.entities.RunEndUnit
import com.pandafit.core.database.entities.RunRepeatEntity
import com.pandafit.core.database.entities.RunStepEntity
import com.pandafit.core.database.entities.RunStepType
import com.pandafit.core.database.entities.RunTargetType
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.feature.running.model.RunItemDraft
import com.pandafit.feature.running.model.RunningDetailUiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDateTime
import javax.inject.Inject

@HiltViewModel
class RunningDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val workoutDao: WorkoutDao,
    private val stepDao: RunStepDao,
    private val repeatDao: RunRepeatDao,
) : ViewModel() {

    private val workoutId: Long? = savedStateHandle.get<String>("workoutId")?.toLongOrNull()
    /** Si true, la séance est créée directement en mode planifié (pas un template réutilisable). */
    private val isPlanned: Boolean = savedStateHandle.get<Boolean>("isPlanned") ?: false
    private val _uiState = MutableStateFlow(
        RunningDetailUiState(isTemplate = !isPlanned)
    )
    val uiState: StateFlow<RunningDetailUiState> = _uiState.asStateFlow()

    init { if (workoutId != null) loadWorkout(workoutId) }

    private fun loadWorkout(id: Long) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            val workout = workoutDao.getById(id) ?: return@launch
            val repeats = repeatDao.getByWorkout(id)
            val allSteps = stepDao.getByWorkout(id)

            val rootSteps: List<RunItemDraft> = allSteps
                .filter { it.repeatId == null }
                .sortedBy { it.position }
                .map { it.toDraft() }

            val repeatItems: List<RunItemDraft> = repeats
                .sortedBy { it.position }
                .map { rep ->
                    RunItemDraft.Repeat(
                        id = rep.id,
                        position = rep.position,
                        repeatCount = rep.repeatCount,
                        steps = allSteps
                            .filter { it.repeatId == rep.id }
                            .sortedBy { it.position }
                            .map { it.toDraft() },
                    )
                }

            val items = (rootSteps + repeatItems).sortedBy { it.position() }

            _uiState.value = RunningDetailUiState(
                isLoading = false,
                isNew = false,
                isTemplate = workout.isTemplate,
                name = workout.name,
                scheduledDate = workout.scheduledDate,
                items = items,
            )
        }
    }

    /** Bascule la séance en mode "planifiée directe" (non-template). Appelé depuis le Screen via LaunchedEffect. */
    fun setAsPlanned() { _uiState.value = _uiState.value.copy(isTemplate = false) }

    fun updateName(name: String) { _uiState.value = _uiState.value.copy(name = name, error = null) }

    fun addStep() {
        val items = _uiState.value.items.toMutableList()
        items.add(RunItemDraft.Step(
            stepType = RunStepType.RUNNING,
            endType = RunEndType.DISTANCE,
            endValue = "",
            endUnit = RunEndUnit.METERS,
            position = items.size,
        ))
        _uiState.value = _uiState.value.copy(items = items)
    }

    fun addRepeat() {
        val items = _uiState.value.items.toMutableList()
        items.add(RunItemDraft.Repeat(
            repeatCount = 4,
            position = items.size,
            steps = listOf(
                RunItemDraft.Step(stepType = RunStepType.RUNNING,   endType = RunEndType.DISTANCE, endValue = "", endUnit = RunEndUnit.METERS),
                RunItemDraft.Step(stepType = RunStepType.RECOVERY,  endType = RunEndType.DURATION, endValue = "", endUnit = RunEndUnit.SECONDS),
            ),
        ))
        _uiState.value = _uiState.value.copy(items = items)
    }

    fun addChildStep(repeatIdx: Int) {
        val items = _uiState.value.items.toMutableList()
        val repeat = items.getOrNull(repeatIdx) as? RunItemDraft.Repeat ?: return
        val newSteps = repeat.steps + RunItemDraft.Step(
            stepType = RunStepType.RUNNING,
            endType = RunEndType.DISTANCE,
            endValue = "",
            endUnit = RunEndUnit.METERS,
            position = repeat.steps.size,
        )
        items[repeatIdx] = repeat.copy(steps = newSteps)
        _uiState.value = _uiState.value.copy(items = items)
    }

    fun updateItem(idx: Int, updated: RunItemDraft) {
        val items = _uiState.value.items.toMutableList()
        if (idx in items.indices) { items[idx] = updated; _uiState.value = _uiState.value.copy(items = items) }
    }

    fun updateChildStep(repeatIdx: Int, stepIdx: Int, updated: RunItemDraft.Step) {
        val items = _uiState.value.items.toMutableList()
        val repeat = items.getOrNull(repeatIdx) as? RunItemDraft.Repeat ?: return
        val steps = repeat.steps.toMutableList()
        if (stepIdx in steps.indices) {
            steps[stepIdx] = updated
            items[repeatIdx] = repeat.copy(steps = steps)
            _uiState.value = _uiState.value.copy(items = items)
        }
    }

    fun removeItem(idx: Int) {
        val items = _uiState.value.items.toMutableList()
        if (idx in items.indices) {
            items.removeAt(idx)
            _uiState.value = _uiState.value.copy(items = reassignPositions(items))
        }
    }

    fun removeChildStep(repeatIdx: Int, stepIdx: Int) {
        val items = _uiState.value.items.toMutableList()
        val repeat = items.getOrNull(repeatIdx) as? RunItemDraft.Repeat ?: return
        val steps = repeat.steps.toMutableList()
        if (stepIdx in steps.indices) {
            steps.removeAt(stepIdx)
            items[repeatIdx] = repeat.copy(steps = steps)
            _uiState.value = _uiState.value.copy(items = items)
        }
    }

    fun reorderItems(from: Int, to: Int) {
        val items = _uiState.value.items.toMutableList()
        if (from !in items.indices || to !in items.indices) return
        val moved = items.removeAt(from)
        items.add(to, moved)
        _uiState.value = _uiState.value.copy(items = reassignPositions(items))
    }

    fun reorderChildSteps(repeatIdx: Int, from: Int, to: Int) {
        val items = _uiState.value.items.toMutableList()
        val repeat = items.getOrNull(repeatIdx) as? RunItemDraft.Repeat ?: return
        val steps = repeat.steps.toMutableList()
        if (from !in steps.indices || to !in steps.indices) return
        val moved = steps.removeAt(from)
        steps.add(to, moved)
        items[repeatIdx] = repeat.copy(steps = steps)
        _uiState.value = _uiState.value.copy(items = items)
    }

    fun save() { viewModelScope.launch { performSave() } }

    private suspend fun performSave(): Long? {
        val state = _uiState.value
        if (state.name.isBlank()) { _uiState.value = state.copy(error = "Le nom est requis"); return null }
        _uiState.value = state.copy(isSaving = true)
        return try {
            val now = LocalDateTime.now()
            val entity = WorkoutEntity(
                id = workoutId ?: 0,
                workoutType = WorkoutType.RUNNING,
                name = state.name.trim(),
                isTemplate = state.isTemplate,
                scheduledDate = state.scheduledDate,
                createdAt = now,
                updatedAt = now,
            )
            val savedId = if (state.isNew) workoutDao.insert(entity)
                          else { workoutDao.update(entity.copy(id = workoutId!!)); workoutId!! }

            // Supprimer les répétitions (CASCADE sur les étapes enfants) puis les étapes racine
            repeatDao.deleteAllForWorkout(savedId)
            stepDao.deleteTopLevelForWorkout(savedId)

            // Réinsérer dans l'ordre courant
            state.items.forEachIndexed { idx, item ->
                when (item) {
                    is RunItemDraft.Repeat -> {
                        val repId = repeatDao.insert(
                            RunRepeatEntity(workoutId = savedId, position = idx, repeatCount = item.repeatCount)
                        )
                        stepDao.insertAll(item.steps.mapIndexed { sIdx, s ->
                            s.toEntity(savedId, sIdx, repId)
                        })
                    }
                    is RunItemDraft.Step -> {
                        stepDao.insert(item.toEntity(savedId, idx, null))
                    }
                }
            }

            _uiState.value = _uiState.value.copy(isSaving = false, isNew = false, savedWorkoutId = savedId)
            savedId
        } catch (e: Exception) {
            _uiState.value = _uiState.value.copy(isSaving = false, error = e.message)
            null
        }
    }

    // ── Helpers privés ────────────────────────────────────────────────────────

    private fun reassignPositions(items: List<RunItemDraft>): List<RunItemDraft> =
        items.mapIndexed { idx, item ->
            when (item) {
                is RunItemDraft.Step   -> item.copy(position = idx)
                is RunItemDraft.Repeat -> item.copy(position = idx)
            }
        }

    private fun RunItemDraft.position(): Int = when (this) {
        is RunItemDraft.Step   -> position
        is RunItemDraft.Repeat -> position
    }

    private fun RunStepEntity.toDraft() = RunItemDraft.Step(
        id = id, repeatId = repeatId, position = position,
        stepType = stepType, endType = endType,
        endValue = endValue.toString(), endUnit = endUnit,
        note = note ?: "", targetType = targetType,
        targetMin = targetMin?.toString() ?: "",
        targetMax = targetMax?.toString() ?: "",
    )

    private fun RunItemDraft.Step.toEntity(workoutId: Long, pos: Int, repeatId: Long?) = RunStepEntity(
        id = 0,
        workoutId = workoutId,
        repeatId = repeatId,
        position = pos,
        stepType = stepType,
        endType = endType,
        endValue = endValue.toIntOrNull() ?: 0,
        endUnit = endUnit,
        note = note.ifBlank { null },
        targetType = targetType,
        targetMin = targetMin.toIntOrNull(),
        targetMax = targetMax.toIntOrNull(),
    )
}
