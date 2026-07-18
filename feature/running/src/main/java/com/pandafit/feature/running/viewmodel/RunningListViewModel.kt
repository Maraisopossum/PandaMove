package com.pandafit.feature.running.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.ActiveSessionManager
import com.pandafit.core.database.dao.GpsTrackPointDao
import com.pandafit.core.database.dao.RunRepeatDao
import com.pandafit.core.database.dao.RunStepDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.feature.running.model.RunningListUiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime
import javax.inject.Inject

@HiltViewModel
class RunningListViewModel @Inject constructor(
    private val workoutDao: WorkoutDao,
    private val repeatDao: RunRepeatDao,
    private val stepDao: RunStepDao,
    private val gpsDao: GpsTrackPointDao,
    private val sessionManager: ActiveSessionManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(RunningListUiState())
    val uiState: StateFlow<RunningListUiState> = _uiState.asStateFlow()

    /** Séance en cours d'exécution (GPS actif ou en pause) : ne doit jamais pouvoir être supprimée. */
    val activeWorkoutId: StateFlow<Long?> = sessionManager.activeWorkoutId

    init { observeWorkouts() }

    private fun observeWorkouts() {
        viewModelScope.launch {
            combine(
                workoutDao.observeTemplatesByType(WorkoutType.RUNNING),
                workoutDao.observePlannedByType(WorkoutType.RUNNING),
                workoutDao.observeCompletedByType(WorkoutType.RUNNING),
            ) { templates, planned, completed ->
                Triple(templates, planned, completed)
            }
            .map { (templates, planned, completed) ->
                // Requête groupée (pas une par carte) pour la miniature de parcours des séances terminées.
                val thumbnails = if (completed.isEmpty()) emptyMap() else {
                    gpsDao.getByWorkoutIds(completed.map { it.id })
                        .groupBy({ it.workoutId }, { Pair(it.latitude, it.longitude) })
                }
                RunningListUiState(isLoading = false, templates = templates, planned = planned, completed = completed, routeThumbnails = thumbnails)
            }
            .catch { e -> _uiState.value = _uiState.value.copy(isLoading = false, error = e.message) }
            // Préserver quickStartWorkoutId : Room peut émettre entre l'insert et la mise à jour de l'état
            .collect { newState -> _uiState.value = newState.copy(quickStartWorkoutId = _uiState.value.quickStartWorkoutId) }
        }
    }

    fun deleteWorkout(id: Long) {
        if (id == sessionManager.activeWorkoutId.value) return
        viewModelScope.launch { workoutDao.deleteById(id) }
    }

    fun deleteWorkouts(ids: Set<Long>) {
        val active = sessionManager.activeWorkoutId.value
        viewModelScope.launch { ids.filter { it != active }.forEach { workoutDao.deleteById(it) } }
    }

    /** Affecte une séance type à une date (crée une occurrence planifiée). */
    fun assignToDate(templateId: Long, date: LocalDate) {
        viewModelScope.launch { cloneTemplate(templateId, date) }
    }

    /** Affecte une séance type à plusieurs dates. */
    fun assignToDates(templateId: Long, dates: Set<LocalDate>) {
        viewModelScope.launch { dates.forEach { cloneTemplate(templateId, it) } }
    }

    /** Affecte une séance type en récurrence (intervalDays entre chaque occurrence). */
    fun assignRecurring(templateId: Long, startDate: LocalDate, intervalDays: Int, occurrences: Int) {
        viewModelScope.launch {
            repeat(occurrences) { i ->
                cloneTemplate(templateId, startDate.plusDays((i * intervalDays).toLong()))
            }
        }
    }

    /** Déplace une séance planifiée vers une nouvelle date, sans la recréer. Ignoré si template ou terminée. */
    fun rescheduleWorkout(id: Long, newDate: LocalDate) {
        viewModelScope.launch {
            val w = workoutDao.getById(id) ?: return@launch
            if (!w.isCompleted && !w.isTemplate) workoutDao.update(w.copy(scheduledDate = newDate))
        }
    }

    private suspend fun cloneTemplate(templateId: Long, date: LocalDate) {
        val template = workoutDao.getById(templateId) ?: return
        val now = LocalDateTime.now()
        val newId = workoutDao.insert(
            template.copy(
                id = 0, isTemplate = false, scheduledDate = date,
                isCompleted = false, resultDistanceKm = null, resultDurationSec = null,
                resultPaceAvgMinPerKm = null, resultHrAvg = null, resultHrMax = null,
                resultRpe = null, resultNotes = "", resultElevationM = null,
                createdAt = now, updatedAt = now,
            )
        )
        val oldRepeats = repeatDao.getByWorkout(templateId)
        val repeatIdMap = mutableMapOf<Long, Long>()
        oldRepeats.forEach { rep ->
            val newRepId = repeatDao.insert(rep.copy(id = 0, workoutId = newId, resultsJson = ""))
            repeatIdMap[rep.id] = newRepId
        }
        val oldSteps = stepDao.getByWorkout(templateId)
        oldSteps.forEach { step ->
            stepDao.insert(step.copy(id = 0, workoutId = newId, repeatId = step.repeatId?.let { repeatIdMap[it] }, resultsJson = ""))
        }
    }

    /**
     * "Séance directe" : navigue vers l'exécution GPS en mode brouillon, sans créer de séance
     * en base. La séance (+ son étape RUNNING libre) n'est créée qu'au tap "Démarrer" (voir
     * [com.pandafit.feature.running.viewmodel.RunningExecuteViewModel]), pour éviter les lignes
     * orphelines si l'utilisateur quitte sans avoir démarré le suivi GPS.
     */
    fun quickStartFreeRun() {
        _uiState.value = _uiState.value.copy(quickStartWorkoutId = 0L)
    }

    /** À appeler une fois la navigation effectuée, pour ne pas redéclencher l'effet. */
    fun onQuickStartHandled() {
        _uiState.value = _uiState.value.copy(quickStartWorkoutId = null)
    }

    /** Duplique une séance type avec toutes ses étapes (RunRepeat + RunStep). */
    fun duplicateWorkout(id: Long) {
        viewModelScope.launch {
            val original = workoutDao.getById(id) ?: return@launch
            // Copie de la WorkoutEntity
            val newId = workoutDao.insert(
                original.copy(
                    id = 0,
                    name = "${original.name} (copie)",
                    isTemplate = true,
                    isCompleted = false,
                    resultDistanceKm = null, resultDurationSec = null,
                    resultPaceAvgMinPerKm = null, resultHrAvg = null, resultHrMax = null,
                    resultRpe = null, resultNotes = "", resultElevationM = null,
                )
            )
            // Copie des RunRepeat (groupes) et map ancienId→nouveauId
            val oldRepeats = repeatDao.getByWorkout(id)
            val repeatIdMap = mutableMapOf<Long, Long>()
            oldRepeats.forEach { rep ->
                val newRepId = repeatDao.insert(rep.copy(id = 0, workoutId = newId))
                repeatIdMap[rep.id] = newRepId
            }
            // Copie des RunStep avec mise à jour du workoutId et repeatId
            val oldSteps = stepDao.getByWorkout(id)
            oldSteps.forEach { step ->
                stepDao.insert(
                    step.copy(
                        id = 0,
                        workoutId = newId,
                        repeatId = step.repeatId?.let { repeatIdMap[it] },
                    )
                )
            }
        }
    }
}
