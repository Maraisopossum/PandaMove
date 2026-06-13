package com.pandafit.feature.breathing.viewmodel

import com.pandafit.feature.breathing.engine.PhaseState
import com.pandafit.feature.breathing.method.BreathingMethod

enum class ConfigMode { CYCLES, MINUTES }

data class BreathingUiState(
    val selectedMethod: BreathingMethod? = null,
    val phaseState: PhaseState = PhaseState(),
    val sessionSavedDurationSeconds: Int = 0,
    val isSessionSaved: Boolean = false,
    /** > 0 pendant le décompte avant démarrage (5, 4, 3, 2, 1). */
    val countdownSeconds: Int = 0,
    /** Mode de configuration : nombre de cycles ou durée en minutes. */
    val configMode: ConfigMode = ConfigMode.CYCLES,
    /** Cycles personnalisés (null = valeur par défaut de la méthode). */
    val customCycles: Int? = null,
    /** Durée personnalisée en minutes (null = valeur par défaut de la méthode). */
    val customDurationMinutes: Int? = null,
)
