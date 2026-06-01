package com.pandafit.feature.timer.viewmodel

import android.content.Context
import android.os.SystemClock
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.feature.timer.model.LapRecord
import com.pandafit.feature.timer.model.TimerConfig
import com.pandafit.feature.timer.model.TimerMode
import com.pandafit.feature.timer.model.TimerPhase
import com.pandafit.feature.timer.model.TimerUiState
import com.pandafit.feature.timer.service.TimerForegroundService
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class TimerViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
) : ViewModel() {

    private val prefs = context.getSharedPreferences("pandafit_timer", Context.MODE_PRIVATE)

    private val _uiState = MutableStateFlow(TimerUiState())
    val uiState: StateFlow<TimerUiState> = _uiState.asStateFlow()

    /** Événements sonores (HIIT + phases). */
    private val _beepEvent = MutableSharedFlow<BeepType>(extraBufferCapacity = 10)
    val beepEvent: SharedFlow<BeepType> = _beepEvent.asSharedFlow()

    /** Fin de décompte — déclenche vibration + son fort dans le Screen. */
    private val _finishEvent = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val finishEvent: SharedFlow<Unit> = _finishEvent.asSharedFlow()

    private var timerJob: Job? = null

    // ── Moteur précis — ancrage SystemClock (STOPWATCH + COUNTDOWN) ────────────
    // Principe : on stocke l'instant de départ/reprise (anchorMs) et le temps
    // déjà accumulé avant la dernière pause (accumulatedMs). Le temps courant
    // est toujours calculé comme : accumulatedMs + (now - anchorMs).
    // → zéro dérive, résistant aux écrans éteints et aux retours d'arrière-plan.

    private var anchorMs: Long = 0L
    private var accumulatedMs: Long = 0L
    private var lastCountdownBeepSec: Long = Long.MAX_VALUE  // anti-doublon bip

    /** Dernière seconde notifiée — évite de flooder NotificationManager à 10 Hz. */
    private var lastNotifSec: Long = -1L

    enum class BeepType { SHORT, COUNTDOWN_BEEP, GONG, PHASE_CHANGE }

    init {
        loadPresets()
        TimerForegroundService.createChannel(context)
    }

    override fun onCleared() {
        super.onCleared()
        TimerForegroundService.stop(context)
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Presets countdown (persistance SharedPreferences)
    // ══════════════════════════════════════════════════════════════════════════

    private fun loadPresets() {
        val raw = prefs.getString("countdown_presets", "60,300,600") ?: "60,300,600"
        val list = raw.split(",").mapNotNull { it.toIntOrNull() }.filter { it > 0 }
        _uiState.value = _uiState.value.copy(countdownPresets = list.ifEmpty { listOf(60, 300, 600) })
    }

    /** Enregistre la durée courante comme preset (max 5, pas de doublon). */
    fun saveCountdownPreset(seconds: Int) {
        val current = _uiState.value.countdownPresets
        if (seconds in current || current.size >= 5 || seconds <= 0) return
        val updated = (current + seconds).sortedBy { it }
        _uiState.value = _uiState.value.copy(countdownPresets = updated)
        prefs.edit().putString("countdown_presets", updated.joinToString(",")).apply()
    }

    fun deleteCountdownPreset(seconds: Int) {
        val updated = _uiState.value.countdownPresets.filter { it != seconds }
        _uiState.value = _uiState.value.copy(countdownPresets = updated)
        prefs.edit().putString("countdown_presets", updated.joinToString(",")).apply()
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Sélection de mode depuis la home
    // ══════════════════════════════════════════════════════════════════════════

    /** Prépare un mode sans démarrer — appelé avant de naviguer vers la vue active. */
    fun selectMode(mode: TimerMode) {
        timerJob?.cancel()
        anchorMs = 0L
        accumulatedMs = 0L
        lastCountdownBeepSec = Long.MAX_VALUE
        _uiState.value = _uiState.value.copy(
            config = _uiState.value.config.copy(mode = mode),
            phase = TimerPhase.IDLE,
            isRunning = false,
            elapsedMs = 0L,
            isFinished = false,
            laps = emptyList(),
        )
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Chronomètre (STOPWATCH)
    // ══════════════════════════════════════════════════════════════════════════

    /** Démarre le chronomètre depuis zéro. */
    fun startStopwatch() {
        val state = _uiState.value
        if (state.isRunning) return
        accumulatedMs = 0L
        anchorMs = SystemClock.elapsedRealtime()
        lastNotifSec = -1L
        _uiState.value = state.copy(
            config = state.config.copy(mode = TimerMode.STOPWATCH),
            isRunning = true,
            phase = TimerPhase.WORK,
            elapsedMs = 0L,
            isFinished = false,
        )
        pushNotif(forceStart = true)
        startPreciseTick()
    }

    /** Enregistre un lap — prêt pour l'affichage futur, non exposé dans l'UI actuelle. */
    fun stopwatchLap() {
        val s = _uiState.value
        if (s.config.mode != TimerMode.STOPWATCH || !s.isRunning) return
        val totalMs = accumulatedMs + (SystemClock.elapsedRealtime() - anchorMs)
        val prevTotal = s.laps.lastOrNull()?.totalMs ?: 0L
        _uiState.value = s.copy(
            laps = s.laps + LapRecord(
                lapNumber = s.laps.size + 1,
                lapMs = totalMs - prevTotal,
                totalMs = totalMs,
            )
        )
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Décompte simple (COUNTDOWN)
    // ══════════════════════════════════════════════════════════════════════════

    /** Lance un décompte depuis [targetMs] millisecondes. */
    fun startCountdown(targetMs: Long) {
        val state = _uiState.value
        if (state.isRunning) return
        accumulatedMs = 0L
        anchorMs = SystemClock.elapsedRealtime()
        lastCountdownBeepSec = Long.MAX_VALUE
        lastNotifSec = -1L
        _uiState.value = state.copy(
            config = state.config.copy(mode = TimerMode.COUNTDOWN),
            isRunning = true,
            phase = TimerPhase.WORK,
            targetMs = targetMs,
            elapsedMs = 0L,
            isFinished = false,
        )
        _beepEvent.tryEmit(BeepType.PHASE_CHANGE)
        pushNotif(forceStart = true)
        startPreciseTick()
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Contrôles unifiés (tous modes)
    // ══════════════════════════════════════════════════════════════════════════

    fun pause() {
        val s = _uiState.value
        if (s.config.mode == TimerMode.STOPWATCH || s.config.mode == TimerMode.COUNTDOWN) {
            if (s.isRunning) accumulatedMs += SystemClock.elapsedRealtime() - anchorMs
        }
        timerJob?.cancel()
        _uiState.value = _uiState.value.copy(isRunning = false)
        lastNotifSec = -1L   // force le refresh pour afficher "En pause"
        pushNotif()
    }

    /**
     * Reprend après pause — gère aussi le premier démarrage depuis IDLE pour
     * STOPWATCH (accumulatedMs remis à 0) et COUNTDOWN.
     */
    fun resume() {
        val state = _uiState.value
        if (state.isRunning) return
        val mode = state.config.mode
        if (mode == TimerMode.STOPWATCH || mode == TimerMode.COUNTDOWN) {
            if (state.phase == TimerPhase.IDLE) {
                // Premier démarrage — on repart de zéro
                accumulatedMs = 0L
                lastCountdownBeepSec = Long.MAX_VALUE
            }
            anchorMs = SystemClock.elapsedRealtime()
            val newPhase = if (state.phase == TimerPhase.IDLE) TimerPhase.WORK else state.phase
            _uiState.value = state.copy(isRunning = true, phase = newPhase)
            lastNotifSec = -1L
            pushNotif(forceStart = true)
            startPreciseTick()
        } else {
            // HIIT modes
            _uiState.value = state.copy(isRunning = true)
            lastNotifSec = -1L
            pushNotif(forceStart = true)
            startTick()
        }
    }

    fun reset() {
        timerJob?.cancel()
        anchorMs = 0L
        accumulatedMs = 0L
        lastCountdownBeepSec = Long.MAX_VALUE
        lastNotifSec = -1L
        val mode = _uiState.value.config.mode
        if (mode == TimerMode.STOPWATCH || mode == TimerMode.COUNTDOWN) {
            _uiState.value = _uiState.value.copy(
                phase = TimerPhase.IDLE,
                isRunning = false,
                elapsedMs = 0L,
                isFinished = false,
                laps = emptyList(),
            )
        } else {
            _uiState.value = _uiState.value.copy(
                phase = TimerPhase.IDLE,
                isRunning = false,
                currentRound = 1,
                secondsLeft = 0,
                totalElapsed = 0,
                showConfig = true,
            )
        }
        TimerForegroundService.stop(context)
    }

    // ══════════════════════════════════════════════════════════════════════════
    // HIIT — API existante conservée
    // ══════════════════════════════════════════════════════════════════════════

    fun selectPreset(index: Int) {
        val state = _uiState.value
        if (index in state.presets.indices) {
            _uiState.value = state.copy(
                config = state.presets[index],
                selectedPresetIndex = index,
                phase = TimerPhase.IDLE,
                isRunning = false,
                currentRound = 1,
                secondsLeft = 0,
            )
            timerJob?.cancel()
        }
    }

    fun updateConfig(config: TimerConfig) {
        _uiState.value = _uiState.value.copy(config = config, selectedPresetIndex = null)
    }

    /** Point d'entrée depuis TimerConfigView — délègue aux modes précis ou HIIT. */
    fun start() {
        val state = _uiState.value
        if (state.isRunning) return
        when (state.config.mode) {
            TimerMode.STOPWATCH -> { startStopwatch(); return }
            TimerMode.COUNTDOWN -> { startCountdown(state.config.countdownSeconds * 1000L); return }
            else -> Unit
        }
        // Logique HIIT/TABATA/EMOM/AMRAP/FOR_TIME — inchangée
        val startSeconds = when (state.config.mode) {
            TimerMode.HIIT, TimerMode.TABATA -> state.config.workSeconds
            TimerMode.EMOM                   -> state.config.workSeconds
            TimerMode.AMRAP, TimerMode.FOR_TIME -> state.config.totalSeconds
            else -> 0   // STOPWATCH/COUNTDOWN already handled above
        }
        val startPhase = if (state.config.warmupSeconds > 0) TimerPhase.WARMUP else TimerPhase.WORK
        _uiState.value = state.copy(
            isRunning = true,
            phase = startPhase,
            currentRound = 1,
            secondsLeft = if (state.config.warmupSeconds > 0) state.config.warmupSeconds else startSeconds,
            totalElapsed = 0,
            showConfig = false,
        )
        _beepEvent.tryEmit(BeepType.PHASE_CHANGE)
        lastNotifSec = -1L
        pushNotif(forceStart = true)
        startTick()
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Moteur précis — tick 100 ms, ancrage SystemClock
    // ══════════════════════════════════════════════════════════════════════════

    private fun startPreciseTick() {
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            while (true) {
                delay(100L)
                val elapsed = accumulatedMs + (SystemClock.elapsedRealtime() - anchorMs)
                updateFromElapsed(elapsed)
            }
        }
    }

    private fun updateFromElapsed(elapsed: Long) {
        val s = _uiState.value
        if (!s.isRunning) return
        when (s.config.mode) {
            TimerMode.STOPWATCH -> {
                _uiState.value = s.copy(elapsedMs = elapsed)
                pushNotif()
            }
            TimerMode.COUNTDOWN -> {
                if (s.isFinished) return
                val remaining = (s.targetMs - elapsed).coerceAtLeast(0L)
                // Bip vocal 5-4-3-2-1 (une seule émission par seconde)
                val remSec = remaining / 1000
                if (remSec in 1..5 && remSec != lastCountdownBeepSec) {
                    lastCountdownBeepSec = remSec
                    _beepEvent.tryEmit(BeepType.COUNTDOWN_BEEP)
                }
                if (remaining == 0L) {
                    timerJob?.cancel()
                    accumulatedMs = s.targetMs
                    _uiState.value = s.copy(
                        elapsedMs = s.targetMs,
                        isFinished = true,
                        isRunning = false,
                        phase = TimerPhase.DONE,
                    )
                    _beepEvent.tryEmit(BeepType.GONG)
                    _finishEvent.tryEmit(Unit)
                    lastNotifSec = -1L
                    pushNotif()  // affiche "Terminé !" — le service reste actif jusqu'au reset()
                } else {
                    _uiState.value = s.copy(elapsedMs = elapsed)
                    pushNotif()
                }
            }
            else -> {}
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Moteur HIIT — tick 1 s, logique phases existante inchangée
    // ══════════════════════════════════════════════════════════════════════════

    private fun startTick() {
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            while (true) {
                delay(1000L)
                tick()
            }
        }
    }

    private fun tick() {
        val s = _uiState.value
        if (!s.isRunning || s.phase == TimerPhase.IDLE || s.phase == TimerPhase.DONE) return

        val newSecondsLeft = s.secondsLeft - 1
        val newElapsed = s.totalElapsed + 1

        if (newSecondsLeft in 1..5) _beepEvent.tryEmit(BeepType.COUNTDOWN_BEEP)

        if (newSecondsLeft > 0) {
            _uiState.value = s.copy(secondsLeft = newSecondsLeft, totalElapsed = newElapsed)
            pushNotif()
            return
        }

        _beepEvent.tryEmit(BeepType.GONG)
        val config = s.config

        when (s.phase) {
            TimerPhase.WARMUP -> {
                _uiState.value = s.copy(phase = TimerPhase.WORK, secondsLeft = phaseSeconds(config, TimerPhase.WORK), totalElapsed = newElapsed)
                _beepEvent.tryEmit(BeepType.PHASE_CHANGE)
            }
            TimerPhase.WORK -> {
                val hasRest = when (config.mode) {
                    TimerMode.HIIT, TimerMode.TABATA -> config.restSeconds > 0 && s.currentRound < config.rounds
                    else -> false
                }
                if (hasRest) {
                    _uiState.value = s.copy(phase = TimerPhase.REST, secondsLeft = config.restSeconds, totalElapsed = newElapsed)
                    _beepEvent.tryEmit(BeepType.PHASE_CHANGE)
                } else {
                    advanceRound(s, newElapsed)
                }
            }
            TimerPhase.REST -> advanceRound(s, newElapsed)
            TimerPhase.COOLDOWN -> {
                _uiState.value = s.copy(phase = TimerPhase.DONE, isRunning = false, secondsLeft = 0, totalElapsed = newElapsed)
                timerJob?.cancel()
                TimerForegroundService.stop(context)
            }
            else -> {}
        }
    }

    private fun advanceRound(s: TimerUiState, elapsed: Int) {
        val config = s.config
        val maxRounds = when (config.mode) {
            TimerMode.AMRAP, TimerMode.FOR_TIME -> 1
            else -> config.rounds
        }
        val nextRound = s.currentRound + 1
        if (nextRound > maxRounds || config.mode == TimerMode.AMRAP || config.mode == TimerMode.FOR_TIME) {
            if (config.cooldownSeconds > 0) {
                _uiState.value = s.copy(phase = TimerPhase.COOLDOWN, secondsLeft = config.cooldownSeconds, totalElapsed = elapsed)
                _beepEvent.tryEmit(BeepType.PHASE_CHANGE)
            } else {
                _uiState.value = s.copy(phase = TimerPhase.DONE, isRunning = false, secondsLeft = 0, totalElapsed = elapsed)
                timerJob?.cancel()
                TimerForegroundService.stop(context)
            }
        } else {
            _uiState.value = s.copy(
                phase = TimerPhase.WORK,
                currentRound = nextRound,
                secondsLeft = phaseSeconds(config, TimerPhase.WORK),
                totalElapsed = elapsed,
            )
            _beepEvent.tryEmit(BeepType.PHASE_CHANGE)
        }
    }

    private fun phaseSeconds(config: TimerConfig, phase: TimerPhase): Int = when (phase) {
        TimerPhase.WORK -> when (config.mode) {
            TimerMode.AMRAP, TimerMode.FOR_TIME -> config.totalSeconds
            else -> config.workSeconds
        }
        TimerPhase.REST     -> config.restSeconds
        TimerPhase.WARMUP   -> config.warmupSeconds
        TimerPhase.COOLDOWN -> config.cooldownSeconds
        else -> 0
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Notification foreground — mise à jour 1×/seconde max
    // ══════════════════════════════════════════════════════════════════════════

    /** Calcule le contenu (titre, sous-titre) de la notification selon l'état courant. */
    private fun buildNotifContent(): Pair<String, String> {
        val s = _uiState.value
        val pauseSuffix = if (!s.isRunning) " • En pause" else ""
        return when (s.config.mode) {
            TimerMode.STOPWATCH -> {
                val sec = s.elapsedMs / 1000
                Pair(fmtSec(sec), "Chronomètre$pauseSuffix")
            }
            TimerMode.COUNTDOWN -> {
                if (s.isFinished) return Pair("00:00", "Minuteur • Terminé !")
                val rem = (s.targetMs - s.elapsedMs).coerceAtLeast(0L) / 1000
                Pair(fmtSec(rem), "Minuteur$pauseSuffix")
            }
            else -> {
                val phaseLabel = when (s.phase) {
                    TimerPhase.WORK     -> "Travail"
                    TimerPhase.REST     -> "Repos"
                    TimerPhase.WARMUP   -> "Échauffement"
                    TimerPhase.COOLDOWN -> "Récupération"
                    TimerPhase.DONE     -> "Terminé !"
                    else                -> ""
                }
                val roundLabel = when (s.config.mode) {
                    TimerMode.AMRAP, TimerMode.FOR_TIME -> phaseLabel
                    else -> "Tour ${s.currentRound}/${s.config.rounds} • $phaseLabel"
                }
                Pair(fmtSec(s.secondsLeft.toLong()), "$roundLabel$pauseSuffix")
            }
        }
    }

    /**
     * Démarre le service (premier appel) ou met à jour la notification, limité à 1×/s.
     * [forceStart] = true pour le premier appel (startForeground obligatoire).
     */
    private fun pushNotif(forceStart: Boolean = false) {
        val s = _uiState.value
        val currentSec = when (s.config.mode) {
            TimerMode.STOPWATCH -> s.elapsedMs / 1000
            TimerMode.COUNTDOWN -> (s.targetMs - s.elapsedMs).coerceAtLeast(0L) / 1000
            else                -> s.secondsLeft.toLong()
        }
        if (!forceStart && currentSec == lastNotifSec) return
        lastNotifSec = currentSec
        val (time, label) = buildNotifContent()
        if (forceStart) TimerForegroundService.start(context, time, label)
        else            TimerForegroundService.update(context, time, label)
    }

    private fun fmtSec(totalSec: Long): String {
        val m = totalSec / 60
        val s = totalSec % 60
        return "${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
    }
}
