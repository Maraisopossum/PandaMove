package com.pandafit.feature.profile.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.core.database.tcx.TcxImportManager
import com.pandafit.core.database.tcx.TcxImportResult
import com.pandafit.core.database.tcx.TcxParsedActivity
import com.pandafit.core.database.tcx.defaultName
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.io.ByteArrayInputStream
import java.time.LocalDate
import javax.inject.Inject

// ── UI state ──────────────────────────────────────────────────────────────────

enum class TcxImportMode { NEW, EXISTING }

sealed class TcxImportStep {
    object Idle : TcxImportStep()
    object Parsing : TcxImportStep()
    data class Preview(
        val activity: TcxParsedActivity,
        val date: LocalDate,
        val workoutType: WorkoutType,
        val name: String,
        val mode: TcxImportMode,
        /** Workout sélectionné quand mode == EXISTING. */
        val targetWorkoutId: Long?,
        /** Séances planifiées du type détecté — pour le picker EXISTING. */
        val plannedWorkouts: List<WorkoutEntity>,
        val withStroller: Boolean = false,
    ) : TcxImportStep()
    object Importing : TcxImportStep()
    data class Done(val result: TcxImportResult) : TcxImportStep()
    data class Failure(val message: String) : TcxImportStep()
}

// ── ViewModel ─────────────────────────────────────────────────────────────────

@HiltViewModel
class TcxImportViewModel @Inject constructor(
    private val tcxImportManager: TcxImportManager,
    private val workoutDao: WorkoutDao,
) : ViewModel() {

    private val _step = MutableStateFlow<TcxImportStep>(TcxImportStep.Idle)
    val step: StateFlow<TcxImportStep> = _step.asStateFlow()

    // ── File picked by the user ───────────────────────────────────────────────

    fun onFilePicked(bytes: ByteArray) {
        viewModelScope.launch {
            _step.value = TcxImportStep.Parsing
            try {
                val activity = tcxImportManager.parse(ByteArrayInputStream(bytes))
                val planned = workoutDao
                    .observePlannedByType(activity.workoutType)
                    .first()
                _step.value = TcxImportStep.Preview(
                    activity        = activity,
                    date            = tryParseDate(activity.startTime),
                    workoutType     = activity.workoutType,
                    name            = activity.defaultName(),
                    mode            = TcxImportMode.NEW,
                    targetWorkoutId = null,
                    plannedWorkouts = planned,
                )
            } catch (e: Exception) {
                _step.value = TcxImportStep.Failure(e.message ?: "Impossible de lire le fichier TCX.")
            }
        }
    }

    // ── Preview field edits ───────────────────────────────────────────────────

    fun updateDate(date: LocalDate) = updatePreview { it.copy(date = date) }
    fun updateName(name: String) = updatePreview { it.copy(name = name) }
    fun updateType(type: WorkoutType) {
        viewModelScope.launch {
            val preview = _step.value as? TcxImportStep.Preview ?: return@launch
            val planned = workoutDao.observePlannedByType(type).first()
            _step.value = preview.copy(
                workoutType     = type,
                plannedWorkouts = planned,
                targetWorkoutId = null,
            )
        }
    }
    fun updateMode(mode: TcxImportMode) = updatePreview {
        it.copy(mode = mode, targetWorkoutId = null)
    }
    fun updateTargetWorkout(workoutId: Long?) = updatePreview { it.copy(targetWorkoutId = workoutId) }
    fun updateWithStroller(v: Boolean) = updatePreview { it.copy(withStroller = v) }

    private inline fun updatePreview(transform: (TcxImportStep.Preview) -> TcxImportStep.Preview) {
        val current = _step.value as? TcxImportStep.Preview ?: return
        _step.value = transform(current)
    }

    // ── Confirm import ────────────────────────────────────────────────────────

    fun confirm() {
        val preview = _step.value as? TcxImportStep.Preview ?: return
        viewModelScope.launch {
            _step.value = TcxImportStep.Importing
            try {
                val result = when {
                    preview.mode == TcxImportMode.EXISTING && preview.targetWorkoutId != null ->
                        tcxImportManager.importIntoExisting(
                            activity      = preview.activity,
                            workoutId     = preview.targetWorkoutId,
                            type          = preview.workoutType,
                            withStroller  = preview.withStroller,
                        )
                    else ->
                        tcxImportManager.importAsNew(
                            activity      = preview.activity,
                            date          = preview.date,
                            type          = preview.workoutType,
                            name          = preview.name,
                            withStroller  = preview.withStroller,
                        )
                }
                _step.value = TcxImportStep.Done(result)
            } catch (e: Exception) {
                _step.value = TcxImportStep.Failure(e.message ?: "Erreur lors de l'import.")
            }
        }
    }

    // ── Reset ─────────────────────────────────────────────────────────────────

    fun reset() { _step.value = TcxImportStep.Idle }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun tryParseDate(isoString: String): LocalDate = runCatching {
        java.time.ZonedDateTime.parse(isoString).toLocalDate()
    }.getOrDefault(LocalDate.now())
}
