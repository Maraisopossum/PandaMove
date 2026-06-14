package com.pandafit.feature.cycling.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.WorkoutEntity
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject

data class CyclingExecuteUiState(
    val isLoading: Boolean = true,
    val workout: WorkoutEntity? = null,
    val isCompleted: Boolean = false,

    // Champs résultats
    val resultDistanceKm: String = "",
    val resultDurationStr: String = "",       // format "hh:mm:ss" ou "mm:ss"
    val resultSpeedAvgKmh: String = "",       // auto-calculé, read-only
    val resultSpeedMaxKmh: String = "",
    val resultHrAvg: String = "",
    val resultHrMax: String = "",
    val resultCadenceAvgRpm: String = "",
    val resultElevationM: String = "",
    val resultCalories: String = "",
    val resultRpe: String = "",
    val resultNotes: String = "",
)

@HiltViewModel
class CyclingExecuteViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val workoutDao: WorkoutDao,
) : ViewModel() {

    private val workoutId: Long = requireNotNull(savedStateHandle.get<String>("workoutId")?.toLongOrNull())

    private val _uiState = MutableStateFlow(CyclingExecuteUiState())
    val uiState: StateFlow<CyclingExecuteUiState> = _uiState.asStateFlow()

    init { loadWorkout() }

    private fun loadWorkout() {
        viewModelScope.launch {
            val w = workoutDao.getById(workoutId) ?: run {
                _uiState.value = _uiState.value.copy(isLoading = false)
                return@launch
            }
            _uiState.value = CyclingExecuteUiState(
                isLoading          = false,
                workout            = w,
                resultDistanceKm   = w.resultDistanceKm?.toString() ?: "",
                resultDurationStr  = w.resultDurationSec?.let { formatDurationSec(it) } ?: "",
                resultSpeedAvgKmh  = w.resultSpeedAvgKmh?.let { "%.1f".format(it) } ?: "",
                resultSpeedMaxKmh  = w.resultSpeedMaxKmh?.let { "%.1f".format(it) } ?: "",
                resultHrAvg        = w.resultHrAvg?.toString() ?: "",
                resultHrMax        = w.resultHrMax?.toString() ?: "",
                resultCadenceAvgRpm = w.resultCadenceAvgRpm?.toString() ?: "",
                resultElevationM   = w.resultElevationM?.toString() ?: "",
                resultCalories     = w.resultCalories?.toString() ?: "",
                resultRpe          = w.resultRpe?.toString() ?: "",
                resultNotes        = w.resultNotes,
            )
        }
    }

    fun updateField(field: String, value: String) {
        val newState = when (field) {
            "distanceKm"    -> _uiState.value.copy(resultDistanceKm = value)
            "duration"      -> _uiState.value.copy(resultDurationStr = value)
            "speedMax"      -> _uiState.value.copy(resultSpeedMaxKmh = value)
            "hr"            -> _uiState.value.copy(resultHrAvg = value)
            "hrMax"         -> _uiState.value.copy(resultHrMax = value)
            "cadence"       -> _uiState.value.copy(resultCadenceAvgRpm = value)
            "elevation"     -> _uiState.value.copy(resultElevationM = value)
            "calories"      -> _uiState.value.copy(resultCalories = value)
            "rpe"           -> _uiState.value.copy(resultRpe = value)
            "notes"         -> _uiState.value.copy(resultNotes = value)
            else            -> _uiState.value
        }

        // Recalcul automatique de la vitesse moyenne dès que distance ou durée change
        if (field == "distanceKm" || field == "duration") {
            val computed = computeAvgSpeedKmh(
                distStr = if (field == "distanceKm") value else newState.resultDistanceKm,
                durStr  = if (field == "duration")   value else newState.resultDurationStr,
            )
            _uiState.value = newState.copy(resultSpeedAvgKmh = computed ?: newState.resultSpeedAvgKmh)
        } else {
            _uiState.value = newState
        }
    }

    fun finishWorkout() {
        viewModelScope.launch {
            val s = _uiState.value
            val completedAt = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            val distKm = s.resultDistanceKm.replace(",", ".").toDoubleOrNull()
            val durSec = parseDurationToSec(s.resultDurationStr)
            val speedAvg = s.resultSpeedAvgKmh.replace(",", ".").toDoubleOrNull()
                ?: computeAvgSpeedKmh(s.resultDistanceKm, s.resultDurationStr)?.replace(",", ".")?.toDoubleOrNull()

            workoutDao.saveCyclingResults(
                id          = workoutId,
                distKm      = distKm,
                durSec      = durSec,
                speedAvg    = speedAvg,
                speedMax    = s.resultSpeedMaxKmh.replace(",", ".").toDoubleOrNull(),
                hr          = s.resultHrAvg.toIntOrNull(),
                hrMax       = s.resultHrMax.toIntOrNull(),
                cadence     = s.resultCadenceAvgRpm.toIntOrNull(),
                elevationM  = s.resultElevationM.toIntOrNull(),
                calories    = s.resultCalories.toIntOrNull(),
                rpe         = s.resultRpe.toIntOrNull(),
                notes       = s.resultNotes,
                completedAt = completedAt,
            )
            _uiState.value = s.copy(isCompleted = true)
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun computeAvgSpeedKmh(distStr: String, durStr: String): String? {
        val dist = distStr.replace(",", ".").toDoubleOrNull() ?: return null
        if (dist <= 0) return null
        val durSec = parseDurationToSec(durStr) ?: return null
        if (durSec <= 0) return null
        val speedKmh = dist / (durSec / 3600.0)
        return "%.1f".format(speedKmh)
    }

    private fun parseDurationToSec(s: String): Int? {
        val parts = s.split(":").mapNotNull { it.toIntOrNull() }
        return when (parts.size) {
            2    -> parts[0] * 60 + parts[1]
            3    -> parts[0] * 3600 + parts[1] * 60 + parts[2]
            else -> s.toIntOrNull()
        }
    }
}

private fun formatDurationSec(totalSec: Int): String {
    val h = totalSec / 3600
    val m = (totalSec % 3600) / 60
    val s = totalSec % 60
    return if (h > 0) "$h:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
    else "$m:${s.toString().padStart(2, '0')}"
}
