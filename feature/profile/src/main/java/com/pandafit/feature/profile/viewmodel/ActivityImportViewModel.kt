package com.pandafit.feature.profile.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.activityimport.ActivityImportManager
import com.pandafit.core.database.activityimport.ActivityImportResult
import com.pandafit.core.database.activityimport.ParsedActivity
import com.pandafit.core.database.activityimport.defaultName
import com.pandafit.core.database.activityimport.defaultNameForType
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutType
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

// ── UI state ──────────────────────────────────────────────────────────────────

enum class ActivityImportMode { NEW, EXISTING }

sealed class ActivityImportStep {
    object Idle : ActivityImportStep()
    object Parsing : ActivityImportStep()
    data class Preview(
        val activity: ParsedActivity,
        val date: LocalDate,
        val workoutType: WorkoutType,
        val name: String,
        val mode: ActivityImportMode,
        /** Workout sélectionné quand mode == EXISTING. */
        val targetWorkoutId: Long?,
        /** Séances planifiées du type détecté — pour le picker EXISTING. */
        val plannedWorkouts: List<WorkoutEntity>,
        val withStroller: Boolean = false,
    ) : ActivityImportStep()
    object Importing : ActivityImportStep()
    data class Done(val result: ActivityImportResult) : ActivityImportStep()
    data class Failure(val message: String) : ActivityImportStep()
}

// ── ViewModel ─────────────────────────────────────────────────────────────────

@HiltViewModel
class ActivityImportViewModel @Inject constructor(
    private val activityImportManager: ActivityImportManager,
    private val workoutDao: WorkoutDao,
) : ViewModel() {

    private val _step = MutableStateFlow<ActivityImportStep>(ActivityImportStep.Idle)
    val step: StateFlow<ActivityImportStep> = _step.asStateFlow()

    // ── File picked by the user ───────────────────────────────────────────────

    fun onFilePicked(bytes: ByteArray) {
        viewModelScope.launch {
            _step.value = ActivityImportStep.Parsing
            try {
                val activity = activityImportManager.parse(bytes)
                val planned = workoutDao
                    .observePlannedByType(activity.workoutType)
                    .first()
                _step.value = ActivityImportStep.Preview(
                    activity        = activity,
                    date            = tryParseDate(activity.startTime),
                    workoutType     = activity.workoutType,
                    name            = activity.defaultName(),
                    mode            = ActivityImportMode.NEW,
                    targetWorkoutId = null,
                    plannedWorkouts = planned,
                )
            } catch (e: Exception) {
                _step.value = ActivityImportStep.Failure(e.message ?: "Impossible de lire le fichier d'activité.")
            }
        }
    }

    // ── Preview field edits ───────────────────────────────────────────────────

    fun updateDate(date: LocalDate) = updatePreview { it.copy(date = date) }
    fun updateName(name: String) = updatePreview { it.copy(name = name) }
    fun updateType(type: WorkoutType) {
        viewModelScope.launch {
            val preview = _step.value as? ActivityImportStep.Preview ?: return@launch
            val planned = workoutDao.observePlannedByType(type).first()
            // Ne recalcule le nom que si l'utilisateur n'a pas encore personnalisé celui proposé par
            // défaut pour le sport détecté — sinon le changement de sport écraserait un nom saisi
            // à la main.
            val name = if (preview.name == preview.activity.defaultNameForType(preview.workoutType)) {
                preview.activity.defaultNameForType(type)
            } else {
                preview.name
            }
            _step.value = preview.copy(
                workoutType     = type,
                name            = name,
                plannedWorkouts = planned,
                targetWorkoutId = null,
            )
        }
    }
    fun updateMode(mode: ActivityImportMode) = updatePreview {
        it.copy(mode = mode, targetWorkoutId = null)
    }
    fun updateTargetWorkout(workoutId: Long?) = updatePreview { it.copy(targetWorkoutId = workoutId) }
    fun updateWithStroller(v: Boolean) = updatePreview { it.copy(withStroller = v) }

    private inline fun updatePreview(transform: (ActivityImportStep.Preview) -> ActivityImportStep.Preview) {
        val current = _step.value as? ActivityImportStep.Preview ?: return
        _step.value = transform(current)
    }

    // ── Confirm import ────────────────────────────────────────────────────────

    fun confirm() {
        val preview = _step.value as? ActivityImportStep.Preview ?: return
        viewModelScope.launch {
            _step.value = ActivityImportStep.Importing
            try {
                val result = when {
                    preview.mode == ActivityImportMode.EXISTING && preview.targetWorkoutId != null ->
                        activityImportManager.importIntoExisting(
                            activity      = preview.activity,
                            workoutId     = preview.targetWorkoutId,
                            type          = preview.workoutType,
                            withStroller  = preview.withStroller,
                        )
                    else ->
                        activityImportManager.importAsNew(
                            activity      = preview.activity,
                            date          = preview.date,
                            type          = preview.workoutType,
                            name          = preview.name,
                            withStroller  = preview.withStroller,
                        )
                }
                _step.value = ActivityImportStep.Done(result)
            } catch (e: Exception) {
                _step.value = ActivityImportStep.Failure(e.message ?: "Erreur lors de l'import.")
            }
        }
    }

    // ── Reset ─────────────────────────────────────────────────────────────────

    fun reset() { _step.value = ActivityImportStep.Idle }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun tryParseDate(isoString: String): LocalDate = runCatching {
        java.time.ZonedDateTime.parse(isoString).toLocalDate()
    }.getOrDefault(LocalDate.now())
}
