package com.pandafit.feature.strength.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.ActiveSessionManager
import com.pandafit.core.database.catalog.EquipmentCategory
import com.pandafit.core.database.catalog.EquipmentInventaire
import com.pandafit.core.database.catalog.EquipmentRepository
import com.pandafit.core.database.catalog.chargesAtteignablesPourEquipement
import com.pandafit.core.database.catalog.rawEquipmentToCategory
import com.pandafit.core.database.dao.InstanceSeanceDao
import com.pandafit.core.database.dao.ObjectifProgressionDao
import com.pandafit.core.database.dao.SeanceDao
import com.pandafit.core.database.entities.BlocSeanceEntity
import com.pandafit.core.database.entities.BlocType
import com.pandafit.core.database.entities.ExerciceSeanceEntity
import com.pandafit.core.database.entities.ObjectifProgressionEntity
import com.pandafit.core.database.entities.RepsType
import com.pandafit.core.database.entities.SerieRealiseeEntity
import com.pandafit.core.database.progression.CibleExercice
import com.pandafit.core.database.progression.PropositionProgression
import com.pandafit.core.database.progression.StatutExercice
import com.pandafit.core.database.progression.WarmupPalier
import com.pandafit.core.database.progression.WarmupProtocole
import com.pandafit.core.database.progression.evaluerExercice
import com.pandafit.core.database.progression.proposerMontee
import com.pandafit.core.database.progression.requiresValidation
import com.pandafit.core.database.relations.ExerciceSeanceWithExercise
import com.pandafit.core.database.relations.SeanceFull
import com.pandafit.feature.strength.model.ChoixValidation
import com.pandafit.feature.strength.model.CircuitPhase
import com.pandafit.feature.strength.model.InstanceExecuteUiState
import com.pandafit.feature.strength.model.PropositionAffichee
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
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime
import javax.inject.Inject

