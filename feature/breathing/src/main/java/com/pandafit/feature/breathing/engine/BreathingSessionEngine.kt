package com.pandafit.feature.breathing.engine

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Moteur singleton de session de respiration.
 *
 * - Émet un [StateFlow<PhaseState>] partagé entre le ViewModel et le ForegroundService.
 * - Avance par pas de [TICK_MS] ms et recalcule [phaseProgressMs] / [phaseDurationMs].
 * - Quand la phase se termine, passe à la suivante ; quand le dernier cycle se termine,
 *   passe [isCompleted] à true et s'arrête.
 */
@Singleton
class BreathingSessionEngine @Inject constructor() {

    companion object {
        const val TICK_MS = 100L
    }

    private val engineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val _state = MutableStateFlow(PhaseState())
    val state: StateFlow<PhaseState> = _state.asStateFlow()

    private var tickJob: Job? = null
    private var config: BreathingConfig? = null

    /** Durée totale de la session en ms (pour le rapport Room). */
    var sessionStartMs: Long = 0L
        private set

    fun start(breathingConfig: BreathingConfig) {
        stop()
        config = breathingConfig
        sessionStartMs = System.currentTimeMillis()

        val phases = breathingConfig.activePhases
        if (phases.isEmpty()) return

        _state.value = PhaseState(
            phase = phases[0].first,
            phaseProgressMs = 0L,
            phaseDurationMs = phases[0].second,
            currentCycle = 1,
            totalCycles = breathingConfig.cycles,
            isActive = true,
            isCompleted = false,
        )

        tickJob = engineScope.launch {
            var phaseIndex = 0
            var progressMs = 0L

            while (true) {
                delay(TICK_MS)

                val cfg = config ?: break
                val activePhases = cfg.activePhases
                if (activePhases.isEmpty()) break

                progressMs += TICK_MS
                val phaseDuration = activePhases[phaseIndex].second

                val current = _state.value

                if (progressMs >= phaseDuration) {
                    // Avancer à la phase suivante
                    phaseIndex++
                    progressMs = 0L

                    if (phaseIndex >= activePhases.size) {
                        // Fin d'un cycle
                        phaseIndex = 0
                        val nextCycle = current.currentCycle + 1

                        if (nextCycle > cfg.cycles) {
                            // Session terminée
                            _state.value = current.copy(
                                phaseProgressMs = phaseDuration,
                                isActive = false,
                                isCompleted = true,
                            )
                            break
                        }

                        _state.value = current.copy(
                            phase = activePhases[0].first,
                            phaseProgressMs = 0L,
                            phaseDurationMs = activePhases[0].second,
                            currentCycle = nextCycle,
                            isActive = true,
                        )
                    } else {
                        _state.value = current.copy(
                            phase = activePhases[phaseIndex].first,
                            phaseProgressMs = 0L,
                            phaseDurationMs = activePhases[phaseIndex].second,
                            isActive = true,
                        )
                    }
                } else {
                    _state.value = current.copy(
                        phaseProgressMs = progressMs,
                    )
                }
            }
        }
    }

    fun stop() {
        tickJob?.cancel()
        tickJob = null
        config = null
        _state.value = PhaseState()
    }

    fun pause() {
        tickJob?.cancel()
        tickJob = null
        _state.value = _state.value.copy(isActive = false)
    }

    fun resume() {
        val cfg = config ?: return
        val current = _state.value
        if (current.isCompleted) return

        val phases = cfg.activePhases
        val currentPhaseIndex = phases.indexOfFirst { it.first == current.phase }
        if (currentPhaseIndex < 0) return

        var progressMs = current.phaseProgressMs

        tickJob = engineScope.launch {
            var phaseIndex = currentPhaseIndex

            _state.value = current.copy(isActive = true)

            while (true) {
                delay(TICK_MS)

                val activeCfg = config ?: break
                val activePhases = activeCfg.activePhases
                if (activePhases.isEmpty()) break

                progressMs += TICK_MS
                val phaseDuration = activePhases[phaseIndex].second
                val st = _state.value

                if (progressMs >= phaseDuration) {
                    phaseIndex++
                    progressMs = 0L

                    if (phaseIndex >= activePhases.size) {
                        phaseIndex = 0
                        val nextCycle = st.currentCycle + 1

                        if (nextCycle > activeCfg.cycles) {
                            _state.value = st.copy(
                                phaseProgressMs = phaseDuration,
                                isActive = false,
                                isCompleted = true,
                            )
                            break
                        }

                        _state.value = st.copy(
                            phase = activePhases[0].first,
                            phaseProgressMs = 0L,
                            phaseDurationMs = activePhases[0].second,
                            currentCycle = nextCycle,
                            isActive = true,
                        )
                    } else {
                        _state.value = st.copy(
                            phase = activePhases[phaseIndex].first,
                            phaseProgressMs = 0L,
                            phaseDurationMs = activePhases[phaseIndex].second,
                            isActive = true,
                        )
                    }
                } else {
                    _state.value = st.copy(phaseProgressMs = progressMs)
                }
            }
        }
    }
}
