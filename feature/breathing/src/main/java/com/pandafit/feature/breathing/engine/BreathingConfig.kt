package com.pandafit.feature.breathing.engine

/**
 * Configuration d'une méthode respiratoire.
 *
 * Seules les phases avec une durée > 0 sont actives.
 * L'ordre des phases est toujours : INHALE → HOLD_IN → EXHALE → HOLD_OUT.
 */
data class BreathingConfig(
    val methodName: String,
    val inhaleMs: Long,
    val holdInMs: Long = 0L,
    val exhaleMs: Long,
    val holdOutMs: Long = 0L,
    val cycles: Int,
) {
    val activePhases: List<Pair<BreathingPhase, Long>>
        get() = listOfNotNull(
            BreathingPhase.INHALE to inhaleMs,
            if (holdInMs > 0L) BreathingPhase.HOLD_IN to holdInMs else null,
            BreathingPhase.EXHALE to exhaleMs,
            if (holdOutMs > 0L) BreathingPhase.HOLD_OUT to holdOutMs else null,
        )

    val cycleDurationMs: Long
        get() = activePhases.sumOf { it.second }

    val totalDurationMs: Long
        get() = cycleDurationMs * cycles
}
