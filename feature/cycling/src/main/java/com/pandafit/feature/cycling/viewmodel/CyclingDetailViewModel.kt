package com.pandafit.feature.cycling.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.dao.GpsTrackPointDao
import com.pandafit.core.database.dao.WorkoutBlockDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.BlockType
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.feature.cycling.model.CyclingBlockDraft
import com.pandafit.feature.cycling.model.CyclingDetailUiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime
import javax.inject.Inject

@HiltViewModel
class CyclingDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val workoutDao: WorkoutDao,
    private val blockDao: WorkoutBlockDao,
    private val gpsDao: GpsTrackPointDao,
) : ViewModel() {

    private val workoutId: Long? = savedStateHandle.get<String>("workoutId")?.toLongOrNull()
    private val _uiState = MutableStateFlow(CyclingDetailUiState())
    val uiState: StateFlow<CyclingDetailUiState> = _uiState.asStateFlow()

    init {
        if (workoutId != null) loadWorkout(workoutId)
    }

    private fun loadWorkout(id: Long) {
        viewModelScope.launch {
            val withBlocks = workoutDao.getWithBlocksById(id) ?: return@launch
            val gpsPoints = gpsDao.getByWorkout(id)
                .sortedBy { it.pointIndex }
                .map { Pair(it.latitude, it.longitude) }
            _uiState.value = CyclingDetailUiState(
                isLoading = false,
                isNew = false,
                isTemplate = withBlocks.workout.isTemplate,
                isCompleted = withBlocks.workout.isCompleted,
                name = withBlocks.workout.name,
                scheduledDate = withBlocks.workout.scheduledDate,
                notes = withBlocks.workout.notes,
                objective = withBlocks.workout.objective,
                blocks = withBlocks.blocks.sortedBy { it.position }.map { b ->
                    CyclingBlockDraft(
                        id = b.id, blockType = b.blockType, name = b.name, position = b.position,
                        durationMinutes = b.durationMinutes, distanceKm = b.distanceKm,
                        targetPowerWatts = b.targetPowerWatts, targetCadenceRpm = b.targetCadenceRpm,
                        targetHeartRateBpm = b.targetHeartRateBpm, rpeTarget = b.rpeTarget,
                        recoveryMinutes = b.recoveryMinutes, repetitions = b.repetitions, notes = b.notes,
                    )
                },
                gpsPoints = gpsPoints,
            )
        }
    }

    /** Bascule la séance en mode "planifiée directe" (one-shot) : isTemplate=false, sans cloner de template. */
    fun setAsPlanned() { _uiState.value = _uiState.value.copy(isTemplate = false) }

    fun updateName(name: String) { _uiState.value = _uiState.value.copy(name = name) }
    fun updateDate(date: LocalDate) { _uiState.value = _uiState.value.copy(scheduledDate = date) }
    fun updateNotes(notes: String) { _uiState.value = _uiState.value.copy(notes = notes) }
    fun updateObjective(obj: String) { _uiState.value = _uiState.value.copy(objective = obj) }

    fun updateBlock(index: Int, updated: CyclingBlockDraft) {
        val blocks = _uiState.value.blocks.toMutableList()
        if (index in blocks.indices) {
            blocks[index] = updated
            _uiState.value = _uiState.value.copy(blocks = blocks)
        }
    }

    fun addBlock() {
        val blocks = _uiState.value.blocks.toMutableList()
        blocks.add(CyclingBlockDraft(blockType = BlockType.CUSTOM, name = "Bloc ${blocks.size + 1}"))
        _uiState.value = _uiState.value.copy(blocks = blocks)
    }

    fun removeBlock(index: Int) {
        val blocks = _uiState.value.blocks.toMutableList()
        if (index in blocks.indices) { blocks.removeAt(index); _uiState.value = _uiState.value.copy(blocks = blocks) }
    }

    fun duplicateBlock(index: Int) {
        val blocks = _uiState.value.blocks.toMutableList()
        if (index in blocks.indices) {
            blocks.add(index + 1, blocks[index].copy(id = 0, name = "${blocks[index].name} (copie)"))
            _uiState.value = _uiState.value.copy(blocks = blocks)
        }
    }

    fun save() {
        val state = _uiState.value
        if (state.name.isBlank()) { _uiState.value = state.copy(error = "Nom requis"); return }
        viewModelScope.launch {
            _uiState.value = state.copy(isSaving = true)
            try {
                val entity = WorkoutEntity(
                    id = workoutId ?: 0,
                    workoutType = WorkoutType.CYCLING,
                    name = state.name.trim(),
                    notes = state.notes.trim(),
                    objective = state.objective.trim(),
                    scheduledDate = state.scheduledDate,
                    isTemplate = state.isTemplate,
                    updatedAt = LocalDateTime.now(),
                )
                val savedId = if (state.isNew) workoutDao.insert(entity) else { workoutDao.update(entity); workoutId!! }
                blockDao.deleteAllForWorkout(savedId)
                blockDao.insertAll(state.blocks.mapIndexed { i, d -> d.toEntity(savedId, i) })
                _uiState.value = _uiState.value.copy(isSaving = false, isNew = false, savedWorkoutId = savedId)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isSaving = false, error = e.message)
            }
        }
    }
}
