package com.pandafit.feature.strength.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.ActiveSessionManager
import com.pandafit.core.database.dao.InstanceSeanceDao
import com.pandafit.core.database.dao.SeanceDao
import com.pandafit.core.database.entities.BlocSeanceEntity
import com.pandafit.core.database.entities.BlocType
import com.pandafit.core.database.entities.SerieRealiseeEntity
import com.pandafit.core.database.relations.ExerciceSeanceWithExercise
import com.pandafit.core.database.relations.SeanceFull
import com.pandafit.feature.strength.model.CircuitPhase
import com.pandafit.feature.strength.model.InstanceExecuteUiState
import com.pandafit.feature.strength.model.SerieRealiseeState
import com.pandafit.feature.strength.model.parseChargeKg
import com.pandafit.feature.strength.model.parseChargeLabel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime
import javax.inject.Inject

@HiltViewModel
class InstanceExecuteViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val seanceDao: SeanceDao,
    private val instanceSeanceDao: InstanceSeanceDao,
    val activeSessionManager: ActiveSessionManager,
) : ViewModel() {

    val instanceId: Long = requireNotNull(savedStateHandle.get<String>("instanceId")?.toLongOrNull())
    private val _uiState = MutableStateFlow(InstanceExecuteUiState())
    val uiState: StateFlow<InstanceExecuteUiState> = _uiState.asStateFlow()

    // Le chrono et le timer de repos sont gérés par ActiveSessionManager (survivent à la navigation)
    val sessionSeconds: StateFlow<Int> = activeSessionManager.sessionSeconds
    val restRemaining: StateFlow<Int> = activeSessionManager.restRemaining
    val restFinishedEvent: SharedFlow<Unit> = activeSessionManager.restFinishedEvent
    val restCountdownBeep: SharedFlow<Int> = activeSessionManager.restCountdownBeep

    private val _exerciceBeep = MutableSharedFlow<Int>(extraBufferCapacity = 5)
    val exerciceBeep: SharedFlow<Int> = _exerciceBeep.asSharedFlow()

    private val _exerciceStartBeep = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val exerciceStartBeep: SharedFlow<Unit> = _exerciceStartBeep.asSharedFlow()

    private val _exerciceEndBeep = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val exerciceEndBeep: SharedFlow<Unit> = _exerciceEndBeep.asSharedFlow()

    // ── Timer exercice circuit ──────────────────────────────────────────────────
    private val _exerciceRemaining = MutableStateFlow(0)
    val exerciceRemaining: StateFlow<Int> = _exerciceRemaining.asStateFlow()
    private var exerciceTimerJob: Job? = null
    private var countdownJob: Job? = null
    private var pendingCircuitExerciceId: Long? = null

    init {
        load()
    }

    // ===== Chargement =====

    private fun load() {
        viewModelScope.launch {
            val instanceWithSeries = instanceSeanceDao.getWithSeries(instanceId)
            if (instanceWithSeries == null) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = "Instance introuvable")
                return@launch
            }
            val instance = instanceWithSeries.instance
            // Séance type uniquement pour le nom/notes — exercices et blocs viennent de la copie d'instance
            val seance = seanceDao.getById(instance.seanceId)

            // Migration lazy v13 : si l'instance n'a pas encore de copies indépendantes d'exercices/blocs
            // (instances créées avant la migration v12→v13), on copie depuis le template au premier accès.
            val instanceExercices = seanceDao.getExercicesForInstance(instanceId)
            if (instanceExercices.isEmpty() && !instance.isCompleted) {
                val full = seanceDao.getSeanceFull(instance.seanceId)
                if (full != null) {
                    val blocIdMap = mutableMapOf<Long, Long>()
                    full.blocs.filter { it.instanceSeanceId == null }.sortedBy { it.position }.forEach { bloc ->
                        val newId = seanceDao.insertBloc(bloc.copy(id = 0, instanceSeanceId = instanceId))
                        blocIdMap[bloc.id] = newId
                    }
                    full.exercices.filter { it.exerciceSeance.instanceSeanceId == null }.forEach { exWithEx ->
                        val ex = exWithEx.exerciceSeance
                        seanceDao.insertExerciceSeance(
                            ex.copy(id = 0, instanceSeanceId = instanceId, blocId = ex.blocId?.let { blocIdMap[it] })
                        )
                    }
                }
            }
            val blocs = seanceDao.getBlocsForInstance(instanceId)
            val exercices = buildOrderedExercicesFromLists(seanceDao.getExercicesForInstance(instanceId), blocs)

            // Historique cross-séance par exercise_id (pas seance_id ni exercice_seance_id)
            val historiqueComplet = mutableMapOf<Long, MutableList<Pair<LocalDate, List<SerieRealiseeEntity>>>>()
            exercices.forEach { ex ->
                val exerciceId = ex.exerciceSeance.id
                val rows = instanceSeanceDao.getHistoriqueForExercise(ex.exercise.id, instanceId)
                if (rows.isNotEmpty()) {
                    val grouped = rows.groupBy { it.instanceDate }
                        .map { (date, rowList) ->
                            date to rowList.map { row ->
                                SerieRealiseeEntity(
                                    id = 0, instanceSeanceId = 0,
                                    exerciceSeanceId = row.exerciceSeanceId,
                                    numeroSerie = row.numeroSerie,
                                    repsRealisees = row.repsRealisees,
                                    chargeKg = row.chargeKg,
                                    chargeLabel = row.chargeLabel,
                                    rpe = row.rpe,
                                    isCompleted = row.isCompleted,
                                )
                            }
                        }
                        .sortedByDescending { it.first }
                    historiqueComplet[exerciceId] = grouped.toMutableList()
                }
            }

            val previousByExercice: Map<Long, List<SerieRealiseeEntity>> = historiqueComplet.mapValues { (_, list) ->
                list.firstOrNull()?.second ?: emptyList()
            }

            val seriesParExercice = mutableMapOf<Long, List<SerieRealiseeState>>()
            exercices.forEach { ex ->
                val exerciceId = ex.exerciceSeance.id
                val existingSeries = instanceWithSeries.series.filter { it.exerciceSeanceId == exerciceId }
                val dbMap = existingSeries.associateBy { it.numeroSerie }

                // Dernière série complétée de cette instance → charge de secours pour le pré-remplissage
                val lastCompletedCharge = existingSeries
                    .filter { it.isCompleted && it.chargeLabel != null }
                    .maxByOrNull { it.numeroSerie }

                val historiqueEx = previousByExercice[exerciceId]
                val templateReps = ex.exerciceSeance.repsCibles.toIntOrNull()
                    ?: ex.exerciceSeance.repsCibles.split("-").firstOrNull()?.trim()?.toIntOrNull()
                val templateChargeLabel = parseChargeLabel(ex.exerciceSeance.chargeCible)
                val templateChargeKg = parseChargeKg(templateChargeLabel)

                val baseNums = (1..ex.exerciceSeance.nombreSeriesPrevues).toList()
                val extraNums = existingSeries.map { it.numeroSerie }
                    .filter { it > ex.exerciceSeance.nombreSeriesPrevues }
                val allNums = (baseNums + extraNums).distinct().sorted()

                seriesParExercice[exerciceId] = allNums.map { num ->
                    val db = dbMap[num]
                    if (db != null) {
                        SerieRealiseeState(
                            id = db.id, numeroSerie = db.numeroSerie,
                            repsRealisees = db.repsRealisees, chargeKg = db.chargeKg,
                            chargeLabel = db.chargeLabel, rpe = db.rpe,
                            isCompleted = db.isCompleted, isPreFilled = false,
                        )
                    } else {
                        val histo = historiqueEx?.find { it.numeroSerie == num }
                        SerieRealiseeState(
                            numeroSerie = num,
                            repsRealisees = histo?.repsRealisees ?: templateReps,
                            chargeKg = histo?.chargeKg ?: lastCompletedCharge?.chargeKg ?: templateChargeKg,
                            chargeLabel = histo?.chargeLabel ?: lastCompletedCharge?.chargeLabel ?: templateChargeLabel,
                            rpe = null, isCompleted = false, isPreFilled = true,
                        )
                    }
                }
            }

            _uiState.value = _uiState.value.copy(
                isLoading = false,
                instance = instance,
                seance = seance,
                blocs = blocs,
                exercices = exercices,
                seriesParExercice = seriesParExercice,
                historiqueComplet = historiqueComplet,
                isCompleted = instance.isCompleted,
            )

            val hasExistingProgress = seriesParExercice.values.any { s -> s.any { it.isCompleted } }
            val alreadyActive = activeSessionManager.activeInstanceId.value == instanceId
            if (!instance.isCompleted && (hasExistingProgress || alreadyActive)) {
                activeSessionManager.resumeSession(
                    instanceId = instanceId,
                    seanceName = seance?.nom ?: "",
                    currentSeconds = if (alreadyActive) activeSessionManager.sessionSeconds.value else 0,
                )
            }
        }
    }

    private fun buildOrderedExercicesFromLists(
        exercices: List<ExerciceSeanceWithExercise>,
        blocs: List<com.pandafit.core.database.entities.BlocSeanceEntity>,
    ): List<ExerciceSeanceWithExercise> {
        data class Item(val pos: Int, val ex: ExerciceSeanceWithExercise? = null, val blocId: Long? = null)
        val items = mutableListOf<Item>()
        exercices.filter { it.exerciceSeance.blocId == null }
            .forEach { ex -> items.add(Item(ex.exerciceSeance.position, ex = ex)) }
        blocs.forEach { bloc -> items.add(Item(bloc.position, blocId = bloc.id)) }
        items.sortBy { it.pos }
        return items.flatMap { item ->
            if (item.ex != null) listOf(item.ex)
            else exercices.filter { it.exerciceSeance.blocId == item.blocId }.sortedBy { it.exerciceSeance.position }
        }
    }

    fun reload() {
        viewModelScope.launch { load() }
    }

    fun reloadExercices() {
        viewModelScope.launch {
            val blocs = seanceDao.getBlocsForInstance(instanceId)
            val exercices = buildOrderedExercicesFromLists(seanceDao.getExercicesForInstance(instanceId), blocs)
            _uiState.value = _uiState.value.copy(
                exercices = exercices,
                blocs = blocs,
                activeExerciceIndex = _uiState.value.activeExerciceIndex.coerceIn(0, maxOf(0, exercices.size - 1)),
            )
        }
    }

    // ===== Navigation exercice =====

    fun setActiveExercice(index: Int) {
        _uiState.value = _uiState.value.copy(activeExerciceIndex = index)
    }

    /**
     * Navigation automatique après validation d'une série.
     * Gère tous les types d'exercices (libre, SUPERSET, CIRCUIT, ECHAUFFEMENT, RECUPERATION).
     * [reposOverrideSec] : repos saisi manuellement par l'utilisateur (prioritaire sur les valeurs du template).
     */
    fun navigateToNext(exerciceId: Long, reposOverrideSec: Int? = null) {
        val state = _uiState.value
        val exercice = state.exercices.find { it.exerciceSeance.id == exerciceId } ?: return
        val blocId = exercice.exerciceSeance.blocId
        val series = state.seriesParExercice[exerciceId] ?: emptyList()
        val exerciceComplete = series.size >= exercice.exerciceSeance.nombreSeriesPrevues
                && series.all { it.isCompleted }

        // ── Exercice libre (pas dans un bloc) ────────────────────────────────
        if (blocId == null) {
            val reposSec = reposOverrideSec ?: exercice.exerciceSeance.tempsReposSec
            if (!exerciceComplete) {
                // Repos inter-séries uniquement, pas de navigation
                if (reposSec > 0) startRestTimer(reposSec)
                return
            }
            // Toutes les séries terminées → naviguer immédiatement, puis timer de repos
            val currentIdx = state.exercices.indexOfFirst { it.exerciceSeance.id == exerciceId }
            val nextIdx = currentIdx + 1
            if (nextIdx >= state.exercices.size) return // dernier exercice, séance finie
            _uiState.value = state.copy(activeExerciceIndex = nextIdx)
            if (reposSec > 0) startRestTimer(reposSec)
            return
        }

        // ── Exercice dans un bloc ─────────────────────────────────────────────
        val bloc = state.blocs.find { it.id == blocId } ?: return
        val exInBloc = state.exercices
            .filter { it.exerciceSeance.blocId == blocId }
            .sortedBy { it.exerciceSeance.position }
        val idxInBloc = exInBloc.indexOfFirst { it.exerciceSeance.id == exerciceId }
        val isLastInBloc = idxInBloc == exInBloc.size - 1

        // SUPERSET/CIRCUIT : alternance → naviguer après chaque série
        // Autres blocs (ECHAUFFEMENT, RECUPERATION) : naviguer seulement quand l'exercice est terminé
        val isAlternating = bloc.type == BlocType.SUPERSET || bloc.type == BlocType.CIRCUIT
        if (!isAlternating && !exerciceComplete) {
            // Repos inter-séries pour blocs non-alternés, sans navigation
            val reposSec = reposOverrideSec ?: exercice.exerciceSeance.tempsReposSec
            if (reposSec > 0) startRestTimer(reposSec)
            return
        }

        if (!isLastInBloc) {
            // Exercice suivant dans le même bloc
            val nextEx = exInBloc[idxInBloc + 1]
            val nextGlobalIdx = state.exercices.indexOfFirst { it.exerciceSeance.id == nextEx.exerciceSeance.id }
            if (nextGlobalIdx >= 0) _uiState.value = state.copy(activeExerciceIndex = nextGlobalIdx)
            val reposSec = reposOverrideSec ?: if (isAlternating) bloc.tempsReposInterSec else exercice.exerciceSeance.tempsReposSec
            if (reposSec > 0) startRestTimer(reposSec)
            return
        }

        // ── Dernier exercice du bloc ──────────────────────────────────────────
        val allBlocSeriesDone = exInBloc.all { ex ->
            val s = state.seriesParExercice[ex.exerciceSeance.id] ?: emptyList()
            s.size >= ex.exerciceSeance.nombreSeriesPrevues && s.all { it.isCompleted }
        }

        val lastBlocGlobalIdx = state.exercices.indexOfLast { it.exerciceSeance.blocId == blocId }
        val nextGroupIdx = lastBlocGlobalIdx + 1

        if (allBlocSeriesDone || !isAlternating) {
            // Bloc terminé → naviguer immédiatement vers bloc/exercice suivant, puis timer de repos
            // Pour les blocs non-alternants (ACTIVATION, ECHAUFFEMENT, RECUPERATION), on avance
            // toujours dès que le dernier exercice est terminé, même si des séries ont été ignorées.
            if (nextGroupIdx < state.exercices.size) {
                val reposSec = reposOverrideSec ?: if (isAlternating) bloc.tempsReposFinRoundSec else exercice.exerciceSeance.tempsReposSec
                _uiState.value = state.copy(activeExerciceIndex = nextGroupIdx)
                if (reposSec > 0) startRestTimer(reposSec)
            }
        } else {
            // Rounds restants (SUPERSET/CIRCUIT uniquement) → retour au premier du bloc
            val firstEx = exInBloc.first()
            val firstGlobalIdx = state.exercices.indexOfFirst { it.exerciceSeance.id == firstEx.exerciceSeance.id }
            if (firstGlobalIdx >= 0) _uiState.value = state.copy(activeExerciceIndex = firstGlobalIdx)
            val reposSec = reposOverrideSec ?: bloc.tempsReposFinRoundSec
            if (reposSec > 0) startRestTimer(reposSec)
        }
    }

    fun navigateAfterRest() {
        val circuit = _uiState.value.circuitMode
        if (circuit is CircuitPhase.Repos) { onCircuitReposFini(); return }
        // La navigation normale est désormais immédiate — rien à faire ici
    }

    // ===== Timers =====

    private val _lastManualTimerSeconds = MutableStateFlow(30)
    val lastManualTimerSeconds: StateFlow<Int> = _lastManualTimerSeconds.asStateFlow()

    fun startManualTimer(seconds: Int) {
        _lastManualTimerSeconds.value = seconds
        activeSessionManager.startRestTimer(seconds)
    }

    fun startRestTimer(seconds: Int) = activeSessionManager.startRestTimer(seconds)
    fun adjustRestTimer(delta: Int) = activeSessionManager.adjustRestTimer(delta)
    fun stopRestTimer() = activeSessionManager.stopRestTimer()

    // ===== Mode Circuit automatique =====

    /** Lance le circuit avec décompte 3-2-1 avant le premier exercice. */
    fun startCircuit(firstExerciceId: Long) {
        val state = _uiState.value
        val exercice = state.exercices.find { it.exerciceSeance.id == firstExerciceId } ?: return
        if (exercice.exerciceSeance.repsCibles.toIntOrNull() == null) return
        val globalIdx = state.exercices.indexOfFirst { it.exerciceSeance.id == firstExerciceId }
        val blocId = exercice.exerciceSeance.blocId
        val bloc = blocId?.let { bid -> state.blocs.find { it.id == bid } }
        val exInBloc = if (blocId != null)
            state.exercices.filter { it.exerciceSeance.blocId == blocId }.sortedBy { it.exerciceSeance.position }
        else listOf(exercice)
        val idxInBloc = exInBloc.indexOfFirst { it.exerciceSeance.id == firstExerciceId }

        countdownJob?.cancel()
        countdownJob = viewModelScope.launch {
            for (i in 3 downTo 1) {
                _uiState.value = _uiState.value.copy(countdownSeconds = i, activeExerciceIndex = globalIdx)
                delay(1000L)
            }
            _uiState.value = _uiState.value.copy(countdownSeconds = 0)
            startExerciceTimer(exercice, globalIdx, bloc, exInBloc, idxInBloc)
        }
    }

    /**
     * Lance le timer pour un exercice DURATION seul (hors circuit auto-enchaîné).
     * Après le timer : auto-valide la série et délègue à navigateToNext() pour le repos/navigation.
     * Chaque exercice doit être démarré manuellement — pas d'auto-démarrage du suivant.
     */
    fun startExerciceSeul(exerciceId: Long, durationOverride: Int? = null) {
        val state = _uiState.value
        val exercice = state.exercices.find { it.exerciceSeance.id == exerciceId } ?: return
        val completedCount = state.seriesParExercice[exerciceId]?.count { it.isCompleted } ?: 0
        val nextIncomplete = state.seriesParExercice[exerciceId]?.firstOrNull { !it.isCompleted }
        val seconds = durationOverride?.takeIf { it > 0 }
            ?: nextIncomplete?.repsRealisees?.takeIf { it > 0 }
            ?: exercice.exerciceSeance.repsCibles.toIntOrNull()
            ?: return
        val globalIdx = state.exercices.indexOfFirst { it.exerciceSeance.id == exerciceId }

        countdownJob?.cancel()
        countdownJob = viewModelScope.launch {
            for (i in 3 downTo 1) {
                _uiState.value = _uiState.value.copy(countdownSeconds = i, activeExerciceIndex = globalIdx)
                delay(1000L)
            }
            _exerciceRemaining.value = seconds
            _uiState.value = _uiState.value.copy(
                countdownSeconds = 0,
                activeExerciceIndex = globalIdx,
                circuitMode = CircuitPhase.ExerciceActif(
                    exerciceId = exerciceId,
                    exerciceName = exercice.exercise.name,
                    numeroSerie = completedCount + 1,
                    totalSeries = exercice.exerciceSeance.nombreSeriesPrevues,
                    positionInBloc = 1,
                    totalInBloc = 1,
                ),
            )
            _exerciceStartBeep.tryEmit(Unit)
            exerciceTimerJob?.cancel()
            exerciceTimerJob = launch {
                while (_exerciceRemaining.value > 0) {
                    delay(1000L)
                    _exerciceRemaining.value = (_exerciceRemaining.value - 1).coerceAtLeast(0)
                    val newVal = _exerciceRemaining.value
                    if (newVal in 1..5) _exerciceBeep.tryEmit(newVal)
                }
                _exerciceEndBeep.tryEmit(Unit)
                // Auto-valider la série et laisser la navigation normale gérer la suite
                val currentSeriesSeul = _uiState.value.seriesParExercice[exerciceId] ?: emptyList()
                val serieNum = currentSeriesSeul.count { it.isCompleted } + 1
                val nextIncompleteSeul = currentSeriesSeul.firstOrNull { !it.isCompleted }
                if (serieNum <= exercice.exerciceSeance.nombreSeriesPrevues) {
                    updateSerie(exerciceId, serieNum, seconds, nextIncompleteSeul?.chargeLabel, nextIncompleteSeul?.chargeKg, null)
                }
                _uiState.value = _uiState.value.copy(circuitMode = null)
                navigateToNext(exerciceId) // repos + navigation selon le type de bloc
            }
        }
    }

    /** Arrête le circuit ou le timer seul (annulation manuelle). */
    fun stopCircuit() {
        countdownJob?.cancel()
        countdownJob = null
        _uiState.value = _uiState.value.copy(countdownSeconds = 0)
        exerciceTimerJob?.cancel()
        exerciceTimerJob = null
        _exerciceRemaining.value = 0
        activeSessionManager.stopRestTimer()
        _uiState.value = _uiState.value.copy(circuitMode = null)
    }

    private fun startExerciceTimer(
        exercice: ExerciceSeanceWithExercise,
        globalIdx: Int,
        bloc: BlocSeanceEntity?,
        exInBloc: List<ExerciceSeanceWithExercise>,
        idxInBloc: Int,
    ) {
        val exerciceId = exercice.exerciceSeance.id
        val state = _uiState.value
        val nextIncomplete = state.seriesParExercice[exerciceId]?.firstOrNull { !it.isCompleted }
        val seconds = nextIncomplete?.repsRealisees?.takeIf { it > 0 }
            ?: exercice.exerciceSeance.repsCibles.toIntOrNull()
            ?: return
        val completedCount = state.seriesParExercice[exerciceId]?.count { it.isCompleted } ?: 0
        _exerciceRemaining.value = seconds
        _uiState.value = state.copy(
            activeExerciceIndex = globalIdx,
            circuitMode = CircuitPhase.ExerciceActif(
                exerciceId = exercice.exerciceSeance.id,
                exerciceName = exercice.exercise.name,
                numeroSerie = completedCount + 1,
                totalSeries = exercice.exerciceSeance.nombreSeriesPrevues,
                positionInBloc = idxInBloc + 1,
                totalInBloc = exInBloc.size,
            ),
        )
        exerciceTimerJob?.cancel()
        exerciceTimerJob = viewModelScope.launch {
            while (_exerciceRemaining.value > 0) {
                delay(1000L)
                _exerciceRemaining.value = (_exerciceRemaining.value - 1).coerceAtLeast(0)
                val newVal = _exerciceRemaining.value
                if (newVal in 1..5) _exerciceBeep.tryEmit(newVal)
            }
            onCircuitExerciceFinished(exercice, bloc, exInBloc, idxInBloc)
        }
    }

    private fun onCircuitExerciceFinished(
        exercice: ExerciceSeanceWithExercise,
        bloc: BlocSeanceEntity?,
        exInBloc: List<ExerciceSeanceWithExercise>,
        idxInBloc: Int,
    ) {
        val exerciceId = exercice.exerciceSeance.id
        // Auto-valider la série qui vient de se terminer
        val currentSeries = _uiState.value.seriesParExercice[exerciceId] ?: emptyList()
        val serieNum = currentSeries.count { it.isCompleted } + 1
        if (serieNum <= exercice.exerciceSeance.nombreSeriesPrevues) {
            val nextIncomplete = currentSeries.firstOrNull { !it.isCompleted }
            val reps = nextIncomplete?.repsRealisees?.takeIf { it > 0 }
                ?: exercice.exerciceSeance.repsCibles.toIntOrNull()
            updateSerie(exerciceId, serieNum, reps, nextIncomplete?.chargeLabel, nextIncomplete?.chargeKg, null)
        }

        val isLastInBloc = idxInBloc == exInBloc.size - 1

        if (!isLastInBloc) {
            // Exercice suivant dans le même bloc → repos inter
            val nextEx = exInBloc[idxInBloc + 1]
            pendingCircuitExerciceId = nextEx.exerciceSeance.id
            _uiState.value = _uiState.value.copy(
                circuitMode = CircuitPhase.Repos(
                    nextExerciceName = nextEx.exercise.name,
                    isFinDeRound = false,
                ),
            )
            val reposSec = bloc?.tempsReposInterSec ?: 0
            if (reposSec > 0) startRestTimer(reposSec) else onCircuitReposFini()
        } else {
            // Dernier exercice du bloc — vérifier si tous les rounds sont terminés
            val updatedState = _uiState.value
            val allDone = exInBloc.all { ex ->
                val s = updatedState.seriesParExercice[ex.exerciceSeance.id] ?: emptyList()
                s.size >= ex.exerciceSeance.nombreSeriesPrevues && s.all { it.isCompleted }
            }
            if (allDone) {
                // Circuit terminé → passer au groupe suivant
                val lastGlobalIdx = updatedState.exercices.indexOfLast {
                    if (bloc != null) it.exerciceSeance.blocId == bloc.id
                    else it.exerciceSeance.id == exercice.exerciceSeance.id
                }
                val nextGroupIdx = lastGlobalIdx + 1
                _uiState.value = updatedState.copy(circuitMode = null)
                if (nextGroupIdx < updatedState.exercices.size) {
                    _uiState.value = _uiState.value.copy(activeExerciceIndex = nextGroupIdx)
                }
            } else {
                // Rounds restants → repos fin de round puis retour au premier exercice
                val firstEx = exInBloc.first()
                pendingCircuitExerciceId = firstEx.exerciceSeance.id
                _uiState.value = _uiState.value.copy(
                    circuitMode = CircuitPhase.Repos(
                        nextExerciceName = firstEx.exercise.name,
                        isFinDeRound = true,
                    ),
                )
                val reposSec = bloc?.tempsReposFinRoundSec ?: 0
                if (reposSec > 0) startRestTimer(reposSec) else onCircuitReposFini()
            }
        }
    }

    fun onCircuitReposFini() {
        val nextId = pendingCircuitExerciceId ?: return
        pendingCircuitExerciceId = null
        val state = _uiState.value
        val exercice = state.exercices.find { it.exerciceSeance.id == nextId } ?: return
        val blocId = exercice.exerciceSeance.blocId
        val bloc = blocId?.let { bid -> state.blocs.find { b -> b.id == bid } }
        val exInBloc = if (blocId != null)
            state.exercices.filter { it.exerciceSeance.blocId == blocId }.sortedBy { it.exerciceSeance.position }
        else
            listOf(exercice)
        val globalIdx = state.exercices.indexOfFirst { it.exerciceSeance.id == nextId }
        val idxInBloc = exInBloc.indexOfFirst { it.exerciceSeance.id == nextId }
        startExerciceTimer(exercice, globalIdx, bloc, exInBloc, idxInBloc)
    }

    // ===== Séries =====

    fun updateSerie(
        exerciceSeanceId: Long,
        numeroSerie: Int,
        reps: Int?,
        chargeLabel: String?,
        chargeKg: Float?,
        rpe: Float?,
    ) {
        val state = _uiState.value
        val seriesExercice = state.seriesParExercice[exerciceSeanceId]?.toMutableList() ?: mutableListOf()
        val index = seriesExercice.indexOfFirst { it.numeroSerie == numeroSerie }
        val updated = SerieRealiseeState(
            id = if (index >= 0) seriesExercice[index].id else 0,
            numeroSerie = numeroSerie,
            repsRealisees = reps,
            chargeKg = chargeKg,
            chargeLabel = chargeLabel,
            rpe = rpe,
            isCompleted = true,
            isPreFilled = false,
        )
        if (index >= 0) seriesExercice[index] = updated else seriesExercice.add(updated)

        // Propager la charge aux séries suivantes non-complétées (évite le "poids disparaît")
        if (chargeLabel != null) {
            for (i in seriesExercice.indices) {
                val s = seriesExercice[i]
                if (s.numeroSerie > numeroSerie && !s.isCompleted) {
                    seriesExercice[i] = s.copy(chargeLabel = chargeLabel, chargeKg = chargeKg, isPreFilled = true)
                }
            }
        }

        val newMap = state.seriesParExercice.toMutableMap()
        newMap[exerciceSeanceId] = seriesExercice.sortedBy { it.numeroSerie }

        val allDone = state.exercices.all { ex ->
            val series = newMap[ex.exerciceSeance.id] ?: emptyList()
            series.size >= ex.exerciceSeance.nombreSeriesPrevues && series.all { it.isCompleted }
        }

        _uiState.value = state.copy(seriesParExercice = newMap, isCompleted = allDone, isDirty = true)
        persistSerie(exerciceSeanceId, updated)

        // Première série validée : enregistrer la session comme active
        if (activeSessionManager.activeInstanceId.value != instanceId) {
            val seanceName = state.seance?.nom ?: ""
            activeSessionManager.resumeSession(instanceId = instanceId, seanceName = seanceName, currentSeconds = 0)
        }
    }

    fun unvalidateSerie(exerciceSeanceId: Long, numeroSerie: Int) {
        val state = _uiState.value
        val seriesExercice = state.seriesParExercice[exerciceSeanceId]?.toMutableList() ?: return
        val idx = seriesExercice.indexOfFirst { it.numeroSerie == numeroSerie }
        if (idx < 0) return
        val serie = seriesExercice[idx]
        val updated = serie.copy(isCompleted = false)
        seriesExercice[idx] = updated
        val newMap = state.seriesParExercice.toMutableMap()
        newMap[exerciceSeanceId] = seriesExercice
        _uiState.value = state.copy(seriesParExercice = newMap, isCompleted = false, isDirty = true)
        if (serie.id != 0L) {
            viewModelScope.launch {
                instanceSeanceDao.updateSerie(
                    SerieRealiseeEntity(
                        id = serie.id,
                        instanceSeanceId = instanceId,
                        exerciceSeanceId = exerciceSeanceId,
                        numeroSerie = serie.numeroSerie,
                        repsRealisees = serie.repsRealisees,
                        chargeKg = serie.chargeKg,
                        chargeLabel = serie.chargeLabel,
                        rpe = serie.rpe,
                        isCompleted = false,
                    ),
                )
            }
        }
    }

    private fun persistSerie(exerciceSeanceId: Long, serie: SerieRealiseeState) {
        viewModelScope.launch {
            val entity = SerieRealiseeEntity(
                id = serie.id,
                instanceSeanceId = instanceId,
                exerciceSeanceId = exerciceSeanceId,
                numeroSerie = serie.numeroSerie,
                repsRealisees = serie.repsRealisees,
                chargeKg = serie.chargeKg,
                chargeLabel = serie.chargeLabel,
                rpe = serie.rpe,
                isCompleted = serie.isCompleted,
            )
            if (serie.id == 0L) {
                val newId = instanceSeanceDao.insertSerie(entity)
                val state = _uiState.value
                val seriesExercice = state.seriesParExercice[exerciceSeanceId]?.toMutableList() ?: return@launch
                val idx = seriesExercice.indexOfFirst { it.numeroSerie == serie.numeroSerie && it.id == 0L }
                if (idx >= 0) seriesExercice[idx] = seriesExercice[idx].copy(id = newId)
                val newMap = state.seriesParExercice.toMutableMap()
                newMap[exerciceSeanceId] = seriesExercice
                _uiState.value = state.copy(seriesParExercice = newMap)
            } else {
                instanceSeanceDao.updateSerie(entity)
            }
        }
    }

    fun addSerie(exerciceSeanceId: Long) {
        val state = _uiState.value
        val seriesExercice = state.seriesParExercice[exerciceSeanceId]?.toMutableList() ?: mutableListOf()
        val nextNum = (seriesExercice.maxOfOrNull { it.numeroSerie } ?: 0) + 1
        val last = seriesExercice.lastOrNull()
        seriesExercice.add(
            SerieRealiseeState(
                numeroSerie = nextNum,
                repsRealisees = last?.repsRealisees,
                chargeKg = last?.chargeKg,
                chargeLabel = last?.chargeLabel,
                rpe = null,
                isCompleted = false,
                isPreFilled = last != null,
            ),
        )
        // Incrémenter nombreSeriesPrevues en mémoire immédiatement (évite race condition sur appels rapides)
        val exerciceSeance = state.exercices.find { it.exerciceSeance.id == exerciceSeanceId }?.exerciceSeance
        val updatedExercices = state.exercices.map { ex ->
            if (ex.exerciceSeance.id == exerciceSeanceId && exerciceSeance != null)
                ex.copy(exerciceSeance = ex.exerciceSeance.copy(nombreSeriesPrevues = exerciceSeance.nombreSeriesPrevues + 1))
            else ex
        }
        _uiState.value = state.copy(
            exercices = updatedExercices,
            seriesParExercice = state.seriesParExercice.toMutableMap().apply {
                put(exerciceSeanceId, seriesExercice)
            },
            isDirty = true,
        )
        // Persister en Room pour que "Modifier exercices" et un éventuel reload() reflètent le bon nombre
        if (exerciceSeance != null) {
            viewModelScope.launch {
                seanceDao.updateExerciceSeance(
                    exerciceSeance.copy(nombreSeriesPrevues = exerciceSeance.nombreSeriesPrevues + 1)
                )
            }
        }
    }

    fun removeSerie(exerciceSeanceId: Long) {
        val state = _uiState.value
        val seriesExercice = state.seriesParExercice[exerciceSeanceId]?.toMutableList()
        if (seriesExercice.isNullOrEmpty()) return
        val toRemove = seriesExercice.last()
        val exerciceSeance = state.exercices.find { it.exerciceSeance.id == exerciceSeanceId }?.exerciceSeance

        viewModelScope.launch {
            // Supprimer de la table series_realisees si déjà persistée
            if (toRemove.id != 0L) {
                instanceSeanceDao.deleteSerie(
                    SerieRealiseeEntity(
                        id = toRemove.id,
                        instanceSeanceId = instanceId,
                        exerciceSeanceId = exerciceSeanceId,
                        numeroSerie = toRemove.numeroSerie,
                        repsRealisees = toRemove.repsRealisees,
                        chargeKg = toRemove.chargeKg,
                        chargeLabel = toRemove.chargeLabel,
                        rpe = toRemove.rpe,
                        isCompleted = toRemove.isCompleted,
                    ),
                )
            }
            // Décrémenter nombreSeriesPrevues pour que "Modifier exercices" et reload() voient le bon nombre
            if (exerciceSeance != null && exerciceSeance.nombreSeriesPrevues > 1) {
                seanceDao.updateExerciceSeance(
                    exerciceSeance.copy(nombreSeriesPrevues = exerciceSeance.nombreSeriesPrevues - 1)
                )
            }
        }

        seriesExercice.remove(toRemove)

        // Mettre à jour exercices en mémoire immédiatement (évite race condition sur suppressions rapides)
        val updatedExercices = state.exercices.map { ex ->
            if (ex.exerciceSeance.id == exerciceSeanceId && exerciceSeance != null && exerciceSeance.nombreSeriesPrevues > 1)
                ex.copy(exerciceSeance = ex.exerciceSeance.copy(nombreSeriesPrevues = exerciceSeance.nombreSeriesPrevues - 1))
            else ex
        }

        _uiState.value = state.copy(
            exercices = updatedExercices,
            seriesParExercice = state.seriesParExercice.toMutableMap().apply {
                put(exerciceSeanceId, seriesExercice)
            },
        )
    }

    // ===== Notes séance =====

    private var notesJob: Job? = null
    fun updateNotes(notes: String) {
        val inst = _uiState.value.instance ?: return
        _uiState.value = _uiState.value.copy(instance = inst.copy(notes = notes))
        notesJob?.cancel()
        notesJob = viewModelScope.launch {
            delay(400L)
            val current = _uiState.value.instance ?: return@launch
            instanceSeanceDao.updateInstance(current)
        }
    }

    // ===== Notes par exercice (local, persiste pendant la session) =====

    fun updateExerciceNote(exerciceId: Long, note: String) {
        val current = _uiState.value.exerciceNotesLocal.toMutableMap()
        current[exerciceId] = note
        _uiState.value = _uiState.value.copy(exerciceNotesLocal = current)
    }

    fun updateSeanceName(nom: String) {
        viewModelScope.launch {
            val seance = _uiState.value.seance ?: return@launch
            val updated = seance.copy(nom = nom, updatedAt = LocalDateTime.now())
            seanceDao.updateSeance(updated)
            _uiState.value = _uiState.value.copy(seance = updated)
        }
    }

    fun cancelInstance() {
        countdownJob?.cancel()
        countdownJob = null
        exerciceTimerJob?.cancel()
        exerciceTimerJob = null
        _exerciceRemaining.value = 0
        _uiState.value = _uiState.value.copy(circuitMode = null, countdownSeconds = 0)
        viewModelScope.launch {
            instanceSeanceDao.deleteAllSeriesForInstance(instanceId)
            activeSessionManager.stopRestTimer()
            activeSessionManager.endSession()
            // Les blocs/exercices de l'instance restent : ils servent de template de la séance à réaliser.
            // Seules les séries saisies sont supprimées (annulation de la progression).
        }
    }

    fun deleteInstance() {
        viewModelScope.launch {
            val inst = _uiState.value.instance ?: return@launch
            activeSessionManager.stopRestTimer()
            activeSessionManager.endSession()
            seanceDao.deleteBlocsForInstance(instanceId)
            seanceDao.deleteExercicesForInstance(instanceId)
            instanceSeanceDao.deleteInstance(inst)
        }
    }

    fun finishInstance() {
        countdownJob?.cancel()
        countdownJob = null
        exerciceTimerJob?.cancel()
        exerciceTimerJob = null
        _exerciceRemaining.value = 0
        viewModelScope.launch {
            val durationSec = activeSessionManager.sessionSeconds.value
            instanceSeanceDao.updateCompletion(instanceId, true, LocalDateTime.now(), durationSec)
            _uiState.value = _uiState.value.copy(isCompleted = true, circuitMode = null)
            activeSessionManager.endSession()
        }
    }
}
