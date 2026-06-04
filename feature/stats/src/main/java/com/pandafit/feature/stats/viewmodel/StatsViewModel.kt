package com.pandafit.feature.stats.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pandafit.core.database.dao.ExerciseDao
import com.pandafit.core.database.dao.InstanceSeanceDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.effectivePrimary
import com.pandafit.core.database.entities.RepsType
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.feature.stats.model.DayVolume
import com.pandafit.feature.stats.model.ExerciseProgression
import com.pandafit.feature.stats.model.MuscleGroupStat
import com.pandafit.feature.stats.model.RunningDetailStats
import com.pandafit.feature.stats.model.SportStats
import com.pandafit.feature.stats.model.StatsConfig
import com.pandafit.feature.stats.model.StatsPeriod
import com.pandafit.feature.stats.model.StatsUiState
import com.pandafit.feature.stats.model.StrengthDetailStats
import com.pandafit.feature.stats.model.WeeklyPace
import com.pandafit.feature.stats.preferences.StatsPreferences
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.TextStyle
import java.time.temporal.WeekFields
import java.util.Locale
import javax.inject.Inject

@HiltViewModel
class StatsViewModel @Inject constructor(
    private val workoutDao: WorkoutDao,
    private val instanceSeanceDao: InstanceSeanceDao,
    private val exerciseDao: ExerciseDao,
    private val statsPreferences: StatsPreferences,
) : ViewModel() {

    private val _uiState = MutableStateFlow(StatsUiState())
    val uiState: StateFlow<StatsUiState> = _uiState.asStateFlow()

    init { loadStats(StatsPeriod.MONTH, showLoading = false) }

    fun setPeriod(period: StatsPeriod) { loadStats(period, showLoading = true) }

    /** Rafraîchissement silencieux — données existantes restent affichées, pas de flash. */
    fun reload() { loadStats(_uiState.value.period, showLoading = false) }

    private fun loadStats(period: StatsPeriod, showLoading: Boolean = true) {
        viewModelScope.launch {
            _uiState.value = if (showLoading)
                _uiState.value.copy(isLoading = true, period = period)
            else
                _uiState.value.copy(period = period)
            try {
                val statsConfig = statsPreferences.configFlow.first()
                val today = LocalDate.now()
                val startDate = when (period) {
                    StatsPeriod.WEEK        -> today.minusWeeks(1)
                    StatsPeriod.MONTH       -> today.minusMonths(1)
                    StatsPeriod.THREE_MONTHS -> today.minusMonths(3)
                    StatsPeriod.YEAR        -> today.minusYears(1)
                }

                // ── Running / Cycling (WorkoutEntity) ────────────────────────
                val workouts = workoutDao.observeByDateRange(startDate, today).first().filter { !it.isTemplate }

                fun runningCyclingStats(type: WorkoutType): SportStats {
                    val filtered = workouts.filter { it.workoutType == type }
                    val completed = filtered.filter { it.isCompleted }
                    val totalDist = completed.mapNotNull { it.resultDistanceKm }.sum()
                    return SportStats(
                        totalSessions = filtered.size,
                        completedSessions = completed.size,
                        totalDurationMinutes = completed.sumOf {
                            it.resultDurationSec?.let { s -> s / 60 } ?: (it.durationMinutes ?: 0)
                        },
                        totalDistanceKm = if (type == WorkoutType.RUNNING) totalDist else null,
                        averageDurationMinutes = if (completed.isEmpty()) 0.0 else
                            completed.sumOf { it.resultDurationSec?.let { s -> s / 60.0 } ?: (it.durationMinutes?.toDouble() ?: 0.0) } / completed.size,
                        completionRate = if (filtered.isEmpty()) 0f else completed.size.toFloat() / filtered.size,
                    )
                }

                // ── Running detail ────────────────────────────────────────────
                val runningCompleted = workouts.filter { it.workoutType == WorkoutType.RUNNING && it.isCompleted }
                val runningDetail = buildRunningDetail(runningCompleted, startDate, today)

                // ── Strength (InstanceSeanceEntity) ──────────────────────────
                val plannedCount   = instanceSeanceDao.countInRange(startDate, today)
                val instancesWithSeries = instanceSeanceDao.getCompletedWithSeriesInRange(startDate, today)
                val exerciseStats  = instanceSeanceDao.getExerciseStatsFull(startDate, today)

                val strengthStats = run {
                    val completed = instancesWithSeries.size
                    val durations = instancesWithSeries.map { it.instance.durationSeconds / 60 }
                    val totalDurMin = durations.sum()
                    SportStats(
                        totalSessions = plannedCount,
                        completedSessions = completed,
                        totalDurationMinutes = totalDurMin,
                        averageDurationMinutes = if (completed == 0) 0.0 else totalDurMin.toDouble() / completed,
                        completionRate = if (plannedCount == 0) 0f else completed.toFloat() / plannedCount,
                    )
                }

                val strengthDetail = buildStrengthDetail(
                    plannedCount, instancesWithSeries, exerciseStats, startDate
                )

                // ── Volume hebdomadaire ───────────────────────────────────────
                val last7Days = (6 downTo 0).map { today.minusDays(it.toLong()) }
                val weeklyVolume = last7Days.map { date ->
                    val dayWorkouts = workouts.filter { it.scheduledDate == date }
                    val dayStrength = instancesWithSeries.filter { it.instance.date == date }
                    DayVolume(
                        dayLabel = date.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.FRENCH),
                        runningMinutes = dayWorkouts.filter { it.workoutType == WorkoutType.RUNNING }
                            .sumOf { it.resultDurationSec?.let { s -> s / 60 } ?: (it.durationMinutes ?: 0) }.toFloat(),
                        cyclingMinutes = dayWorkouts.filter { it.workoutType == WorkoutType.CYCLING }
                            .sumOf { it.durationMinutes ?: 0 }.toFloat(),
                        strengthMinutes = dayStrength.sumOf { it.instance.durationSeconds / 60 }.toFloat(),
                    )
                }

                _uiState.value = StatsUiState(
                    isLoading = false,
                    period = period,
                    runningStats = runningCyclingStats(WorkoutType.RUNNING),
                    cyclingStats = runningCyclingStats(WorkoutType.CYCLING),
                    strengthStats = strengthStats,
                    weeklyVolume = weeklyVolume,
                    strengthDetail = strengthDetail,
                    runningDetail = runningDetail,
                    statsConfig = statsConfig,
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    // ── Strength detail ───────────────────────────────────────────────────────

    private suspend fun buildStrengthDetail(
        plannedCount: Int,
        instancesWithSeries: List<com.pandafit.core.database.relations.InstanceWithSeries>,
        exerciseStats: List<com.pandafit.core.database.dao.ExerciseStatFull>,
        startDate: LocalDate,
    ): StrengthDetailStats {
        // ── Mapping exerciceSeanceId → exerciseId + repsType (nécessaire avant le calcul tonnage) ──
        val seanceIds = instancesWithSeries.map { it.instance.seanceId }.distinct()
        val exerciceMappings = if (seanceIds.isNotEmpty())
            instanceSeanceDao.getExerciceMappingsForSeances(seanceIds)
        else emptyList()
        val exerciceToExercise = exerciceMappings.associate { it.id to it.exerciseId }
        val exerciceToRepsType = exerciceMappings.associate { it.id to it.repsType }

        val allSeries = instancesWithSeries.flatMap { it.series }.filter { it.isCompleted }
        val totalSeries = allSeries.size
        // Séries de type DURATION : repsRealisees = secondes, pas des reps → 0 pour les stats
        val totalReps = allSeries.sumOf { s ->
            if (exerciceToRepsType[s.exerciceSeanceId] == RepsType.DURATION) 0
            else s.repsRealisees ?: 0
        }
        val totalTonnage = allSeries.sumOf { s ->
            if (exerciceToRepsType[s.exerciceSeanceId] == RepsType.DURATION) 0.0
            else (s.chargeKg?.toDouble() ?: 0.0) * (s.repsRealisees ?: 0)
        }
        val durations = instancesWithSeries.map { it.instance.durationSeconds / 60 }
        val avgDuration = if (durations.isEmpty()) 0 else durations.average().toInt()
        val maxDuration = durations.maxOrNull() ?: 0

        val maxSeriesCount = exerciseStats.firstOrNull()?.seriesCount ?: 0
        val topExercises = exerciseStats
            .filter { it.seriesCount == maxSeriesCount }
            .map { it.exerciseName to it.seriesCount }
        val top5Exercises = exerciseStats.take(5)

        // Progression: compare first vs last instance for each top exercise

        data class SerieWithDate(val exerciseId: Long, val date: LocalDate, val chargeKg: Float)
        val allSeriesWithDate = instancesWithSeries.flatMap { inst ->
            inst.series.filter { it.isCompleted && it.chargeKg != null }.mapNotNull { serie ->
                val exId = exerciceToExercise[serie.exerciceSeanceId] ?: return@mapNotNull null
                SerieWithDate(exId, inst.instance.date, serie.chargeKg!!)
            }
        }
        val seriesByExercise = allSeriesWithDate.groupBy { it.exerciseId }

        val progressions = top5Exercises.mapNotNull { stat ->
            val series = seriesByExercise[stat.exerciseId] ?: return@mapNotNull null
            val byDate = series.groupBy { it.date }.entries.sortedBy { it.key }
            if (byDate.size < 2) return@mapNotNull null
            val firstMax = byDate.first().value.maxOf { it.chargeKg }
            val lastMax = byDate.last().value.maxOf { it.chargeKg }
            ExerciseProgression(
                exerciseName = stat.exerciseName,
                firstMaxKg = firstMax,
                lastMaxKg = lastMax,
            )
        }.filter { it.deltaKg != null }

        // Muscle group breakdown — in-memory lookup via ExerciseDao to use effectivePrimary
        val exerciseIds = exerciseStats.map { it.exerciseId }
        val exerciseEntities = if (exerciseIds.isNotEmpty())
            exerciseDao.getByIds(exerciseIds).associateBy { it.id }
        else emptyMap()
        val muscleGroups = exerciseStats.groupBy { stat ->
            exerciseEntities[stat.exerciseId]?.effectivePrimary
                ?.takeIf { it.isNotBlank() } ?: stat.musclePrimary.takeIf { it.isNotBlank() } ?: "Autre"
        }.mapValues { (_, stats) -> stats.sumOf { it.seriesCount } }
        val totalMuscle = muscleGroups.values.sum().toFloat()
        val muscleBreakdown = muscleGroups.entries
            .sortedByDescending { it.value }
            .take(6)
            .map { (group, count) ->
                MuscleGroupStat(group, count, if (totalMuscle > 0) count / totalMuscle else 0f)
            }

        return StrengthDetailStats(
            plannedSessions = plannedCount,
            completedSessions = instancesWithSeries.size,
            totalSeries = totalSeries,
            totalReps = totalReps,
            totalTonnageKg = totalTonnage,
            avgDurationMin = avgDuration,
            maxDurationMin = maxDuration,
            topExercises = topExercises,
            exerciseProgressions = progressions,
            muscleBreakdown = muscleBreakdown,
        )
    }

    // ── Running detail ────────────────────────────────────────────────────────

    private fun buildRunningDetail(
        completed: List<com.pandafit.core.database.entities.WorkoutEntity>,
        startDate: LocalDate,
        today: LocalDate,
    ): RunningDetailStats {
        if (completed.isEmpty()) return RunningDetailStats()

        val withDist = completed.filter { (it.resultDistanceKm ?: 0.0) > 0.0 }
        val totalDist = withDist.sumOf { it.resultDistanceKm!! }
        val totalSec  = completed.sumOf { it.resultDurationSec ?: (it.durationMinutes?.let { m -> m * 60 } ?: 0) }

        val paces = completed.mapNotNull { it.resultPaceAvgMinPerKm }.filter { it > 0.0 }
        val avgPace  = if (paces.isEmpty()) 0.0 else paces.average()
        val bestPace = paces.minOrNull() ?: 0.0

        val hrs        = completed.mapNotNull { it.resultHrAvg }.filter { it > 0 }
        val avgHr      = if (hrs.isEmpty()) 0 else hrs.average().toInt()
        // FCmax = max des FCmax saisies par séance (pas la moyenne des FCmoy)
        val maxHr      = completed.mapNotNull { it.resultHrMax }.filter { it > 0 }.maxOrNull()
                      ?: hrs.maxOrNull() ?: 0
        val totalElev  = completed.sumOf { it.resultElevationM ?: 0 }

        val longestKm = withDist.maxOfOrNull { it.resultDistanceKm!! } ?: 0.0

        // Distance + allure progression week by week
        val weekFields = WeekFields.of(Locale.FRENCH)
        val weeklyPaces = completed
            .filter { (it.resultDistanceKm ?: 0.0) > 0.0 }
            .groupBy { w ->
                val d = w.scheduledDate
                "${d.get(weekFields.weekBasedYear())}-${d.get(weekFields.weekOfWeekBasedYear())}"
            }
            .entries
            .sortedBy { it.key }
            .takeLast(8)
            .map { (_, ws) ->
                val date = ws.first().scheduledDate
                val label = "S${date.get(weekFields.weekOfWeekBasedYear())}"
                val weekDist = ws.mapNotNull { it.resultDistanceKm }.sum()
                val avgPace = ws.mapNotNull { it.resultPaceAvgMinPerKm }.let { if (it.isEmpty()) 0.0 else it.average() }
                WeeklyPace(label, avgPace, weekDist)
            }

        return RunningDetailStats(
            completedSessions = completed.size,
            totalDistanceKm = totalDist,
            totalDurationSec = totalSec,
            avgPaceMinPerKm = avgPace,
            bestPaceMinPerKm = bestPace,
            avgHrBpm = avgHr,
            maxHrBpm = maxHr,
            totalElevationM = totalElev,
            longestSessionKm = longestKm,
            weeklyPaces = weeklyPaces,
        )
    }
}
