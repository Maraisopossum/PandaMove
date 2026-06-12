package com.pandafit.feature.running.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.dao.GpsTrackPointDao
import com.pandafit.core.database.dao.RunRepeatDao
import com.pandafit.core.database.dao.RunStepDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.RunRepeatEntity
import com.pandafit.core.database.entities.RunStepEntity
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.model.IntervalRepResult
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import java.time.LocalDate
import java.time.LocalDateTime
import javax.inject.Inject

data class RunningReportUiState(
    val isLoading: Boolean = true,
    val workout: WorkoutEntity? = null,
    val items: List<RunReportItem> = emptyList(),
    // Résultats chargés (séances terminées)
    val repeatResults: Map<Long, List<IntervalRepResult>> = emptyMap(), // key = repeat.id
    // Tracé GPS simplifié (lat, lon) — vide si non disponible
    val gpsPoints: List<Pair<Double, Double>> = emptyList(),
)

sealed class RunReportItem {
    data class Step(val step: RunStepEntity) : RunReportItem()
    data class Repeat(val repeat: RunRepeatEntity, val steps: List<RunStepEntity>) : RunReportItem()

    fun position(): Int = when (this) {
        is Step   -> step.position
        is Repeat -> repeat.position
    }
}

private val json = Json { ignoreUnknownKeys = true }

@HiltViewModel
class RunningReportViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val workoutDao: WorkoutDao,
    private val stepDao: RunStepDao,
    private val repeatDao: RunRepeatDao,
    private val gpsDao: GpsTrackPointDao,
) : ViewModel() {

    val workoutId: Long = requireNotNull(savedStateHandle.get<String>("workoutId")?.toLongOrNull())

    private val _uiState = MutableStateFlow(RunningReportUiState())
    val uiState: StateFlow<RunningReportUiState> = _uiState.asStateFlow()

    init { load() }

    fun reload() { load() }

    private fun load() {
        viewModelScope.launch {
            val workout  = workoutDao.getById(workoutId) ?: return@launch
            val repeats  = repeatDao.getByWorkout(workoutId)
            val allSteps = stepDao.getByWorkout(workoutId)

            val rootSteps = allSteps.filter { it.repeatId == null }
                .sortedBy { it.position }
                .map { RunReportItem.Step(it) }

            val repeatItems = repeats.sortedBy { it.position }.map { rep ->
                RunReportItem.Repeat(
                    repeat = rep,
                    steps  = allSteps.filter { it.repeatId == rep.id }.sortedBy { it.position },
                )
            }

            val items = (rootSteps + repeatItems).sortedBy { it.position() }

            // Charger les résultats par répétition si séance terminée
            val repeatResults = if (workout.isCompleted) {
                repeats.associate { rep ->
                    val reps: List<IntervalRepResult> = if (rep.resultsJson.isNotBlank())
                        runCatching { json.decodeFromString<List<IntervalRepResult>>(rep.resultsJson) }.getOrDefault(emptyList())
                    else emptyList()
                    rep.id to reps
                }
            } else emptyMap()

            val gpsPoints = gpsDao.getByWorkout(workoutId)
                .sortedBy { it.pointIndex }
                .map { Pair(it.latitude, it.longitude) }

            _uiState.value = RunningReportUiState(
                isLoading     = false,
                workout       = workout,
                items         = items,
                repeatResults = repeatResults,
                gpsPoints     = gpsPoints,
            )
        }
    }

    fun createInstance(date: LocalDate) {
        viewModelScope.launch { duplicateForDate(date) }
    }

    fun createInstances(dates: Set<LocalDate>) {
        viewModelScope.launch { dates.forEach { duplicateForDate(it) } }
    }

    fun createRecurring(start: LocalDate, intervalDays: Int, occurrences: Int) {
        viewModelScope.launch {
            repeat(occurrences) { i ->
                duplicateForDate(start.plusDays((i * intervalDays).toLong()))
            }
        }
    }

    private suspend fun duplicateForDate(date: LocalDate) {
        val template = _uiState.value.workout ?: return
        val now = LocalDateTime.now()

        val newId = workoutDao.insert(
            template.copy(
                id = 0, isTemplate = false, scheduledDate = date,
                isCompleted = false, resultDistanceKm = null, resultDurationSec = null,
                resultPaceAvgMinPerKm = null, resultHrAvg = null, resultRpe = null,
                resultNotes = "", resultHrMax = null, resultElevationM = null,
                createdAt = now, updatedAt = now,
            )
        )

        val allSteps = stepDao.getByWorkout(workoutId)
        val repeats  = repeatDao.getByWorkout(workoutId)

        val repeatIdMap = mutableMapOf<Long, Long>()
        repeats.forEach { rep ->
            val newRepId = repeatDao.insert(rep.copy(id = 0, workoutId = newId, resultsJson = ""))
            repeatIdMap[rep.id] = newRepId
        }

        stepDao.insertAll(allSteps.map { step ->
            step.copy(id = 0, workoutId = newId, repeatId = step.repeatId?.let { repeatIdMap[it] })
        })
    }
}
