package com.pandafit.feature.running.viewmodel

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.ActiveSessionManager
import com.pandafit.core.database.catalog.GpsTrackingRepository
import com.pandafit.core.database.catalog.LiveTrackState
import com.pandafit.core.database.dao.RunRepeatDao
import com.pandafit.core.database.dao.RunStepDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.RunEndType
import com.pandafit.core.database.entities.RunEndUnit
import com.pandafit.core.database.entities.RunStepEntity
import com.pandafit.core.database.entities.RunStepType
import com.pandafit.core.database.entities.RunTargetType
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.core.common.GpsSessionDefaults
import com.pandafit.feature.running.GpsTrackingController
import com.pandafit.feature.running.model.FreeStepExecution
import com.pandafit.feature.running.model.FreeStepResult
import com.pandafit.core.database.model.IntervalRepResult
import com.pandafit.feature.running.model.LivePhaseUiState
import com.pandafit.feature.running.model.RunRepeatExecution
import com.pandafit.feature.running.model.RunningExecuteUiState
import com.pandafit.feature.running.model.TimelineStatus
import com.pandafit.feature.running.model.TimelineStepUiState
import com.pandafit.feature.running.model.formatPace
import com.pandafit.feature.running.model.runStepLabel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject

private val json = Json { ignoreUnknownKeys = true }

/**
 * Libellé de la phase "rep" du cockpit live : un bloc auto-lap (splits km importés TCX) n'est pas
 * un vrai fractionné et doit s'afficher "SPLIT" plutôt que "INTERVALLE" (docs/ai/KNOWN_BUGS.md).
 */
fun repPhaseLabel(repeatCount: Int, repIdx: Int, isAutoLap: Boolean): String =
    if (isAutoLap) "SPLIT ${repIdx + 1}/$repeatCount" else "INTERVALLE ${repIdx + 1}/$repeatCount"

