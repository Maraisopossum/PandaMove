package com.pandafit.feature.cycling.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.dao.GpsTrackPointDao
import com.pandafit.core.database.dao.WorkoutBlockDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.WorkoutBlockEntity
import com.pandafit.core.database.entities.WorkoutEntity
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CyclingReportUiState(
    val isLoading: Boolean = true,
    val workout: WorkoutEntity? = null,
    val blocks: List<WorkoutBlockEntity> = emptyList(),
    val gpsPoints: List<Pair<Double, Double>> = emptyList(),
)

@HiltViewModel
class CyclingReportViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val workoutDao: WorkoutDao,
    private val blockDao: WorkoutBlockDao,
    private val gpsDao: GpsTrackPointDao,
) : ViewModel() {

    val workoutId: Long = requireNotNull(savedStateHandle.get<String>("workoutId")?.toLongOrNull())

    private val _uiState = MutableStateFlow(CyclingReportUiState())
    val uiState: StateFlow<CyclingReportUiState> = _uiState.asStateFlow()

    init { load() }

    fun reload() { load() }

    private fun load() {
        viewModelScope.launch {
            val withBlocks = workoutDao.getWithBlocksById(workoutId) ?: run {
                _uiState.value = _uiState.value.copy(isLoading = false)
                return@launch
            }
            val gpsPoints = gpsDao.getByWorkout(workoutId)
                .sortedBy { it.pointIndex }
                .map { Pair(it.latitude, it.longitude) }

            _uiState.value = CyclingReportUiState(
                isLoading = false,
                workout   = withBlocks.workout,
                blocks    = withBlocks.blocks.sortedBy { it.position },
                gpsPoints = gpsPoints,
            )
        }
    }
}
