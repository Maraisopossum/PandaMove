package com.pandafit.feature.stats.model

enum class StatsPeriod { WEEK, MONTH, THREE_MONTHS, YEAR }

data class StatsUiState(
    val isLoading: Boolean = false,
    val period: StatsPeriod = StatsPeriod.MONTH,
    val runningStats: SportStats = SportStats(),
    val cyclingStats: SportStats = SportStats(),
    val strengthStats: SportStats = SportStats(),
    val weeklyVolume: List<DayVolume> = emptyList(),
    val strengthDetail: StrengthDetailStats = StrengthDetailStats(),
    val runningDetail: RunningDetailStats = RunningDetailStats(),
    val statsConfig: StatsConfig = StatsConfig(),
    val error: String? = null,
)

data class SportStats(
    val totalSessions: Int = 0,
    val completedSessions: Int = 0,
    val totalDurationMinutes: Int = 0,
    val totalDistanceKm: Double? = null,
    val averageDurationMinutes: Double = 0.0,
    val completionRate: Float = 0f,
)

// ── Détail Renforcement ───────────────────────────────────────────────────────

data class StrengthDetailStats(
    val plannedSessions: Int = 0,
    val completedSessions: Int = 0,
    val totalSeries: Int = 0,
    val totalReps: Int = 0,
    val totalTonnageKg: Double = 0.0,
    val avgDurationMin: Int = 0,
    val maxDurationMin: Int = 0,
    val topExercises: List<Pair<String, Int>> = emptyList(),
    val exerciseProgressions: List<ExerciseProgression> = emptyList(),
    val muscleBreakdown: List<MuscleGroupStat> = emptyList(),
)

data class ExerciseProgression(
    val exerciseName: String,
    val firstMaxKg: Float?,
    val lastMaxKg: Float?,
) {
    val deltaKg: Float? get() =
        if (firstMaxKg != null && lastMaxKg != null) lastMaxKg - firstMaxKg else null
}

data class MuscleGroupStat(
    val group: String,
    val seriesCount: Int,
    val percentage: Float,
)

// ── Détail Running ────────────────────────────────────────────────────────────

data class RunningDetailStats(
    val completedSessions: Int = 0,
    val totalDistanceKm: Double = 0.0,
    val totalDurationSec: Int = 0,
    val avgPaceMinPerKm: Double = 0.0,
    val bestPaceMinPerKm: Double = 0.0,
    val avgHrBpm: Int = 0,
    val maxHrBpm: Int = 0,
    val totalElevationM: Int = 0,
    val longestSessionKm: Double = 0.0,
    val weeklyPaces: List<WeeklyPace> = emptyList(),
    // Stats poussette
    val strollerSessions: Int = 0,
    val strollerDistanceKm: Double = 0.0,
    val strollerDistancePct: Float = 0f,
)

data class WeeklyPace(
    val weekLabel: String,
    val avgPaceMinPerKm: Double,
    val weeklyDistanceKm: Double = 0.0,
)

// ── Volume quotidien ──────────────────────────────────────────────────────────

data class DayVolume(
    val dayLabel: String,
    val runningMinutes: Float = 0f,
    val cyclingMinutes: Float = 0f,
    val strengthMinutes: Float = 0f,
) {
    val totalMinutes: Float get() = runningMinutes + cyclingMinutes + strengthMinutes
}