@HiltViewModel
class RunningExecuteViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val workoutDao: WorkoutDao,
    private val stepDao: RunStepDao,
    private val repeatDao: RunRepeatDao,
    private val sessionManager: ActiveSessionManager,
    private val gpsTrackingRepository: GpsTrackingRepository,
    private val gpsTrackingController: GpsTrackingController,
) : ViewModel() {

    /** 0 = "séance directe" en brouillon, pas encore créée en base (créée au tap "Démarrer"). */
    private var workoutId: Long = requireNotNull(savedStateHandle.get<String>("workoutId")?.toLongOrNull())

    /** true si [workoutId] a été créé automatiquement par [ensureWorkoutCreated] ("séance directe"), à supprimer si annulée. */
    private var wasAutoCreated: Boolean = false
    private var countdownJob: Job? = null
    private val _uiState = MutableStateFlow(RunningExecuteUiState())
    val uiState: StateFlow<RunningExecuteUiState> = _uiState.asStateFlow()

    val liveTrackState: StateFlow<LiveTrackState> = gpsTrackingRepository.state
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), LiveTrackState())

    /** Projection enrichie de [uiState] pour le cockpit live (phase active + timeline) : source d'affichage de l'écran. */
    val screenState: StateFlow<RunningExecuteUiState> = combine(_uiState, liveTrackState) { state, track ->
        state.copy(livePhase = computeLivePhase(state, track), timeline = computeTimeline(state))
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), RunningExecuteUiState())

    // ── Auto-lap ─────────────────────────────────────────────────────────────
    // Segments (étapes libres + course/récup de chaque répétition), à plat dans l'ordre
    // d'exécution. Construits une fois au démarrage du GPS ; l'index avance uniquement
    // vers l'avant au fil de la séance, chaque avancée réarme la ligne de base distance/durée.
    private var autoLapSegments: List<AutoLapSegment> = emptyList()
    private var autoLapIndex: Int = 0
    private var autoLapBaselineDistanceM: Double = 0.0
    private var autoLapBaselineDurationSec: Int = 0

    init {
        if (workoutId > 0L) loadWorkout() else initDraftFreeRun()

        // Collecteur indépendant du cycle de vie de l'écran (contrairement à liveTrackState,
        // qui s'arrête 5s après la dernière observation UI) pour ne jamais rater un déclenchement.
        viewModelScope.launch {
            gpsTrackingRepository.state.collect { track ->
                if (autoLapSegments.isNotEmpty() && track.isTracking && !track.isPaused) {
                    evaluateAutoLap(track)
                }
            }
        }
    }

    private fun evaluateAutoLap(track: LiveTrackState) {
        while (autoLapIndex < autoLapSegments.size) {
            val seg = autoLapSegments[autoLapIndex]
            val elapsedSec = track.durationSec - autoLapBaselineDurationSec
            val elapsedDistM = track.distanceM - autoLapBaselineDistanceM
            val elapsed = when (seg.endType) {
                RunEndType.DURATION -> elapsedSec.toDouble()
                RunEndType.DISTANCE -> elapsedDistM
            }
            val targetValue = when (seg.endType) {
                RunEndType.DURATION -> seg.endValue.toDouble()
                RunEndType.DISTANCE -> if (seg.endUnit == RunEndUnit.KM) seg.endValue * 1000.0 else seg.endValue.toDouble()
            }
            if (elapsed < targetValue) break
            completeAutoLapSegment(seg, elapsedSec, elapsedDistM)
            autoLapBaselineDistanceM = track.distanceM
            autoLapBaselineDurationSec = track.durationSec
            autoLapIndex++
        }
    }

    /** Complète un segment atteint automatiquement et encode le temps réel (+ l'allure pour une phase course) mesurés par le GPS. */
    private fun completeAutoLapSegment(seg: AutoLapSegment, elapsedSec: Int, elapsedDistM: Double) {
        when (seg) {
            is AutoLapSegment.FreeStep -> {
                val steps = _uiState.value.freeSteps
                if (seg.idx in steps.indices && !steps[seg.idx].result.done) {
                    updateFreeStep(seg.idx, steps[seg.idx].result.copy(done = true, timeStr = formatMmSs(elapsedSec)))
                }
            }
            is AutoLapSegment.RepPhase -> {
                val blocks = _uiState.value.repeatBlocks
                if (seg.blockIdx in blocks.indices) {
                    val reps = blocks[seg.blockIdx].reps
                    if (seg.repIdx in reps.indices) {
                        val rep = reps[seg.repIdx]
                        if (seg.isFinal) {
                            if (!rep.done) updateIntervalRep(seg.blockIdx, seg.repIdx, rep.copy(done = true, runningDone = true))
                        } else {
                            if (!rep.runningDone) {
                                val paceStr = if (seg.endType == RunEndType.DISTANCE && elapsedDistM > 0) {
                                    formatPace(elapsedSec / 60.0 / (elapsedDistM / 1000.0))
                                } else ""
                                updateIntervalRep(
                                    seg.blockIdx, seg.repIdx,
                                    rep.copy(
                                        runningDone = true,
                                        timeStr = formatMmSs(elapsedSec),
                                        actualIntensity = paceStr.ifBlank { rep.actualIntensity },
                                    ),
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // ── Cockpit live : phase active + timeline ─────────────────────────────────

    /** Carte "MAINTENANT" : dérivée du même segment que l'auto-lap, avec progression bornée [0f, 1f]. */
    private fun computeLivePhase(state: RunningExecuteUiState, track: LiveTrackState): LivePhaseUiState? {
        // "Séance directe" : pas de cible/étapes, juste le chronomètre qui monte depuis l'ouverture de l'écran.
        if (state.isFreeRun) {
            return LivePhaseUiState(
                stepType = RunStepType.RUNNING,
                label = "COURSE LIBRE",
                isDistanceBased = false,
                currentValueLabel = formatHms(track.durationSec),
                targetValueLabel = "",
                progress = 0f,
                remainingLabel = "",
                targetHint = null,
                nextLabel = null,
                isLastStep = false,
            )
        }

        // Séance structurée sans étape enregistrée (ex. import legacy avec seul l'objectif texte) :
        // même rendu que la course libre plutôt que de masquer silencieusement tout le cockpit.
        if (autoLapSegments.isEmpty()) {
            return LivePhaseUiState(
                stepType = RunStepType.RUNNING,
                label = "COURSE",
                isDistanceBased = false,
                currentValueLabel = formatHms(track.durationSec),
                targetValueLabel = "",
                progress = 0f,
                remainingLabel = "",
                targetHint = null,
                nextLabel = null,
                isLastStep = false,
            )
        }

        if (autoLapIndex !in autoLapSegments.indices) return null
        val seg = autoLapSegments[autoLapIndex]

        val elapsed = when (seg.endType) {
            RunEndType.DURATION -> (track.durationSec - autoLapBaselineDurationSec).toDouble()
            RunEndType.DISTANCE -> track.distanceM - autoLapBaselineDistanceM
        }
        val targetValue = when (seg.endType) {
            RunEndType.DURATION -> seg.endValue.toDouble()
            RunEndType.DISTANCE -> if (seg.endUnit == RunEndUnit.KM) seg.endValue * 1000.0 else seg.endValue.toDouble()
        }
        val progress = if (targetValue > 0) (elapsed / targetValue).toFloat().coerceIn(0f, 1f) else 0f
        val remaining = (targetValue - elapsed).coerceAtLeast(0.0)
        val isDistanceBased = seg.endType == RunEndType.DISTANCE

        // Type réel de l'étape (jamais déduit de sa position dans la séance) : une étape RUNNING
        // placée en dernier reste "Course à pied", pas un "Retour au calme" présumé.
        val stepType: RunStepType = when (seg) {
            is AutoLapSegment.FreeStep -> state.freeSteps.getOrNull(seg.idx)?.step?.stepType ?: RunStepType.RUNNING
            is AutoLapSegment.RepPhase -> if (seg.isRecovery) {
                state.repeatBlocks.getOrNull(seg.blockIdx)?.recoveryStep?.stepType ?: RunStepType.RECOVERY
            } else {
                state.repeatBlocks.getOrNull(seg.blockIdx)?.targetStep?.stepType ?: RunStepType.RUNNING
            }
        }

        val label = when (seg) {
            is AutoLapSegment.FreeStep -> runStepLabel(stepType).uppercase()
            is AutoLapSegment.RepPhase -> if (seg.isRecovery) {
                runStepLabel(stepType).uppercase()
            } else {
                val block = state.repeatBlocks.getOrNull(seg.blockIdx)?.repeat
                repPhaseLabel(block?.repeatCount ?: 0, seg.repIdx, block?.isAutoLap == true)
            }
        }

        val targetHint = if (seg is AutoLapSegment.FreeStep &&
            state.freeSteps.getOrNull(seg.idx)?.step?.targetType == RunTargetType.NONE
        ) "Allure libre" else null
        val isLastStep = autoLapIndex == autoLapSegments.lastIndex
        val nextLabel = if (isLastStep) null
        else "ENSUITE · ${describeSegment(autoLapSegments[autoLapIndex + 1], state)}"

        return LivePhaseUiState(
            stepType = stepType,
            label = label,
            isDistanceBased = isDistanceBased,
            currentValueLabel = if (isDistanceBased) formatMeters(elapsed) else formatMmSs(elapsed.toInt()),
            targetValueLabel = if (isDistanceBased) formatMeters(targetValue) else formatMmSs(targetValue.toInt()),
            progress = progress,
            remainingLabel = if (isDistanceBased) "${formatMeters(remaining)} restants" else "${formatMmSs(remaining.toInt())} restant",
            targetHint = targetHint,
            nextLabel = nextLabel,
            isLastStep = isLastStep,
        )
    }

    private fun describeSegment(seg: AutoLapSegment, state: RunningExecuteUiState): String = when (seg) {
        is AutoLapSegment.FreeStep -> {
            val step = state.freeSteps.getOrNull(seg.idx)?.step
            val summary = step?.let { formatEndValue(it.endType, it.endValue, it.endUnit) } ?: ""
            listOfNotNull(step?.let { runStepLabel(it.stepType) }, summary.ifBlank { null }).joinToString(" ")
        }
        is AutoLapSegment.RepPhase -> if (seg.isRecovery) {
            "Récupération ${formatEndValue(seg.endType, seg.endValue, seg.endUnit)}"
        } else {
            val repeatCount = state.repeatBlocks.getOrNull(seg.blockIdx)?.repeat?.repeatCount ?: 0
            "${formatEndValue(seg.endType, seg.endValue, seg.endUnit)} × $repeatCount"
        }
    }

    /**
     * Timeline compacte : une entrée par étape libre et par bloc de répétitions (résumé "N / total"),
     * SAUF le bloc actif qui se déplie en une entrée par répétition individuelle (suivi rapide pendant
     * la série d'intervalles en cours).
     */
    private fun computeTimeline(state: RunningExecuteUiState): List<TimelineStepUiState> {
        data class Positioned(val position: Int, val isBlock: Boolean, val idx: Int)

        val positioned = state.freeSteps.mapIndexed { idx, fse -> Positioned(fse.step.position, false, idx) } +
            state.repeatBlocks.mapIndexed { idx, blk -> Positioned(blk.repeat.position, true, idx) }
        val sorted = positioned.sortedBy { it.position }

        return sorted.flatMap { p ->
            if (!p.isBlock) {
                val fse = state.freeSteps[p.idx]
                val status = when {
                    fse.result.done -> TimelineStatus.COMPLETED
                    isActiveFreeStep(p.idx) -> TimelineStatus.ACTIVE
                    else -> TimelineStatus.UPCOMING
                }
                listOf(
                    TimelineStepUiState(
                        label = runStepLabel(fse.step.stepType),
                        sublabel = formatEndValue(fse.step.endType, fse.step.endValue, fse.step.endUnit),
                        stepType = fse.step.stepType,
                        status = status,
                    )
                )
            } else {
                val block = state.repeatBlocks[p.idx]
                val done = block.reps.count { it.done }
                val total = block.reps.size
                val running = block.targetStep
                val recovery = block.recoveryStep
                val label = running?.let { formatEndValue(it.endType, it.endValue, it.endUnit) } ?: "Intervalles"
                val expandedSublabel = if (recovery != null) {
                    "$label · R ${formatEndValue(recovery.endType, recovery.endValue, recovery.endUnit)}"
                } else label
                val blockCompleted = total > 0 && done == total
                val activeRepIdx = activeRepIndex(p.idx)
                val blockStepType = running?.stepType ?: RunStepType.RUNNING

                if (activeRepIdx != null) {
                    block.reps.mapIndexed { repIdx, rep ->
                        TimelineStepUiState(
                            label = "${repIdx + 1}",
                            sublabel = expandedSublabel,
                            stepType = blockStepType,
                            status = when {
                                rep.done -> TimelineStatus.COMPLETED
                                repIdx == activeRepIdx -> TimelineStatus.ACTIVE
                                else -> TimelineStatus.UPCOMING
                            },
                        )
                    }
                } else {
                    listOf(
                        TimelineStepUiState(
                            label = label,
                            sublabel = "${(done + 1).coerceAtMost(total)} / $total",
                            stepType = blockStepType,
                            status = if (blockCompleted) TimelineStatus.COMPLETED else TimelineStatus.UPCOMING,
                        )
                    )
                }
            }
        }
    }

    private fun isActiveFreeStep(idx: Int): Boolean {
        val seg = autoLapSegments.getOrNull(autoLapIndex) ?: return false
        return seg is AutoLapSegment.FreeStep && seg.idx == idx
    }

    /** Index (0-based) de la répétition en cours dans ce bloc, ou null si ce bloc n'est pas actif. */
    private fun activeRepIndex(blockIdx: Int): Int? {
        val seg = autoLapSegments.getOrNull(autoLapIndex) ?: return null
        return if (seg is AutoLapSegment.RepPhase && seg.blockIdx == blockIdx) seg.repIdx else null
    }

    private fun formatEndValue(endType: RunEndType, endValue: Int, endUnit: RunEndUnit): String = when (endType) {
        RunEndType.DURATION -> formatMmSs(endValue)
        RunEndType.DISTANCE -> if (endUnit == RunEndUnit.KM) "$endValue km" else "$endValue m"
    }

    private fun formatMmSs(totalSec: Int): String {
        val s = totalSec.coerceAtLeast(0)
        return "${(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}"
    }

    private fun formatMeters(m: Double): String = "${m.coerceAtLeast(0.0).toInt()} m"

    private fun formatHms(totalSec: Int): String {
        val s = totalSec.coerceAtLeast(0)
        val h = s / 3600
        val m = (s % 3600) / 60
        val sec = s % 60
        return if (h > 0) "$h:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}"
        else "${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}"
    }

    /** Aplati la séance (étapes libres + course/récup de chaque répétition) en segments ordonnés par position. */
    private fun buildAutoLapSegments(state: RunningExecuteUiState): List<AutoLapSegment> {
        data class Positioned(val position: Int, val isBlock: Boolean, val idx: Int)

        val positioned = state.freeSteps.mapIndexed { idx, fse -> Positioned(fse.step.position, false, idx) } +
            state.repeatBlocks.mapIndexed { idx, blk -> Positioned(blk.repeat.position, true, idx) }

        val segments = mutableListOf<AutoLapSegment>()
        positioned.sortedBy { it.position }.forEach { p ->
            if (!p.isBlock) {
                val step = state.freeSteps[p.idx].step
                segments += AutoLapSegment.FreeStep(p.idx, step.endType, step.endValue, step.endUnit)
            } else {
                val block = state.repeatBlocks[p.idx]
                val running = block.targetStep
                val recovery = block.recoveryStep
                block.reps.indices.forEach { repIdx ->
                    if (running != null) {
                        segments += AutoLapSegment.RepPhase(
                            p.idx, repIdx, isFinal = recovery == null, isRecovery = false,
                            running.endType, running.endValue, running.endUnit,
                        )
                    }
                    if (recovery != null) {
                        segments += AutoLapSegment.RepPhase(
                            p.idx, repIdx, isFinal = true, isRecovery = true,
                            recovery.endType, recovery.endValue, recovery.endUnit,
                        )
                    }
                }
            }
        }
        return segments
    }

    private sealed class AutoLapSegment {
        abstract val endType: RunEndType
        abstract val endValue: Int
        abstract val endUnit: RunEndUnit

        data class FreeStep(
            val idx: Int,
            override val endType: RunEndType,
            override val endValue: Int,
            override val endUnit: RunEndUnit,
        ) : AutoLapSegment()

        /** Phase course (isFinal = false si suivie d'une récup) ou récup (toujours isFinal) d'une répétition. */
        data class RepPhase(
            val blockIdx: Int,
            val repIdx: Int,
            val isFinal: Boolean,
            /** true si ce segment est la phase récupération (par opposition à la phase course/effort). */
            val isRecovery: Boolean,
            override val endType: RunEndType,
            override val endValue: Int,
            override val endUnit: RunEndUnit,
        ) : AutoLapSegment()
    }

    private fun loadWorkout() {
        viewModelScope.launch {
            val workout  = workoutDao.getById(workoutId) ?: return@launch
            sessionManager.startWorkout(workoutId, workout.name, WorkoutType.RUNNING)
            val repeats  = repeatDao.getByWorkout(workoutId)
            val allSteps = stepDao.getByWorkout(workoutId)

            val freeSteps = allSteps.filter { it.repeatId == null }.sortedBy { it.position }.map { step ->
                val saved: FreeStepResult = if (step.resultsJson.isNotBlank())
                    runCatching { json.decodeFromString<FreeStepResult>(step.resultsJson) }.getOrDefault(FreeStepResult())
                else FreeStepResult()
                FreeStepExecution(step = step, result = saved)
            }

            val repeatBlocks = repeats.sortedBy { it.position }.map { rep ->
                val childSteps = allSteps.filter { it.repeatId == rep.id }.sortedBy { it.position }
                val targetStep = childSteps.firstOrNull { it.stepType == RunStepType.RUNNING }
                    ?: childSteps.firstOrNull()
                val recoveryStep = childSteps.firstOrNull {
                    it.stepType == RunStepType.RECOVERY || it.stepType == RunStepType.REST || it.stepType == RunStepType.WALKING
                }
                val savedReps: List<IntervalRepResult> = if (rep.resultsJson.isNotBlank()) {
                    runCatching { json.decodeFromString<List<IntervalRepResult>>(rep.resultsJson) }.getOrDefault(emptyList())
                } else emptyList()
                val reps = if (savedReps.size == rep.repeatCount) savedReps
                           else (1..rep.repeatCount).map { i -> savedReps.getOrNull(i - 1) ?: IntervalRepResult(i) }
                RunRepeatExecution(repeat = rep, targetStep = targetStep, recoveryStep = recoveryStep, reps = reps)
            }

            val loaded = RunningExecuteUiState(
                isLoading = false,
                workout = workout,
                workoutId = workoutId,
                freeSteps = freeSteps,
                repeatBlocks = repeatBlocks,
                isFreeRun = isFreeRunShape(freeSteps, repeatBlocks),
                resultDistanceKm  = workout.resultDistanceKm?.toString() ?: "",
                resultDurationStr = workout.resultDurationSec?.let { formatDurationSec(it) } ?: "",
                resultPaceStr     = workout.resultPaceAvgMinPerKm?.let { formatPace(it) } ?: "",
                resultHrAvg       = workout.resultHrAvg?.toString() ?: "",
                resultHrMax       = workout.resultHrMax?.toString() ?: "",
                resultElevationM  = workout.resultElevationM?.toString() ?: "",
                resultRpe         = workout.resultRpe?.toString() ?: "",
                resultCalories    = workout.resultCalories?.toString() ?: "",
                resultCadenceAvgPpm = workout.resultCadenceAvgRpm?.toString() ?: "",
                resultNotes       = workout.resultNotes,
            )
            initAutoLapSegments(loaded)
            _uiState.value = loaded
        }
    }

    /**
     * Construit les segments d'auto-lap dès que la séance est chargée (avant même le démarrage du GPS),
     * pour que la carte de phase active/timeline s'affichent dès l'émission du nouvel état — pas
     * seulement au prochain tick GPS. Appelée AVANT d'assigner `_uiState.value` : le `combine()` de
     * `screenState` doit voir des segments déjà construits dès qu'il reçoit ce nouvel état.
     * `requestStartCountdown()` réarme ensuite les lignes de base au vrai début du tracé.
     */
    private fun initAutoLapSegments(state: RunningExecuteUiState) {
        autoLapSegments = buildAutoLapSegments(state)
        autoLapIndex = 0
        autoLapBaselineDistanceM = 0.0
        autoLapBaselineDurationSec = 0
    }

    /** Détecte la forme "séance directe" créée par [ensureWorkoutCreated] : une unique étape libre sans cible ni répétitions. */
    private fun isFreeRunShape(freeSteps: List<FreeStepExecution>, repeatBlocks: List<RunRepeatExecution>): Boolean =
        repeatBlocks.isEmpty() && freeSteps.size == 1 &&
            freeSteps[0].step.targetType == RunTargetType.NONE &&
            freeSteps[0].step.endType == RunEndType.DURATION &&
            freeSteps[0].step.endValue == FREE_RUN_DURATION_SECONDS

    private fun buildFreeRunStep(ownerWorkoutId: Long) = RunStepEntity(
        workoutId = ownerWorkoutId,
        position = 0,
        stepType = RunStepType.RUNNING,
        endType = RunEndType.DURATION,
        endValue = FREE_RUN_DURATION_SECONDS,
        endUnit = RunEndUnit.SECONDS,
        targetType = RunTargetType.NONE,
    )

    /**
     * "Séance directe" : affiche mascotte + chronomètre dès l'ouverture de l'écran, sans encore créer
     * la séance en base (créée seulement au tap "Démarrer" via [ensureWorkoutCreated], pour éviter les
     * lignes orphelines si l'utilisateur quitte sans avoir démarré le suivi GPS).
     */
    private fun initDraftFreeRun() {
        val loaded = RunningExecuteUiState(
            isLoading = false,
            freeSteps = listOf(FreeStepExecution(step = buildFreeRunStep(0L), result = FreeStepResult())),
            isFreeRun = true,
        )
        initAutoLapSegments(loaded)
        _uiState.value = loaded
    }

    /** Crée la séance (+ étape RUNNING libre) en base au premier appel (brouillon → réel), idempotent ensuite. */
    private suspend fun ensureWorkoutCreated(): Long {
        if (workoutId > 0L) return workoutId
        val now = LocalDateTime.now()
        val id = workoutDao.insert(
            WorkoutEntity(
                workoutType = WorkoutType.RUNNING,
                name = "Course libre",
                isTemplate = false,
                scheduledDate = LocalDate.now(),
                createdAt = now,
                updatedAt = now,
            )
        )
        val step = buildFreeRunStep(id)
        stepDao.insert(step)
        workoutId = id
        wasAutoCreated = true
        val workout = workoutDao.getById(id)
        sessionManager.startWorkout(id, workout?.name ?: "Course libre", WorkoutType.RUNNING)
        val loaded = _uiState.value.copy(
            workout = workout,
            workoutId = id,
            freeSteps = listOf(FreeStepExecution(step = step, result = FreeStepResult())),
            isFreeRun = true,
        )
        initAutoLapSegments(loaded)
        _uiState.value = loaded
        return id
    }

    // ── GPS tracking ──────────────────────────────────────────────────────────

    fun startCalibration() {
        gpsTrackingController.startCalibration()
    }

    /**
     * Décompte de quelques secondes avant le vrai démarrage (le temps de ranger son téléphone).
     * Le service foreground GPS est démarré tout de suite (pendant que l'app est au premier
     * plan) puis mis en pause le temps du décompte visuel — sinon, si l'écran est verrouillé
     * pendant ces quelques secondes, `startForegroundService()` est appelé alors que l'app est
     * déjà en arrière-plan, ce qu'Android 12+ interdit (crash silencieux, §KNOWN_BUGS.md).
     */
    fun requestStartCountdown() {
        if (countdownJob?.isActive == true) return
        countdownJob = viewModelScope.launch {
            val id = ensureWorkoutCreated()
            gpsTrackingController.start(id, startPaused = true)
            for (s in GpsSessionDefaults.START_COUNTDOWN_SECONDS downTo 1) {
                _uiState.value = _uiState.value.copy(startCountdownSeconds = s)
                delay(1_000L)
            }
            _uiState.value = _uiState.value.copy(startCountdownSeconds = null)
            initAutoLapSegments(_uiState.value)
            gpsTrackingController.resume()
        }
    }

    fun cancelStartCountdown() {
        countdownJob?.cancel()
        countdownJob = null
        _uiState.value = _uiState.value.copy(startCountdownSeconds = null)
        gpsTrackingController.stop()
    }

    fun pauseGpsTracking() {
        gpsTrackingController.pause()
    }

    fun resumeGpsTracking() {
        gpsTrackingController.resume()
    }

    // ── Results (manual edit) ─────────────────────────────────────────────────

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
            "calories"   -> _uiState.value.copy(resultCalories = value)
            "cadence"    -> _uiState.value.copy(resultCadenceAvgPpm = value)
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

    // ── Finish ────────────────────────────────────────────────────────────────

    fun finishWorkout() {
        viewModelScope.launch {
            val id = ensureWorkoutCreated()
            // Arrêter le GPS/calibration si encore actif
            val track = liveTrackState.value
            if (track.isTracking) {
                gpsTrackingController.stop()
            } else {
                gpsTrackingController.stopCalibration()
            }

            // Auto-remplissage depuis le GPS (écrase les champs)
            val s = if (track.distanceM > 0) {
                val distKmStr = "%.3f".format(track.distanceM / 1000.0)
                val durStr    = formatDurationSec(track.durationSec)
                // Allure moyenne réelle (durée/distance), pas l'allure instantanée du dernier point GPS
                val paceStr   = computePaceStr(distKmStr, durStr) ?: formatPace(track.paceMinkm)
                val elevStr   = if (track.elevationGainM > 0) track.elevationGainM.toString() else _uiState.value.resultElevationM
                // Cadence moyenne (pas/min) depuis le capteur matériel — absente si permission refusée
                // ou capteur indisponible sur l'appareil (track.stepCount reste alors à 0).
                val cadenceStr = if (track.stepCount > 0 && track.durationSec > 0) {
                    (track.stepCount * 60 / track.durationSec).toString()
                } else _uiState.value.resultCadenceAvgPpm
                _uiState.value.copy(
                    resultDistanceKm  = distKmStr,
                    resultDurationStr = durStr,
                    resultPaceStr     = paceStr,
                    resultElevationM  = elevStr,
                    resultCadenceAvgPpm = cadenceStr,
                )
            } else _uiState.value

            val now = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)

            workoutDao.saveResults(
                id          = id,
                distKm      = s.resultDistanceKm.replace(",", ".").toDoubleOrNull(),
                durSec      = parseDurationToSec(s.resultDurationStr),
                pace        = parsePaceStr(s.resultPaceStr),
                hr          = s.resultHrAvg.toIntOrNull(),
                hrMax       = s.resultHrMax.toIntOrNull(),
                rpe         = s.resultRpe.toIntOrNull(),
                notes       = s.resultNotes,
                elevationM  = s.resultElevationM.toIntOrNull(),
                cadence     = s.resultCadenceAvgPpm.toIntOrNull(),
                calories    = s.resultCalories.toIntOrNull(),
                completedAt = now,
            )

            s.repeatBlocks.forEach { block ->
                val encoded = runCatching { json.encodeToString(block.reps) }.getOrDefault("[]")
                repeatDao.update(block.repeat.copy(resultsJson = encoded))
            }
            s.freeSteps.forEach { fse ->
                val encoded = runCatching { json.encodeToString(fse.result) }.getOrDefault("")
                stepDao.updateResults(fse.step.id, encoded)
            }

            gpsTrackingRepository.reset()
            sessionManager.endWorkout()
            _uiState.value = s.copy(isCompleted = true)
        }
    }

    /**
     * Annule la séance en cours (choix "Annuler la séance" au retour arrière) : arrête le suivi GPS
     * (service au premier plan indépendant de ce ViewModel), supprime le brouillon "séance directe"
     * s'il a été créé automatiquement, et libère la session active. Une séance planifiée/type
     * n'est jamais supprimée : seul son résultat en cours (non sauvegardé) est abandonné.
     */
    fun cancelWorkout() {
        viewModelScope.launch {
            if (liveTrackState.value.isTracking) gpsTrackingController.stop() else gpsTrackingController.stopCalibration()
            gpsTrackingRepository.reset()
            if (wasAutoCreated && workoutId > 0L) workoutDao.deleteById(workoutId)
            sessionManager.endWorkout()
        }
    }

    /**
     * Arrête uniquement la calibration (simple listener local, sans impact si le tracé n'a pas
     * démarré). Ne PAS arrêter le suivi GPS ni libérer la session active ici : le retour arrière
     * (popBackStack) efface ce ViewModel alors que le [RunningTrackingService] continue en
     * arrière-plan (foreground service indépendant). Libérer la session ici la rendrait
     * supprimable par erreur pendant qu'elle tourne encore (cf. cancelWorkout() pour l'arrêt explicite).
     */
    override fun onCleared() {
        gpsTrackingController.stopCalibration()
        super.onCleared()
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

    companion object {
        /** 6h : assez long pour ne jamais être atteint en usage normal, le coureur arrête manuellement. */
        private const val FREE_RUN_DURATION_SECONDS = 6 * 3600
    }
}

private fun formatDurationSec(totalSec: Int): String {
    val h = totalSec / 3600
    val m = (totalSec % 3600) / 60
    val s = totalSec % 60
    return if (h > 0) "$h:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
    else "$m:${s.toString().padStart(2, '0')}"
}
