package com.pandafit.feature.timer.model

enum class TimerMode {
    STOPWATCH,    // chronomètre — compte à rebours simple
    COUNTDOWN,    // décompte configurable
    HIIT,
    TABATA,
    EMOM,
    AMRAP,
    FOR_TIME,
}

enum class TimerPhase {
    IDLE,
    WARMUP,
    WORK,
    REST,
    COOLDOWN,
    DONE,
}

/** Enregistrement d'un lap pour le chronomètre — prêt pour une intégration future. */
data class LapRecord(
    val lapNumber: Int,
    val lapMs: Long,    // durée de ce lap
    val totalMs: Long,  // temps total au moment du lap
)

data class TimerConfig(
    val mode: TimerMode = TimerMode.STOPWATCH,
    val name: String = "",
    // Décompte simple
    val countdownSeconds: Int = 180,
    // HIIT / Tabata / EMOM
    val workSeconds: Int = 20,
    val restSeconds: Int = 10,
    val rounds: Int = 8,
    // Warmup / Cooldown
    val warmupSeconds: Int = 0,
    val cooldownSeconds: Int = 0,
    // AMRAP / For Time
    val totalSeconds: Int = 600,
)

val PRESET_TABATA = TimerConfig(
    mode = TimerMode.TABATA,
    name = "Tabata",
    workSeconds = 20,
    restSeconds = 10,
    rounds = 8,
)

val PRESET_EMOM_10 = TimerConfig(
    mode = TimerMode.EMOM,
    name = "EMOM 10min",
    workSeconds = 60,
    restSeconds = 0,
    rounds = 10,
)

val PRESET_HIIT_30_30 = TimerConfig(
    mode = TimerMode.HIIT,
    name = "HIIT 30/30",
    workSeconds = 30,
    restSeconds = 30,
    rounds = 8,
)

val PRESET_AMRAP_10 = TimerConfig(
    mode = TimerMode.AMRAP,
    name = "AMRAP 10min",
    totalSeconds = 600,
)

val DEFAULT_PRESETS = listOf(PRESET_TABATA, PRESET_HIIT_30_30, PRESET_EMOM_10, PRESET_AMRAP_10)

data class TimerUiState(
    val config: TimerConfig = TimerConfig(),
    val phase: TimerPhase = TimerPhase.IDLE,
    val currentRound: Int = 1,
    val secondsLeft: Int = 0,
    val totalElapsed: Int = 0,
    val isRunning: Boolean = false,
    val showConfig: Boolean = false,
    val presets: List<TimerConfig> = DEFAULT_PRESETS,
    val selectedPresetIndex: Int? = null,
    // Moteur précis (STOPWATCH + COUNTDOWN)
    val elapsedMs: Long = 0L,
    val targetMs: Long = 0L,
    val laps: List<LapRecord> = emptyList(),
    val isFinished: Boolean = false,
    // Presets countdown personnalisés (persistés)
    val countdownPresets: List<Int> = listOf(60, 300, 600),
)
