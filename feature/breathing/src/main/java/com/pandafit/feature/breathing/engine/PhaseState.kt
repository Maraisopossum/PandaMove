package com.pandafit.feature.breathing.engine

/**
 * État courant de la session de respiration.
 *
 * [phaseProgress] (0f → 1f) est passé directement à LottieAnimation pour scrubber l'animation
 * en fonction de la progression dans la phase courante, quel que soit la durée réelle.
 */
data class PhaseState(
    val phase: BreathingPhase = BreathingPhase.INHALE,
    val phaseProgressMs: Long = 0L,
    val phaseDurationMs: Long = 0L,
    val currentCycle: Int = 1,
    val totalCycles: Int = 0,
    val isActive: Boolean = false,
    val isCompleted: Boolean = false,
) {
    /** Progression 0→1 dans la phase courante, utilisée comme position de scrub pour Lottie. */
    val phaseProgress: Float
        get() = if (phaseDurationMs == 0L) 0f
                else (phaseProgressMs / phaseDurationMs.toFloat()).coerceIn(0f, 1f)

    /** Durée totale écoulée depuis le début de la session (en millisecondes). */
    val elapsedMs: Long
        get() = if (totalCycles == 0) 0L
                else 0L  // calculé par l'engine dans le résumé final

    val remainingCycles: Int
        get() = (totalCycles - currentCycle).coerceAtLeast(0)
}
