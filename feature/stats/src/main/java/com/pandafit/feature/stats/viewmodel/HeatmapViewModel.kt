package com.pandafit.feature.stats.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.analysis.HeatmapCell
import com.pandafit.core.database.analysis.computeHeatmapCells
import com.pandafit.core.database.dao.GpsTrackPointDao
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

data class HeatmapUiState(
    val isLoading: Boolean = true,
    val cells: List<HeatmapCell> = emptyList(),
)

@HiltViewModel
class HeatmapViewModel @Inject constructor(
    private val gpsDao: GpsTrackPointDao,
) : ViewModel() {

    private val _uiState = MutableStateFlow(HeatmapUiState())
    val uiState: StateFlow<HeatmapUiState> = _uiState.asStateFlow()

    init { load() }

    private fun load() {
        viewModelScope.launch {
            // Lecture + binning (potentiellement des dizaines de milliers de points sur un
            // historique chargé) hors du thread principal.
            val cells = withContext(Dispatchers.IO) {
                computeHeatmapCells(gpsDao.getAll())
            }
            _uiState.value = HeatmapUiState(isLoading = false, cells = cells)
        }
    }
}
