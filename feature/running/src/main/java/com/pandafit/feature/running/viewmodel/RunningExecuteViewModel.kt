package com.pandafit.feature.running.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.dao.RunRepeatDao
import com.pandafit.core.database.dao.RunStepDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.RunStepType
import com.pandafit.feature.running.model.FreeStepExecution
import com.pandafit.feature.running.model.FreeStepResult
import com.pandafit.feature.running.model.IntervalRepResult
import com.pandafit.feature.running.model.RunRepeatExecution
import com.pandafit.feature.running.model.RunningExecuteUiState
import com.pandafit.feature.running.model.formatPace
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject

private val json = Json { ignoreUnknownKeys = true }

@HiltViewModel
class RunningExecuteViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val workoutDao: WorkoutDao,
    private val stepDao: RunStepDao,
    private val repeatDao: RunRepeatDao,
) : ViewModel() {

    private val workoutId: Long = requireNotNull(savedStateHandle.get<String>("workoutId")?.toLongOrNull())
    private val _uiState = MutableStateFlow(RunningExecuteUiState())
    val uiState: StateFlow<RunningExecuteUiState> = _uiState.asStateFlow()

    init { loadWorkout() }

    private fun loadWorkout() {
        viewModelScope.launch {
            val workout  = workoutDao.getById(workoutId) ?: return@launch
            val repeats  = repeatDao.getByWorkout(workoutId)
            val allSteps = stepDao.getByWorkout(workoutId)

            // Étapes libres (hors répétition) — uniquement si aucun repeat block
            val freeSteps = if (repeats.isEmpty()) {
                allSteps.filter { it.repeatId == null }.sortedBy { it.position }.map { step ->
                    val saved: FreeStepResult = if (step.resultsJson.isNotBlank())
                        runCatching { json.decodeFromString<FreeStepResult>(step.resultsJson) }.getOrDefault(FreeStepResult())
                    else FreeStepResult()
                    FreeStepExecution(step = step, result = saved)
                }
            } else emptyList()

            val repeatBlocks = repeats.sortedBy { it.position }.map { rep ->
                val childSteps = allSteps.filter { it.repeatId == rep.id }.sortedBy { it.position }
                val targetStep = childSteps.firstOrNull { it.stepType == RunStepType.RUNNING }
                    ?: childSteps.firstOrNull()

                // Charger les résultats déjà sauvegardés (séance terminée en cours d'édition)
                val savedReps: List<IntervalRepResult> = if (rep.resultsJson.isNotBlank()) {
                    runCatching { json.decodeFromString<List<IntervalRepResult>>(rep.resultsJson) }.getOrDefault(emptyList())
                } else emptyList()

                val reps = if (savedReps.size == rep.repeatCount) savedReps
                           else (1..rep.repeatCount).map { i -> savedReps.getOrNull(i - 1) ?: IntervalRepResult(i) }

                RunRepeatExecution(repeat = rep, targetStep = targetStep, reps = reps)
            }

            // Pré-remplir les résultats globaux si la séance a déjà été validée
            _uiState.value = RunningExecuteUiState(
                isLoading = false,
                workout = workout,
                freeSteps = freeSteps,
                repeatBlocks = repeatBlocks,
                resultDistanceKm  = workout.resultDistanceKm?.toString() ?: "",
                resultDurationStr = workout.resultDurationSec?.let { formatDurationSec(it) } ?: "",
                resultPaceStr     = workout.resultPaceAvgMinPerKm?.let { formatPace(it) } ?: "",
                resultHrAvg       = workout.resultHrAvg?.toString() ?: "",
                resultHrMax       = workout.resultHrMax?.toString() ?: "",
                resultElevationM  = workout.resultElevationM?.toString() ?: "",
                resultRpe         = workout.resultRpe?.toString() ?: "",
                resultNotes       = workout.resultNotes,
            )
        }
    }

    fun updateFreeStep(stepIdx: Int, updated: FreeStepResult) {
        val steps = _uiState.value.freeSteps.toMutableList()
        if (stepIdx in steps.indices) {
            steps[stepIdx] = steps[stepIdx].copy(result = updated)
            _uiState.value = _uiState.value.copy(freeSteps = steps)
        }
    }

    fun updateIntervalRep(blockIdx: Int, repIdx: Int, updated: IntervalRepResult) {
        val blocks = _uiState.value.repeatBlocks.toMutableList()
        if (blockIdx in blocks.indices) {
            val reps = blocks[blockIdx].reps.toMutableList()
            if (repIdx in reps.indices) {
                reps[repIdx] = updated
                blocks[blockIdx] = blocks[blockIdx].copy(reps = reps)
                _uiState.value = _uiState.value.copy(repeatBlocks = blocks)
            }
        }
    }

    fun updateOverallResult(field: String, value: String) {
        val newState = when (field) {
            "distanceKm" -> _uiState.value.copy(resultDistanceKm = value)
            "duration"   -> _uiState.value.copy(resultDurationStr = value)
            "pace"       -> _uiState.value.copy(resultPaceStr = value)
            "hr"         -> _uiState.value.copy(resultHrAvg = value)
            "hrMax"      -> _uiState.value.copy(resultHrMax = value)
            "elevation"  -> _uiState.value.copy(resultElevationM = value)
            "rpe"        -> _uiState.value.copy(resultRpe = value)
            "notes"      -> _uiState.value.copy(resultNotes = value)
            else         -> _uiState.value
        }
        if (field == "distanceKm" || field == "duration") {
            val computed = computePaceStr(newState.resultDistanceKm, newState.resultDurationStr)
            _uiState.value = if (computed != null) newState.copy(resultPaceStr = computed) else newState
        } else {
            _uiState.value = newState
        }
    }

    private fun computePaceStr(distanceKm: String, durationStr: String): String? {
        val dist = distanceKm.replace(",", ".").toDoubleOrNull() ?: return null
        if (dist <= 0) return null
        val durSec = parseDurationToSec(durationStr) ?: return null
        if (durSec <= 0) return null
        return formatPace(durSec / 60.0 / dist)
    }

    fun finishWorkout() {
        viewModelScope.launch {
            val s = _uiState.value
            val now = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)

            // Sauvegarder les résultats globaux
            workoutDao.saveResults(
                id          = workoutId,
                distKm      = s.resultDistanceKm.replace(",", ".").toDoubleOrNull(),
                durSec      = parseDurationToSec(s.resultDurationStr),
                pace        = parsePaceStr(s.resultPaceStr),
                hr          = s.resultHrAvg.toIntOrNull(),
                hrMax       = s.resultHrMax.toIntOrNull(),
                rpe         = s.resultRpe.toIntOrNull(),
                notes       = s.resultNotes,
                elevationM  = s.resultElevationM.toIntOrNull(),
                completedAt = now,
            )

            // Sauvegarder les résultats par répétition (JSON dans RunRepeatEntity)
            s.repeatBlocks.forEach { block ->
                val encoded = runCatching { json.encodeToString(block.reps) }.getOrDefault("[]")
                repeatDao.update(block.repeat.copy(resultsJson = encoded))
            }

            // Sauvegarder les résultats des étapes libres
            s.freeSteps.forEach { fse ->
                val encoded = runCatching { json.encodeToString(fse.result) }.getOrDefault("")
                stepDao.updateResults(fse.step.id, encoded)
            }

            _uiState.value = s.copy(isCompleted = true)
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun parseDurationToSec(s: String): Int? {
        val parts = s.split(":").mapNotNull { it.toIntOrNull() }
        return when (parts.size) {
            2    -> parts[0] * 60 + parts[1]
            3    -> parts[0] * 3600 + parts[1] * 60 + parts[2]
            else -> s.toIntOrNull()
        }
    }

    private fun parsePaceStr(s: String): Double? {
        val parts = s.split(":")
        if (parts.size != 2) return s.replace(",", ".").toDoubleOrNull()
        val min = parts[0].toIntOrNull() ?: return null
        val sec = parts[1].toIntOrNull() ?: return null
        return min + sec / 60.0
    }
}

private fun formatDurationSec(totalSec: Int): String {
    val h = totalSec / 3600
    val m = (totalSec % 3600) / 60
    val s = totalSec % 60
    return if (h > 0) "$h:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
    else "$m:${s.toString().padStart(2, '0')}"
}
