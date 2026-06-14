package com.pandafit.feature.hiking.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.feature.hiking.model.HikingDetailUiState
import com.pandafit.feature.hiking.model.HikingListUiState
import com.pandafit.feature.hiking.model.HikingReportUiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

@HiltViewModel
class HikingListViewModel @Inject constructor(
    private val workoutDao: WorkoutDao,
) : ViewModel() {

    private val _uiState = MutableStateFlow(HikingListUiState())
    val uiState: StateFlow<HikingListUiState> = _uiState.asStateFlow()

    init { observe() }

    private fun observe() {
        viewModelScope.launch {
            workoutDao.observeCompletedByType(WorkoutType.HIKING)
                .catch { e -> _uiState.value = _uiState.value.copy(isLoading = false, error = e.message) }
                .collect { _uiState.value = HikingListUiState(isLoading = false, completed = it) }
        }
    }

    fun delete(id: Long) = viewModelScope.launch { workoutDao.deleteById(id) }
}

@HiltViewModel
class HikingDetailViewModel @Inject constructor(
    private val workoutDao: WorkoutDao,
) : ViewModel() {

    private val _uiState = MutableStateFlow(HikingDetailUiState())
    val uiState: StateFlow<HikingDetailUiState> = _uiState.asStateFlow()

    private val dateFmt = DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.FRENCH)

    fun load(workoutId: Long) {
        viewModelScope.launch {
            val w = workoutDao.getById(workoutId) ?: return@launch
            val durationSec = w.resultDurationSec ?: 0
            _uiState.value = HikingDetailUiState(
                isLoading = false,
                workoutId = workoutId,
                name = w.name,
                dateStr = w.scheduledDate.format(dateFmt),
                distanceKm = w.resultDistanceKm?.let { "%.2f".format(it) } ?: "",
                durationH = "${durationSec / 3600}",
                durationMin = "${(durationSec % 3600) / 60}",
                elevationM = w.resultElevationM?.toString() ?: "",
                speedKmh = w.resultSpeedAvgKmh?.let { "%.1f".format(it) } ?: "",
                hrAvg = w.resultHrAvg?.toString() ?: "",
                rpe = w.resultRpe?.toString() ?: "",
                notes = w.resultNotes,
            )
        }
    }

    fun initNew() {
        _uiState.value = HikingDetailUiState(
            isLoading = false,
            dateStr = LocalDate.now().format(dateFmt),
        )
    }

    fun update(block: HikingDetailUiState.() -> HikingDetailUiState) {
        _uiState.value = _uiState.value.block()
    }

    fun save() {
        val s = _uiState.value
        if (s.name.isBlank()) {
            _uiState.value = s.copy(error = "Le nom est requis")
            return
        }
        val date = runCatching { LocalDate.parse(s.dateStr, dateFmt) }.getOrElse {
            _uiState.value = s.copy(error = "Date invalide (format jj/mm/aaaa)")
            return
        }
        val durationSec = ((s.durationH.toIntOrNull() ?: 0) * 3600) + ((s.durationMin.toIntOrNull() ?: 0) * 60)
        val distanceKm = s.distanceKm.replace(',', '.').toDoubleOrNull()
        val speedKmh = s.speedKmh.replace(',', '.').toDoubleOrNull()
            ?: if (distanceKm != null && durationSec > 0) distanceKm / (durationSec / 3600.0) else null

        _uiState.value = s.copy(isSaving = true, error = null)
        viewModelScope.launch {
            val now = LocalDateTime.now()
            val id = if (s.workoutId != null) {
                val existing = workoutDao.getById(s.workoutId) ?: return@launch
                workoutDao.update(
                    existing.copy(
                        name = s.name,
                        scheduledDate = date,
                        updatedAt = now,
                        resultDistanceKm = distanceKm,
                        resultDurationSec = durationSec.takeIf { it > 0 },
                        resultElevationM = s.elevationM.toIntOrNull(),
                        resultSpeedAvgKmh = speedKmh,
                        resultHrAvg = s.hrAvg.toIntOrNull(),
                        resultRpe = s.rpe.toIntOrNull(),
                        resultNotes = s.notes,
                    )
                )
                s.workoutId
            } else {
                workoutDao.insert(
                    WorkoutEntity(
                        workoutType = WorkoutType.HIKING,
                        name = s.name,
                        scheduledDate = date,
                        isCompleted = true,
                        completedAt = now,
                        createdAt = now,
                        updatedAt = now,
                        resultDistanceKm = distanceKm,
                        resultDurationSec = durationSec.takeIf { it > 0 },
                        resultElevationM = s.elevationM.toIntOrNull(),
                        resultSpeedAvgKmh = speedKmh,
                        resultHrAvg = s.hrAvg.toIntOrNull(),
                        resultRpe = s.rpe.toIntOrNull(),
                        resultNotes = s.notes,
                    )
                )
            }
            _uiState.value = _uiState.value.copy(isSaving = false, savedId = id)
        }
    }
}

@HiltViewModel
class HikingReportViewModel @Inject constructor(
    private val workoutDao: WorkoutDao,
) : ViewModel() {

    private val _uiState = MutableStateFlow(HikingReportUiState())
    val uiState: StateFlow<HikingReportUiState> = _uiState.asStateFlow()

    fun load(workoutId: Long) {
        viewModelScope.launch {
            val w = workoutDao.getById(workoutId)
            _uiState.value = HikingReportUiState(isLoading = false, workout = w)
        }
    }

    fun delete(workoutId: Long, onDone: () -> Unit) {
        viewModelScope.launch {
            workoutDao.deleteById(workoutId)
            onDone()
        }
    }
}