@HiltViewModel
class InstanceExecuteViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val seanceDao: SeanceDao,
    private val instanceSeanceDao: InstanceSeanceDao,
    private val objectifProgressionDao: ObjectifProgressionDao,
    private val equipmentRepository: EquipmentRepository,
    val activeSessionManager: ActiveSessionManager,
) : ViewModel() {

    val instanceId: Long = requireNotNull(savedStateHandle.get<String>("instanceId")?.toLongOrNull())
    private val _uiState = MutableStateFlow(InstanceExecuteUiState())
    val uiState: StateFlow<InstanceExecuteUiState> = _uiState.asStateFlow()

    // Le chrono et le timer de repos sont gérés par ActiveSessionManager (survivent à la navigation)
    val sessionSeconds: StateFlow<Int> = activeSessionManager.sessionSeconds
    val isSessionActive: StateFlow<Boolean> = activeSessionManager.activeInstanceId
        .map { it == instanceId }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), activeSessionManager.activeInstanceId.value == instanceId)
    val restRemaining: StateFlow<Int> = activeSessionManager.restRemaining
    val restFinishedEvent: SharedFlow<Unit> = activeSessionManager.restFinishedEvent
    val restCountdownBeep: SharedFlow<Int> = activeSessionManager.restCountdownBeep

    private val _exerciceBeep = MutableSharedFlow<Int>(extraBufferCapacity = 5)
    val exerciceBeep: SharedFlow<Int> = _exerciceBeep.asSharedFlow()

    private val _exerciceStartBeep = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val exerciceStartBeep: SharedFlow<Unit> = _exerciceStartBeep.asSharedFlow()

    private val _finishedEvent = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val finishedEvent: SharedFlow<Unit> = _finishedEvent.asSharedFlow()

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
            val exercices = rafraichirCiblesProgression(
                seanceId = instance.seanceId,
                figerCible = instance.isCompleted,
                exercices = buildOrderedExercicesFromLists(seanceDao.getExercicesForInstance(instanceId), blocs),
            )
            val progressionPreview = calculerProgressionPreview(instance.seanceId, exercices)
            val equipmentInventaire = equipmentRepository.inventaire.first()

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

                val isBilateral = ex.exerciceSeance.isBilateral
                val slotsPerRound = if (isBilateral) 2 else 1
                val baseNums = (1..ex.exerciceSeance.nombreSeriesPrevues * slotsPerRound).toList()
                val extraNums = existingSeries.map { it.numeroSerie }
                    .filter { it > ex.exerciceSeance.nombreSeriesPrevues * slotsPerRound }
                val allNums = (baseNums + extraNums).distinct().sorted()

                seriesParExercice[exerciceId] = allNums.map { num ->
                    val db = dbMap[num]
                    // Pour les bilatéraux : slot impair = "G", pair = "D"
                    val side = if (isBilateral) (if (num % 2 == 1) "G" else "D") else ""
                    if (db != null) {
                        SerieRealiseeState(
                            id = db.id, numeroSerie = db.numeroSerie,
                            repsRealisees = db.repsRealisees, chargeKg = db.chargeKg,
                            chargeLabel = db.chargeLabel, rpe = db.rpe,
                            isCompleted = db.isCompleted, isPreFilled = false,
                            notes = db.notes.ifBlank { side },
                        )
                    } else {
                        // Pour l'historique bilateral, on cherche la série du même côté
                        val histoNum = if (isBilateral) ((num + 1) / 2) else num
                        val histo = historiqueEx?.find { h ->
                            if (isBilateral) h.numeroSerie == histoNum && h.notes == side
                            else h.numeroSerie == num
                        } ?: if (isBilateral) historiqueEx?.find { it.numeroSerie == histoNum } else null
                        // En progression activée, la cible (déjà rafraîchie depuis l'objectif courant)
                        // prime toujours sur le réalisé précédent — sinon le réalisé d'hier (qui correspond
                        // à l'ancienne cible, par définition) masquerait systématiquement la nouvelle cible.
                        val progression = ex.exerciceSeance.progressionActivee
                        SerieRealiseeState(
                            numeroSerie = num,
                            repsRealisees = if (progression) templateReps else histo?.repsRealisees ?: templateReps,
                            chargeKg = if (progression) templateChargeKg else histo?.chargeKg ?: lastCompletedCharge?.chargeKg ?: templateChargeKg,
                            chargeLabel = if (progression) templateChargeLabel else histo?.chargeLabel ?: lastCompletedCharge?.chargeLabel ?: templateChargeLabel,
                            rpe = null, isCompleted = false, isPreFilled = true,
                            notes = side,
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
                progressionPreview = progressionPreview,
                equipmentInventaire = equipmentInventaire,
            )

            // Le chrono ne démarre que sur action explicite (bouton "Démarrer" ou 1ère série
            // validée, cf. updateSerie) — sauf s'il était déjà actif, ou si des séries existent
            // déjà (reprise d'une séance commencée sur un autre écran/appareil).
            val alreadyActive = activeSessionManager.activeInstanceId.value == instanceId
            val hasSeriesDeja = seriesParExercice.values.any { series -> series.any { it.isCompleted } }
            if (!instance.isCompleted && !alreadyActive && hasSeriesDeja) {
                activeSessionManager.resumeSession(
                    instanceId = instanceId,
                    seanceName = seance?.nom ?: "",
                    currentSeconds = 0,
                )
            }
        }
    }

    fun startSession() {
        if (_uiState.value.isCompleted) return
        activeSessionManager.resumeSession(
            instanceId = instanceId,
            seanceName = _uiState.value.seance?.nom ?: "",
            currentSeconds = 0,
        )
    }

    // Synchronise chargeCible/repsCibles de la copie d'instance avec l'objectif courant (table objectifs_progression)
    // pour les exercices en progression_activee — la cible peut avoir évolué depuis l'assignation de l'instance.
    // Si l'instance est déjà clôturée, on ne retouche jamais le rapport figé (bible §0.1, exception).
    private suspend fun rafraichirCiblesProgression(
        seanceId: Long,
        figerCible: Boolean,
        exercices: List<ExerciceSeanceWithExercise>,
    ): List<ExerciceSeanceWithExercise> {
        if (figerCible) return exercices
        return exercices.map { exWithEx ->
            val es = exWithEx.exerciceSeance
            if (!es.progressionActivee) return@map exWithEx
            val objectif = objectifProgressionDao.getBySeanceAndExercice(seanceId, exWithEx.exercise.id) ?: return@map exWithEx
            val nouvelleChargeCible = formatChargeCibleFraiche(objectif.chargeCible) ?: es.chargeCible
            val nouveauxRepsCibles = when (es.repsType) {
                RepsType.DURATION -> objectif.dureeCibleSec?.toString() ?: es.repsCibles
                RepsType.REPS -> objectif.repsCible?.toString() ?: es.repsCibles
            }
            if (nouvelleChargeCible == es.chargeCible && nouveauxRepsCibles == es.repsCibles) return@map exWithEx
            val miseAJour = es.copy(chargeCible = nouvelleChargeCible, repsCibles = nouveauxRepsCibles)
            seanceDao.updateExerciceSeance(miseAJour)
            exWithEx.copy(exerciceSeance = miseAJour)
        }
    }

    private fun formatChargeCibleFraiche(chargeKg: Float?): String? {
        if (chargeKg == null) return null
        return if (chargeKg == chargeKg.toInt().toFloat()) "${chargeKg.toInt()} kg" else "$chargeKg kg"
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
        val bilateralMultiplier = if (exercice.exerciceSeance.isBilateral) 2 else 1
        val exerciceComplete = series.size >= exercice.exerciceSeance.nombreSeriesPrevues * bilateralMultiplier
                && series.all { it.isCompleted }

        // ── Exercice libre (pas dans un bloc) ────────────────────────────────
        if (blocId == null) {
            val reposSec = reposOverrideSec ?: exercice.exerciceSeance.tempsReposSec
            if (!exerciceComplete) {
                // Repos inter-séries uniquement, pas de navigation
                // Bilatéral : pas de repos entre G et D du même round
                val lastCompleted = series.lastOrNull { it.isCompleted }
                val skipRest = exercice.exerciceSeance.isBilateral && lastCompleted?.notes == "G"
                if (!skipRest && reposSec > 0) startRestTimer(reposSec)
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

        // Un exercice du bloc peut avoir un nombre de séries différent des autres (ex. progression
        // "+1 série" sur un exercice PDC en superset) — on ignore les exercices déjà à leur quota
        // pour ne pas leur imposer un round supplémentaire non voulu.
        fun estCompletDansBloc(ex: ExerciceSeanceWithExercise): Boolean {
            val s = state.seriesParExercice[ex.exerciceSeance.id] ?: emptyList()
            val mult = if (ex.exerciceSeance.isBilateral) 2 else 1
            return s.size >= ex.exerciceSeance.nombreSeriesPrevues * mult && s.all { it.isCompleted }
        }

        val prochainNonComplet = exInBloc.drop(idxInBloc + 1).firstOrNull { !estCompletDansBloc(it) }
        val isLastInBloc = prochainNonComplet == null

        // SUPERSET/CIRCUIT : alternance → naviguer après chaque série
        // Autres blocs (ECHAUFFEMENT, RECUPERATION) : naviguer seulement quand l'exercice est terminé
        val isAlternating = bloc.type == BlocType.SUPERSET || bloc.type == BlocType.CIRCUIT
        if (!isAlternating && !exerciceComplete) {
            // Repos inter-séries pour blocs non-alternés, sans navigation
            // Bilatéral : pas de repos entre G et D du même round
            val reposSec = reposOverrideSec ?: exercice.exerciceSeance.tempsReposSec
            val lastCompleted = series.lastOrNull { it.isCompleted }
            val skipRest = exercice.exerciceSeance.isBilateral && lastCompleted?.notes == "G"
            if (!skipRest && reposSec > 0) startRestTimer(reposSec)
            return
        }

        // Bilatéral dans un bloc alternant (SUPERSET/CIRCUIT) : côté G terminé → attendre le D
        // avant d'alterner vers l'exercice suivant du bloc.
        if (isAlternating && exercice.exerciceSeance.isBilateral) {
            val lastCompleted = series.lastOrNull { it.isCompleted }
            if (lastCompleted?.notes == "G") return
        }

        if (!isLastInBloc) {
            // Exercice suivant non complet dans le même bloc (saute ceux déjà à leur quota de séries)
            val nextEx = prochainNonComplet!!
            val nextGlobalIdx = state.exercices.indexOfFirst { it.exerciceSeance.id == nextEx.exerciceSeance.id }
            if (nextGlobalIdx >= 0) _uiState.value = state.copy(activeExerciceIndex = nextGlobalIdx)
            val reposSec = reposOverrideSec ?: if (isAlternating) bloc.tempsReposInterSec else exercice.exerciceSeance.tempsReposSec
            if (reposSec > 0) startRestTimer(reposSec)
            return
        }

        // ── Dernier exercice du bloc ──────────────────────────────────────────
        val allBlocSeriesDone = exInBloc.all(::estCompletDansBloc)

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
            // Rounds restants (SUPERSET/CIRCUIT uniquement) → retour au premier exercice du bloc
            // pas encore à son quota de séries (saute ceux déjà terminés, ex. exercice PDC en avance)
            val firstEx = exInBloc.firstOrNull { !estCompletDansBloc(it) } ?: exInBloc.first()
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
        val isBilateral = exercice.exerciceSeance.isBilateral
        // Pour bilatéral : numéro de round = completedCount/2 + 1 ; côté = G si slot impair, D si pair
        val roundNumber = if (isBilateral) (completedCount / 2) + 1 else completedCount + 1
        val sideLabel = if (isBilateral) (if (completedCount % 2 == 0) "G" else "D") else ""

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
                    numeroSerie = roundNumber,
                    totalSeries = exercice.exerciceSeance.nombreSeriesPrevues,
                    positionInBloc = 1,
                    totalInBloc = 1,
                    sideLabel = sideLabel,
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
                val bilateralMult = if (exercice.exerciceSeance.isBilateral) 2 else 1
                if (serieNum <= exercice.exerciceSeance.nombreSeriesPrevues * bilateralMult) {
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
        val existing = if (index >= 0) seriesExercice[index] else null
        val updated = SerieRealiseeState(
            id = existing?.id ?: 0,
            numeroSerie = numeroSerie,
            repsRealisees = reps,
            chargeKg = chargeKg,
            chargeLabel = chargeLabel,
            rpe = rpe,
            isCompleted = true,
            isPreFilled = false,
            notes = existing?.notes ?: "",
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
            val mult = if (ex.exerciceSeance.isBilateral) 2 else 1
            series.size >= ex.exerciceSeance.nombreSeriesPrevues * mult && series.all { it.isCompleted }
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
                        notes = serie.notes,
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
                notes = serie.notes,
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
        val exerciceSeance = state.exercices.find { it.exerciceSeance.id == exerciceSeanceId }?.exerciceSeance
        val isBilateral = exerciceSeance?.isBilateral == true
        val seriesExercice = state.seriesParExercice[exerciceSeanceId]?.toMutableList() ?: mutableListOf()
        val lastNum = seriesExercice.maxOfOrNull { it.numeroSerie } ?: 0
        val last = seriesExercice.lastOrNull()

        if (isBilateral) {
            // Ajouter un round complet G+D
            seriesExercice.add(SerieRealiseeState(
                numeroSerie = lastNum + 1,
                repsRealisees = last?.repsRealisees, chargeKg = last?.chargeKg,
                chargeLabel = last?.chargeLabel, rpe = null, isCompleted = false,
                isPreFilled = last != null, notes = "G",
            ))
            seriesExercice.add(SerieRealiseeState(
                numeroSerie = lastNum + 2,
                repsRealisees = last?.repsRealisees, chargeKg = last?.chargeKg,
                chargeLabel = last?.chargeLabel, rpe = null, isCompleted = false,
                isPreFilled = last != null, notes = "D",
            ))
        } else {
            seriesExercice.add(SerieRealiseeState(
                numeroSerie = lastNum + 1,
                repsRealisees = last?.repsRealisees, chargeKg = last?.chargeKg,
                chargeLabel = last?.chargeLabel, rpe = null, isCompleted = false,
                isPreFilled = last != null,
            ))
        }

        // Incrémenter nombreSeriesPrevues (1 round = 1 incrément, même pour le bilatéral)
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
        val exerciceSeance = state.exercices.find { it.exerciceSeance.id == exerciceSeanceId }?.exerciceSeance
        val isBilateral = exerciceSeance?.isBilateral == true

        // Pour le bilatéral : supprimer le dernier round complet (2 slots), sinon le dernier slot
        val toDelete = if (isBilateral && seriesExercice.size >= 2) {
            listOf(seriesExercice[seriesExercice.size - 1], seriesExercice[seriesExercice.size - 2])
        } else {
            listOf(seriesExercice.last())
        }

        viewModelScope.launch {
            toDelete.forEach { serie ->
                if (serie.id != 0L) {
                    instanceSeanceDao.deleteSerie(SerieRealiseeEntity(
                        id = serie.id, instanceSeanceId = instanceId,
                        exerciceSeanceId = exerciceSeanceId, numeroSerie = serie.numeroSerie,
                        repsRealisees = serie.repsRealisees, chargeKg = serie.chargeKg,
                        chargeLabel = serie.chargeLabel, rpe = serie.rpe,
                        isCompleted = serie.isCompleted, notes = serie.notes,
                    ))
                }
            }
            if (exerciceSeance != null && exerciceSeance.nombreSeriesPrevues > 1) {
                seanceDao.updateExerciceSeance(
                    exerciceSeance.copy(nombreSeriesPrevues = exerciceSeance.nombreSeriesPrevues - 1)
                )
            }
        }

        toDelete.forEach { seriesExercice.remove(it) }

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

    /** Preview "ce qui se passerait si toutes les séries restantes réussissent" pour chaque exercice
     * en progression_activee — alimente le bandeau de progression live (lecture seule, aucune écriture
     * en DB, contrairement à prepareFinish() qui clôture réellement la séance). */
    private suspend fun calculerProgressionPreview(
        seanceId: Long,
        exercices: List<ExerciceSeanceWithExercise>,
    ): Map<Long, PropositionProgression> {
        val candidats = exercices.filter { it.exerciceSeance.progressionActivee }
        if (candidats.isEmpty()) return emptyMap()
        val pasParCategorie = equipmentRepository.pasParCategorie.first()
        val inventaire = equipmentRepository.inventaire.first()
        return candidats.associate { exWithEx ->
            val es = exWithEx.exerciceSeance
            val objectif = objectifProgressionDao.getBySeanceAndExercice(seanceId, exWithEx.exercise.id)
            val cible = cibleDepuis(objectif, es)
            val pasMateriel = resolvePasMateriel(exWithEx.exercise.equipment, pasParCategorie)
            val chargesAtteignables = resolveChargesAtteignables(exWithEx.exercise.equipment, inventaire)
            es.id to proposerMontee(es, cible, 0, pasMateriel, chargesAtteignables)
        }
    }

    /** Pas simple (catégories sans inventaire structuré, ex. MACHINE) — bible §4.3. */
    private fun resolvePasMateriel(equipment: List<String>, pasParCategorie: Map<EquipmentCategory, Float>): Float? {
        val categories = equipment.mapNotNull { rawEquipmentToCategory(it) }
        return categories.mapNotNull { pasParCategorie[it] }.minOrNull()
    }

    /** Union des charges réellement composables avec l'inventaire déclaré pour cet exercice (bible §4.3). */
    private fun resolveChargesAtteignables(equipment: List<String>, inventaire: EquipmentInventaire): List<Float>? =
        inventaire.chargesAtteignablesPourEquipement(equipment).ifEmpty { null }

    // ===== Surcharge progressive — clôture =====

    /** Évalue chaque exercice en progression_activee, applique silencieusement les échecs simples
     * (cible maintenue), et prépare le récap (succès + deload proposé + anomalies) pour validation
     * utilisateur avant de clôturer. Le deload n'est jamais imposé : c'est une proposition. */
    fun prepareFinish() {
        viewModelScope.launch {
            val state = _uiState.value
            val instance = state.instance ?: return@launch
            val pasParCategorie = equipmentRepository.pasParCategorie.first()
            val inventaire = equipmentRepository.inventaire.first()
            val rows = mutableListOf<PropositionAffichee>()
            state.exercices.forEach { exWithEx ->
                val es = exWithEx.exerciceSeance
                if (!es.progressionActivee) return@forEach
                val objectifExistant = objectifProgressionDao.getBySeanceAndExercice(instance.seanceId, exWithEx.exercise.id)
                val cible = cibleDepuis(objectifExistant, es)
                val series = seriesCompletesPourEvaluation(es.id, state)
                val pasMateriel = resolvePasMateriel(exWithEx.exercise.equipment, pasParCategorie)
                val chargesAtteignables = resolveChargesAtteignables(exWithEx.exercise.equipment, inventaire)
                val proposition = evaluerExercice(es, cible, objectifExistant?.compteurEchec ?: 0, series, es.isBilateral, pasMateriel, chargesAtteignables)
                if (requiresValidation(proposition)) {
                    rows.add(PropositionAffichee(es.id, exWithEx.exercise.id, exWithEx.exercise.name, proposition, chargesAtteignables ?: emptyList()))
                } else {
                    persisterObjectif(instance.seanceId, exWithEx.exercise.id, objectifExistant, proposition)
                }
            }
            if (rows.isEmpty()) {
                finishInstance()
            } else {
                _uiState.value = _uiState.value.copy(propositionsProgression = rows)
            }
        }
    }

    fun annulerRecapProgression() {
        _uiState.value = _uiState.value.copy(propositionsProgression = emptyList())
    }

    /** Applique les choix Oui/Non/Ajuster du récap puis clôture l'instance. */
    fun validerPropositions(
        decisions: Map<Long, ChoixValidation>,
        ajustementsChargeKg: Map<Long, Float?>,
    ) {
        viewModelScope.launch {
            val instance = _uiState.value.instance ?: return@launch
            _uiState.value.propositionsProgression.forEach { row ->
                if (row.proposition.statut == StatutExercice.NON_LOGGE) return@forEach
                val existant = objectifProgressionDao.getBySeanceAndExercice(instance.seanceId, row.exerciceId)
                when (decisions[row.exerciceSeanceId] ?: ChoixValidation.OUI) {
                    ChoixValidation.OUI -> {
                        persisterObjectif(instance.seanceId, row.exerciceId, existant, row.proposition)
                        appliquerNouveauNombreSeries(row.exerciceSeanceId, row.proposition.nouveauNombreSeries)
                    }
                    ChoixValidation.NON -> persisterObjectif(
                        instance.seanceId, row.exerciceId, existant,
                        row.proposition.copy(
                            nouvelleChargeCible = existant?.chargeCible,
                            nouveauRepsCible = existant?.repsCible,
                            nouvelleDureeCible = existant?.dureeCibleSec,
                            nouveauNombreSeries = null,
                        ),
                    )
                    ChoixValidation.AJUSTER -> {
                        persisterObjectif(
                            instance.seanceId, row.exerciceId, existant,
                            row.proposition.copy(nouvelleChargeCible = ajustementsChargeKg[row.exerciceSeanceId] ?: row.proposition.nouvelleChargeCible),
                        )
                        appliquerNouveauNombreSeries(row.exerciceSeanceId, row.proposition.nouveauNombreSeries)
                    }
                }
            }
            _uiState.value = _uiState.value.copy(propositionsProgression = emptyList())
            finishInstance()
        }
    }

    private suspend fun persisterObjectif(
        seanceId: Long,
        exerciceId: Long,
        existant: ObjectifProgressionEntity?,
        proposition: PropositionProgression,
    ) {
        objectifProgressionDao.upsert(
            ObjectifProgressionEntity(
                id = existant?.id ?: 0,
                seanceId = seanceId,
                exerciceId = exerciceId,
                chargeCible = proposition.nouvelleChargeCible,
                repsCible = proposition.nouveauRepsCible,
                dureeCibleSec = proposition.nouvelleDureeCible,
                compteurEchec = proposition.nouveauCompteurEchec,
                derniereMaj = LocalDate.now(),
                nombreSeriesCible = proposition.nouveauNombreSeries,
            )
        )
    }

    /** Applique la proposition "ajout de série" (PDC au plafond de reps) sur le template de la séance. */
    private suspend fun appliquerNouveauNombreSeries(exerciceSeanceId: Long, nouveauNombreSeries: Int?) {
        if (nouveauNombreSeries == null) return
        val exerciceSeance = _uiState.value.exercices
            .find { it.exerciceSeance.id == exerciceSeanceId }
            ?.exerciceSeance ?: return
        seanceDao.updateExerciceSeance(exerciceSeance.copy(nombreSeriesPrevues = nouveauNombreSeries))
    }

    private fun cibleDepuis(objectif: ObjectifProgressionEntity?, es: ExerciceSeanceEntity): CibleExercice {
        if (objectif != null) return CibleExercice(objectif.chargeCible, objectif.repsCible, objectif.dureeCibleSec)
        val repsTemplate = es.repsCibles.toIntOrNull()
        return if (es.repsType == RepsType.DURATION) CibleExercice(chargeKg = null, reps = null, dureeSec = repsTemplate)
        else CibleExercice(chargeKg = parseChargeKg(parseChargeLabel(es.chargeCible)), reps = repsTemplate, dureeSec = null)
    }

    private fun seriesCompletesPourEvaluation(exerciceSeanceId: Long, state: InstanceExecuteUiState): List<SerieRealiseeEntity> =
        state.seriesParExercice[exerciceSeanceId]?.filter { it.isCompleted }?.map {
            SerieRealiseeEntity(
                instanceSeanceId = instanceId,
                exerciceSeanceId = exerciceSeanceId,
                numeroSerie = it.numeroSerie,
                repsRealisees = it.repsRealisees,
                chargeKg = it.chargeKg,
                chargeLabel = it.chargeLabel,
                rpe = it.rpe,
                notes = it.notes,
                isCompleted = true,
            )
        } ?: emptyList()

    // ===== Montées en charge =====

    private var warmupChronoJob: Job? = null

    fun openWarmupSheet(exerciceSeanceId: Long) {
        val state = _uiState.value
        val exWithEx = state.exercices.find { it.exerciceSeance.id == exerciceSeanceId } ?: return
        val bloc = exWithEx.exerciceSeance.blocId?.let { bid -> state.blocs.find { it.id == bid } }
        if (bloc != null && bloc.type in listOf(BlocType.ECHAUFFEMENT, BlocType.ACTIVATION, BlocType.RECUPERATION)) return
        val chargeObjectifKg = parseChargeKg(parseChargeLabel(exWithEx.exerciceSeance.chargeCible))
            ?.takeIf { it > 0f } ?: return
        val chargesAtteignables = state.equipmentInventaire
            ?.let { resolveChargesAtteignables(exWithEx.exercise.equipment, it) }
            ?: emptyList()
        val protocole = state.warmupProtocoleParExercice[exerciceSeanceId]
            ?: com.pandafit.core.database.progression.protocoleDefaut(exWithEx.exerciceSeance.typeExercice)
            ?: WarmupProtocole.STANDARD
        val paliers = com.pandafit.core.database.progression.calculerPaliers(chargeObjectifKg, protocole, chargesAtteignables)
        _uiState.value = state.copy(
            warmupExerciceId = exerciceSeanceId,
            warmupProtocoleParExercice = state.warmupProtocoleParExercice + (exerciceSeanceId to protocole),
            warmupPaliersParExercice = state.warmupPaliersParExercice + (exerciceSeanceId to paliers),
            warmupChronoSec = 0,
        )
    }

    fun closeWarmupSheet() {
        warmupChronoJob?.cancel()
        warmupChronoJob = null
        _uiState.value = _uiState.value.copy(warmupExerciceId = null, warmupChronoSec = 0)
    }

    fun changeWarmupProtocole(exerciceSeanceId: Long, protocole: WarmupProtocole) {
        val state = _uiState.value
        val exWithEx = state.exercices.find { it.exerciceSeance.id == exerciceSeanceId } ?: return
        val chargeObjectifKg = parseChargeKg(parseChargeLabel(exWithEx.exerciceSeance.chargeCible)) ?: return
        val chargesAtteignables = state.equipmentInventaire
            ?.let { resolveChargesAtteignables(exWithEx.exercise.equipment, it) }
            ?: emptyList()
        val paliers = com.pandafit.core.database.progression.calculerPaliers(chargeObjectifKg, protocole, chargesAtteignables)
        _uiState.value = state.copy(
            warmupProtocoleParExercice = state.warmupProtocoleParExercice + (exerciceSeanceId to protocole),
            warmupPaliersParExercice = state.warmupPaliersParExercice + (exerciceSeanceId to paliers),
            warmupChronoSec = 0,
        )
        warmupChronoJob?.cancel()
        warmupChronoJob = null
    }

    fun markWarmupPalierDone(exerciceSeanceId: Long, index: Int) {
        val state = _uiState.value
        val paliers = state.warmupPaliersParExercice[exerciceSeanceId]?.toMutableList() ?: return
        if (index >= paliers.size) return
        val palier = paliers[index]
        paliers[index] = palier.copy(isDone = true)
        warmupChronoJob?.cancel()
        warmupChronoJob = viewModelScope.launch {
            var remaining = palier.reposSec
            while (remaining > 0) {
                _uiState.value = _uiState.value.copy(warmupChronoSec = remaining)
                delay(1000L)
                remaining--
            }
            _uiState.value = _uiState.value.copy(warmupChronoSec = 0)
        }
        _uiState.value = state.copy(
            warmupPaliersParExercice = state.warmupPaliersParExercice + (exerciceSeanceId to paliers),
        )
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
            _finishedEvent.emit(Unit)
        }
    }
}
