package com.pandafit.feature.stats.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsBike
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.Air
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.roundToInt
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.designsystem.components.PandaCard
import com.pandafit.designsystem.components.PandaErrorState
import com.pandafit.designsystem.components.PandaFilterChip
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.components.SportIconBadge
import com.pandafit.designsystem.theme.PandaBlue
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaOrange
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.stats.model.BreathingDetailStats
import com.pandafit.feature.stats.model.CyclingDetailStats
import com.pandafit.feature.stats.model.DeltaDirection
import com.pandafit.feature.stats.model.ExerciseProgression
import com.pandafit.feature.stats.model.MethodStat
import com.pandafit.feature.stats.model.MuscleGroupStat
import com.pandafit.feature.stats.model.RunningDetailStats
import com.pandafit.feature.stats.model.SportStats
import com.pandafit.feature.stats.model.StatDelta
import com.pandafit.feature.stats.model.StatsConfig
import com.pandafit.feature.stats.model.StatsPeriod
import com.pandafit.feature.stats.model.StatsUiState
import com.pandafit.feature.stats.model.StrengthDetailStats
import com.pandafit.feature.stats.model.WeeklyBreathingCount
import com.pandafit.feature.stats.model.WeeklyPace
import com.pandafit.feature.stats.model.WeeklyTonnage
import com.pandafit.feature.stats.model.deltaAbsoluteDouble
import com.pandafit.feature.stats.model.deltaAbsoluteInt
import com.pandafit.feature.stats.model.deltaPercent
import com.pandafit.feature.stats.R
import com.pandafit.feature.stats.viewmodel.StatsViewModel

private val BreathingTeal = Color(0xFF00897B)
private val ProgressionGradientEnd = Color(0xFF8A6EE8)

private enum class StatsTab { TOUT, RENFO, COURSE, VELO, RESPI }

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun StatsScreen(
    onOpenDrawer: () -> Unit = {},
    viewModel: StatsViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var selectedTab by remember { mutableStateOf(StatsTab.TOUT) }

    // Recalcul à chaque retour sur cet écran (drawer navigation préserve le ViewModel)
    val lifecycleOwner = LocalLifecycleOwner.current
    LaunchedEffect(lifecycleOwner) {
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            viewModel.reload()
        }
    }

    Scaffold(
        topBar = { PandaTopBar(title = stringResource(R.string.stats_screen_title), onOpenDrawer = onOpenDrawer) },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        if (uiState.isLoading) { PandaLoadingIndicator(); return@Scaffold }
        if (uiState.error != null) { PandaErrorState(description = uiState.error!!, modifier = Modifier.padding(innerPadding)); return@Scaffold }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(start = 16.dp, top = 16.dp, end = 16.dp, bottom = 88.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Sélecteur de période + onglets de filtrage — stickys en haut
            stickyHeader {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.background)
                        .padding(bottom = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatsPeriod.entries.forEach { period ->
                            PandaFilterChip(
                                label = periodLabel(period),
                                selected = uiState.period == period,
                                onSelectedChange = { if (it) viewModel.setPeriod(period) },
                                selectedColor = PandaGreen,
                            )
                        }
                    }
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(StatsTab.entries.toList()) { tab ->
                            PandaFilterChip(
                                label = tabLabel(tab),
                                selected = selectedTab == tab,
                                onSelectedChange = { if (it) selectedTab = tab },
                                selectedColor = PandaPurple,
                            )
                        }
                    }
                }
            }

            // Vue d'ensemble — uniquement sur l'onglet "Tout"
            if (selectedTab == StatsTab.TOUT) {
                item { GlobalSummaryRow(uiState) }
            }

            // Hero progression — mis en avant sur l'onglet "Tout" et l'onglet "Renfo"
            if (selectedTab == StatsTab.TOUT || selectedTab == StatsTab.RENFO) {
                item { ProgressionHeroCard(uiState.strengthDetail) }
            }

            // Renforcement
            if (selectedTab == StatsTab.TOUT || selectedTab == StatsTab.RENFO) {
                item {
                    SectionHeader(
                        title = stringResource(R.string.stats_section_strength),
                        icon = Icons.Default.FitnessCenter,
                        color = PandaPurple,
                    )
                    Spacer(Modifier.height(8.dp))
                    StrengthSection(uiState.strengthStats, uiState.strengthDetail, uiState.previousStrengthDetail, uiState.statsConfig)
                }
            }

            // Running
            if (selectedTab == StatsTab.TOUT || selectedTab == StatsTab.COURSE) {
                item {
                    SectionHeader(
                        title = stringResource(R.string.stats_section_running),
                        icon = Icons.AutoMirrored.Filled.DirectionsRun,
                        color = PandaGreen,
                    )
                    Spacer(Modifier.height(8.dp))
                    RunningSection(uiState.runningStats, uiState.runningDetail, uiState.previousRunningDetail, uiState.statsConfig)
                }
            }

            // Vélo
            if (selectedTab == StatsTab.TOUT || selectedTab == StatsTab.VELO) {
                item {
                    SectionHeader(
                        title = stringResource(R.string.stats_section_cycling),
                        icon = Icons.AutoMirrored.Filled.DirectionsBike,
                        color = PandaBlue,
                    )
                    Spacer(Modifier.height(8.dp))
                    CyclingSection(uiState.cyclingStats, uiState.cyclingDetail, uiState.previousCyclingDetail, uiState.statsConfig)
                }
            }

            // Respiration
            if (selectedTab == StatsTab.TOUT || selectedTab == StatsTab.RESPI) {
                item {
                    SectionHeader(
                        title = stringResource(R.string.stats_section_breathing),
                        icon  = Icons.Default.Air,
                        color = BreathingTeal,
                    )
                    Spacer(Modifier.height(8.dp))
                    BreathingSection(uiState.breathingDetail)
                }
            }
        }
    }
}

// ── Vue d'ensemble ─────────────────────────────────────────────────────────────

@Composable
private fun GlobalSummaryRow(uiState: StatsUiState) {
    val planned = uiState.strengthStats.totalSessions +
            uiState.runningStats.totalSessions +
            uiState.cyclingStats.totalSessions
    val completed = uiState.strengthStats.completedSessions +
            uiState.runningStats.completedSessions +
            uiState.cyclingStats.completedSessions
    val totalMin = uiState.strengthStats.totalDurationMinutes +
            uiState.runningStats.totalDurationMinutes +
            uiState.cyclingStats.totalDurationMinutes
    val completionPct = if (planned == 0) 0 else (completed * 100 / planned)

    val prevPlanned = uiState.previousStrengthStats.totalSessions +
            uiState.previousRunningStats.totalSessions +
            uiState.previousCyclingStats.totalSessions
    val prevCompleted = uiState.previousStrengthStats.completedSessions +
            uiState.previousRunningStats.completedSessions +
            uiState.previousCyclingStats.completedSessions
    val prevTotalMin = uiState.previousStrengthStats.totalDurationMinutes +
            uiState.previousRunningStats.totalDurationMinutes +
            uiState.previousCyclingStats.totalDurationMinutes
    val prevCompletionPct = if (prevPlanned == 0) 0 else (prevCompleted * 100 / prevPlanned)

    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        StatMiniCard(stringResource(R.string.stats_mini_card_sessions), "$completed/$planned", deltaAbsoluteInt(completed, prevCompleted), PandaGreen, Modifier.weight(1f))
        StatMiniCard(stringResource(R.string.stats_mini_card_duration), formatDuration(totalMin), deltaPercent(totalMin, prevTotalMin), PandaBlue, Modifier.weight(1f))
        StatMiniCard(stringResource(R.string.stats_mini_card_completion), "$completionPct%", deltaAbsoluteInt(completionPct, prevCompletionPct), PandaPurple, Modifier.weight(1f))
    }
}

// ── Hero progression ────────────────────────────────────────────────────────────

@Composable
private fun ProgressionHeroCard(detail: StrengthDetailStats) {
    if (detail.exerciseProgressions.isEmpty()) return

    val sorted = detail.exerciseProgressions.sortedByDescending { it.deltaKg ?: 0f }
    val totalGain = sorted.sumOf { (it.deltaKg ?: 0f).coerceAtLeast(0f).toDouble() }
    val progressingCount = sorted.count { (it.deltaKg ?: 0f) > 0f }
    val stalledCount = sorted.size - progressingCount

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(Brush.linearGradient(listOf(PandaPurple, ProgressionGradientEnd)))
            .padding(16.dp),
    ) {
        Column {
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "+${"%.1f".format(totalGain)} kg",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                )
                Text(
                    stringResource(R.string.stats_hero_gain_label),
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.9f),
                )
            }
            Text(
                stringResource(R.string.stats_hero_subtitle, progressingCount, stalledCount),
                style = MaterialTheme.typography.labelSmall,
                color = Color.White.copy(alpha = 0.85f),
            )
            Spacer(Modifier.height(13.dp))
            Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                sorted.forEach { prog -> HeroProgressionRow(prog) }
            }
        }
    }
}

@Composable
private fun HeroProgressionRow(prog: ExerciseProgression) {
    val delta = prog.deltaKg ?: 0f
    val stalled = delta <= 0f
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Color.White.copy(alpha = 0.15f))
            .padding(horizontal = 11.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            prog.exerciseName,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.SemiBold,
            color = Color.White.copy(alpha = if (stalled) 0.8f else 1f),
            modifier = Modifier.weight(1f),
            maxLines = 1,
        )
        Text(
            if (stalled) "${stringResource(R.string.stats_hero_stalled)} · 0 kg" else "+${"%.1f".format(delta)} kg",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = Color.White,
        )
    }
}

// ── Renforcement ───────────────────────────────────────────────────────────────

@Composable
private fun StrengthSection(stats: SportStats, detail: StrengthDetailStats, previous: StrengthDetailStats, config: StatsConfig) {
    if (detail.plannedSessions == 0) {
        EmptyCard()
        return
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        // Fun stats panda (1 poids + 1 monument) — mis en avant en haut de section
        if (detail.totalTonnageKg >= 1.0) {
            FunStrengthCard(detail.totalTonnageKg, config)
        }

        // Chiffres clés
        PandaCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatItem(stringResource(R.string.stats_mini_card_sessions), "${detail.completedSessions}/${detail.plannedSessions}", deltaAbsoluteInt(detail.completedSessions, previous.completedSessions), Modifier.weight(1f))
                    StatItem(stringResource(R.string.stats_strength_series_label), detail.totalSeries.toString(), deltaPercent(detail.totalSeries, previous.totalSeries), Modifier.weight(1f))
                    StatItem(stringResource(R.string.stats_strength_reps_label), detail.totalReps.toString(), deltaPercent(detail.totalReps, previous.totalReps), Modifier.weight(1f))
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatItem(stringResource(R.string.stats_strength_tonnage_label), formatTonnage(detail.totalTonnageKg), deltaPercent(detail.totalTonnageKg, previous.totalTonnageKg), Modifier.weight(1f))
                    StatItem(stringResource(R.string.stats_strength_avg_duration), formatDuration(detail.avgDurationMin), deltaPercent(detail.avgDurationMin, previous.avgDurationMin), Modifier.weight(1f))
                    StatItem(stringResource(R.string.stats_strength_max_duration), formatDuration(detail.maxDurationMin), null, Modifier.weight(1f))
                }
                if (detail.topExercises.isNotEmpty()) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        val label = if (detail.topExercises.size > 1) "🏆 Exercices phares" else "🏆 Exercice phare"
                        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
                        detail.topExercises.forEach { (name, count) ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(name, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                                Text("$count séries", style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
                            }
                        }
                    }
                }
            }
        }

        // Tonnage par semaine
        if (detail.weeklyTonnage.size >= 2) {
            PandaCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(stringResource(R.string.stats_strength_weekly_tonnage), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = PandaSubtext)
                    Spacer(Modifier.height(8.dp))
                    WeeklyTonnageChart(detail.weeklyTonnage)
                }
            }
        }

        // Répartition musculaire
        if (detail.muscleBreakdown.isNotEmpty()) {
            PandaCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(stringResource(R.string.stats_strength_muscle_breakdown), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = PandaSubtext)
                    Spacer(Modifier.height(8.dp))
                    detail.muscleBreakdown.forEach { muscle ->
                        MuscleBar(muscle)
                        Spacer(Modifier.height(6.dp))
                    }
                    MuscleImbalanceFlag(detail.muscleBreakdown)
                }
            }
        }

        // Taux de complétion
        CompletionBar(stats.completionRate, PandaPurple)
    }
}

@Composable
private fun MuscleImbalanceFlag(muscleBreakdown: List<MuscleGroupStat>) {
    if (muscleBreakdown.size < 2) return
    val maxCount = muscleBreakdown.maxOf { it.seriesCount }
    val flagged = muscleBreakdown.filter { it.seriesCount < maxCount * 0.4f }
    if (flagged.isEmpty()) return

    Spacer(Modifier.height(8.dp))
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(11.dp))
            .background(PandaOrange.copy(alpha = 0.10f))
            .padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        Text(
            stringResource(R.string.stats_strength_imbalance_flag, flagged.joinToString(", ") { it.group }),
            style = MaterialTheme.typography.labelSmall,
            color = PandaOrange,
        )
    }
}

@Composable
private fun FunStrengthCard(tonnageKg: Double, config: StatsConfig) {
    val weight = config.strWeight
    val monument = config.strMonument
    val v = tonnageKg / weight.kg
    val vMonument = tonnageKg / monument.kg * 100

    val items = listOf(
        FunCardData(
            emoji = weight.emoji,
            headline = "${formatMultiple(v)}× ${weight.label}",
            sentence = "Tu as soulevé l'équivalent de ${formatMultiple(v)} ${weight.label} en tonnage !",
            color = PandaPurple,
        ),
        FunCardData(
            emoji = monument.emoji,
            headline = "${"%.4f".format(vMonument)}%",
            sentence = "Ton tonnage représente ${"%.4f".format(vMonument)}% du poids de ${monument.label} !",
            color = PandaPurple,
        ),
    )
    FunCardPager(items)
}

@Composable
private fun WeeklyTonnageChart(weeklyTonnage: List<WeeklyTonnage>) {
    val maxTonnage = weeklyTonnage.maxOf { it.tonnageKg }.coerceAtLeast(0.01)
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        weeklyTonnage.forEach { wt ->
            val normalized = ((wt.tonnageKg / maxTonnage) * 0.8 + 0.2).toFloat().coerceIn(0.2f, 1f)
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(formatTonnage(wt.tonnageKg), style = MaterialTheme.typography.labelSmall.copy(fontSize = 8.sp), color = PandaSubtext, maxLines = 1)
                Spacer(Modifier.height(2.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height((normalized * 60).dp)
                        .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                        .background(PandaPurple),
                )
                Spacer(Modifier.height(2.dp))
                Text(wt.weekLabel, style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp), color = PandaSubtext)
            }
        }
    }
}

@Composable
private fun MuscleBar(muscle: MuscleGroupStat) {
    Column {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(muscle.group, style = MaterialTheme.typography.bodySmall)
            Text("${(muscle.percentage * 100).toInt()}% · ${muscle.seriesCount} séries", style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
        }
        Spacer(Modifier.height(3.dp))
        Box(
            modifier = Modifier.fillMaxWidth().height(6.dp)
                .clip(RoundedCornerShape(3.dp))
                .background(PandaPurple.copy(alpha = 0.12f)),
        ) {
            Box(
                modifier = Modifier.fillMaxWidth(muscle.percentage).height(6.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(PandaPurple),
            )
        }
    }
}

// ── Running ────────────────────────────────────────────────────────────────────

@Composable
private fun RunningSection(stats: SportStats, detail: RunningDetailStats, previous: RunningDetailStats, config: StatsConfig) {
    if (stats.totalSessions == 0) {
        EmptyCard()
        return
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        // Fun stats distance (1 distance + 1 sommet) — mis en avant en haut de section
        if (detail.totalDistanceKm >= 0.4) {
            FunRunningCard(detail.totalDistanceKm, detail.totalElevationM, config)
        }

        // Chiffres clés
        PandaCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatItem(stringResource(R.string.stats_mini_card_sessions), "${stats.completedSessions}/${stats.totalSessions}", deltaAbsoluteInt(stats.completedSessions, previous.completedSessions), Modifier.weight(1f))
                    StatItem(stringResource(R.string.stats_running_distance), "${"%.1f".format(detail.totalDistanceKm)} km", deltaPercent(detail.totalDistanceKm, previous.totalDistanceKm), Modifier.weight(1f))
                    StatItem(stringResource(R.string.stats_mini_card_duration), formatSeconds(detail.totalDurationSec), deltaPercent(detail.totalDurationSec, previous.totalDurationSec), Modifier.weight(1f))
                }
                if (detail.avgPaceMinPerKm > 0) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatItem(
                            stringResource(R.string.stats_running_avg_pace), formatPace(detail.avgPaceMinPerKm),
                            if (previous.avgPaceMinPerKm > 0) deltaAbsoluteDouble(detail.avgPaceMinPerKm * 60, previous.avgPaceMinPerKm * 60, " s/km", 0) else null,
                            Modifier.weight(1f),
                            invertColors = true,
                        )
                        StatItem(stringResource(R.string.stats_running_best_pace), formatPace(detail.bestPaceMinPerKm), null, Modifier.weight(1f))
                        StatItem(stringResource(R.string.stats_running_longest), if (detail.longestSessionKm > 0) "${"%.1f".format(detail.longestSessionKm)} km" else "—", null, Modifier.weight(1f))
                    }
                }
                if (detail.avgHrBpm > 0 || detail.maxHrBpm > 0 || detail.totalElevationM > 0) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (detail.avgHrBpm > 0) StatItem(stringResource(R.string.stats_running_avg_hr), "${detail.avgHrBpm} bpm", if (previous.avgHrBpm > 0) deltaAbsoluteInt(detail.avgHrBpm, previous.avgHrBpm, " bpm") else null, Modifier.weight(1f), invertColors = true)
                        else Spacer(Modifier.weight(1f))
                        if (detail.maxHrBpm > 0) StatItem(stringResource(R.string.stats_running_max_hr), "${detail.maxHrBpm} bpm", null, Modifier.weight(1f))
                        else Spacer(Modifier.weight(1f))
                        if (detail.totalElevationM > 0) StatItem(stringResource(R.string.stats_running_elevation), "${detail.totalElevationM} m", deltaPercent(detail.totalElevationM, previous.totalElevationM), Modifier.weight(1f))
                        else Spacer(Modifier.weight(1f))
                    }
                }
                if (detail.avgCadencePpm > 0) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatItem(stringResource(R.string.stats_running_cadence), "${detail.avgCadencePpm} ppm", null, Modifier.weight(1f))
                        Spacer(Modifier.weight(1f))
                        Spacer(Modifier.weight(1f))
                    }
                }
            }
        }

        // Stats poussette — visible uniquement si au moins une séance poussette dans la période
        if (detail.strollerSessions > 0) {
            PandaCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        stringResource(R.string.stats_running_stroller),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = PandaSubtext,
                    )
                    Spacer(Modifier.height(4.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatItem(
                            stringResource(R.string.stats_mini_card_sessions),
                            "${detail.strollerSessions}",
                            null,
                            Modifier.weight(1f),
                        )
                        StatItem(
                            stringResource(R.string.stats_running_distance),
                            "${"%.1f".format(detail.strollerDistanceKm)} km",
                            null,
                            Modifier.weight(1f),
                        )
                        StatItem(
                            stringResource(R.string.stats_running_stroller_distance),
                            "${(detail.strollerDistancePct * 100).toInt()}%",
                            null,
                            Modifier.weight(1f),
                        )
                    }
                }
            }
        }

        // Distance par semaine
        if (detail.weeklyPaces.size >= 2) {
            PandaCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(stringResource(R.string.stats_running_weekly_distance), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = PandaSubtext)
                    Spacer(Modifier.height(8.dp))
                    WeeklyDistanceChart(detail.weeklyPaces)
                }
            }
        }

        // Taux de complétion
        CompletionBar(stats.completionRate, PandaGreen)
    }
}

@Composable
private fun FunRunningCard(distanceKm: Double, totalElevationM: Int, config: StatsConfig) {
    val dist   = config.runDist
    val summit = config.runSummit

    val pct = distanceKm / dist.km * 100
    val pctSummit = if (summit.elevationM > 0 && totalElevationM > 0)
        totalElevationM.toDouble() / summit.elevationM * 100 else 0.0

    val items = buildList {
        add(
            FunCardData(
                emoji = dist.emoji,
                headline = "${"%.2f".format(pct)}%",
                sentence = "Tu as couvert ${"%.2f".format(pct)}% d'un trajet ${dist.label} !",
                color = PandaGreen,
            )
        )
        if (pctSummit > 0.0) {
            add(
                FunCardData(
                    emoji = summit.emoji,
                    headline = "${"%.1f".format(pctSummit)}%",
                    sentence = "Ton dénivelé représente ${"%.1f".format(pctSummit)}% du ${summit.label} !",
                    color = PandaGreen,
                )
            )
        }
    }
    FunCardPager(items)
}

@Composable
private fun WeeklyDistanceChart(weeklyPaces: List<WeeklyPace>) {
    val maxDist = weeklyPaces.maxOf { it.weeklyDistanceKm }.coerceAtLeast(0.01)
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        weeklyPaces.forEach { wp ->
            val normalized = ((wp.weeklyDistanceKm / maxDist) * 0.8 + 0.2).toFloat().coerceIn(0.2f, 1f)
            val distLabel = if (wp.weeklyDistanceKm >= 10) "${"%.0f".format(wp.weeklyDistanceKm)} km"
                            else "${"%.1f".format(wp.weeklyDistanceKm)} km"
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(distLabel, style = MaterialTheme.typography.labelSmall.copy(fontSize = 8.sp), color = PandaSubtext, maxLines = 1)
                Spacer(Modifier.height(2.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height((normalized * 60).dp)
                        .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                        .background(PandaGreen),
                )
                Spacer(Modifier.height(2.dp))
                Text(wp.weekLabel, style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp), color = PandaSubtext)
            }
        }
    }
}

// ── Vélo ───────────────────────────────────────────────────────────────────────

@Composable
private fun CyclingSection(stats: SportStats, detail: CyclingDetailStats, previous: CyclingDetailStats, config: StatsConfig) {
    if (stats.totalSessions == 0) { EmptyCard(); return }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        // Fun stats distance vélo (1 distance + 1 sommet) — mis en avant en haut de section
        if (detail.totalDistanceKm >= 0.1) {
            FunCyclingCard(detail.totalDistanceKm, detail.totalElevationM, config)
        }

        PandaCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                // Ligne 1 : séances / distance / durée
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatItem(stringResource(R.string.stats_mini_card_sessions), "${stats.completedSessions}/${stats.totalSessions}", deltaAbsoluteInt(stats.completedSessions, previous.completedSessions), Modifier.weight(1f))
                    StatItem(
                        stringResource(R.string.stats_cycling_distance),
                        if (detail.totalDistanceKm > 0) "${"%.1f".format(detail.totalDistanceKm)} km" else "—",
                        if (detail.totalDistanceKm > 0) deltaPercent(detail.totalDistanceKm, previous.totalDistanceKm) else null,
                        Modifier.weight(1f),
                    )
                    StatItem(stringResource(R.string.stats_mini_card_duration), formatSeconds(detail.totalDurationSec), null, Modifier.weight(1f))
                }
                // Ligne 2 : vitesse moy / meilleure / + longue
                if (detail.avgSpeedKmh > 0 || detail.longestSessionKm > 0) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatItem(
                            stringResource(R.string.stats_cycling_avg_speed),
                            if (detail.avgSpeedKmh > 0) "${"%.1f".format(detail.avgSpeedKmh)} km/h" else "—",
                            if (detail.avgSpeedKmh > 0 && previous.avgSpeedKmh > 0) deltaPercent(detail.avgSpeedKmh, previous.avgSpeedKmh) else null,
                            Modifier.weight(1f),
                        )
                        StatItem(
                            stringResource(R.string.stats_cycling_best_speed),
                            if (detail.bestSpeedKmh > 0) "${"%.1f".format(detail.bestSpeedKmh)} km/h" else "—",
                            null,
                            Modifier.weight(1f),
                        )
                        StatItem(
                            stringResource(R.string.stats_cycling_longest),
                            if (detail.longestSessionKm > 0) "${"%.1f".format(detail.longestSessionKm)} km" else "—",
                            null,
                            Modifier.weight(1f),
                        )
                    }
                }
                // Ligne 3 : FC moy. / FC max / Dénivelé+
                if (detail.avgHrBpm > 0 || detail.maxHrBpm > 0 || detail.totalElevationM > 0) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (detail.avgHrBpm > 0) StatItem(stringResource(R.string.stats_cycling_avg_hr), "${detail.avgHrBpm} bpm", if (previous.avgHrBpm > 0) deltaAbsoluteInt(detail.avgHrBpm, previous.avgHrBpm, " bpm") else null, Modifier.weight(1f), invertColors = true)
                        else Spacer(Modifier.weight(1f))
                        if (detail.maxHrBpm > 0) StatItem(stringResource(R.string.stats_cycling_max_hr), "${detail.maxHrBpm} bpm", null, Modifier.weight(1f))
                        else Spacer(Modifier.weight(1f))
                        if (detail.totalElevationM > 0) StatItem(stringResource(R.string.stats_cycling_elevation), "${detail.totalElevationM} m", deltaPercent(detail.totalElevationM, previous.totalElevationM), Modifier.weight(1f))
                        else Spacer(Modifier.weight(1f))
                    }
                }
                // Ligne 4 : Cadence (si renseignée)
                if (detail.avgCadenceRpm > 0) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatItem(stringResource(R.string.stats_cycling_cadence), "${detail.avgCadenceRpm} rpm", null, Modifier.weight(1f))
                        Spacer(Modifier.weight(1f))
                        Spacer(Modifier.weight(1f))
                    }
                }
            }
        }

        // Distance par semaine
        if (detail.weeklyDistances.isNotEmpty()) {
            PandaCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(stringResource(R.string.stats_cycling_weekly_distance), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = PandaSubtext)
                    Spacer(Modifier.height(8.dp))
                    WeeklyCyclingDistanceChart(detail.weeklyDistances)
                }
            }
        }

        CompletionBar(stats.completionRate, PandaBlue)
    }
}

@Composable
private fun FunCyclingCard(distanceKm: Double, totalElevationM: Int, config: StatsConfig) {
    val dist   = config.cycDist
    val summit = config.cycSummit

    val pct = distanceKm / dist.km * 100
    val pctSummit = if (summit.elevationM > 0 && totalElevationM > 0)
        totalElevationM.toDouble() / summit.elevationM * 100 else 0.0

    val items = buildList {
        add(
            FunCardData(
                emoji = dist.emoji,
                headline = "${"%.2f".format(pct)}%",
                sentence = "Tu as couvert ${"%.2f".format(pct)}% d'un trajet ${dist.label} !",
                color = PandaBlue,
            )
        )
        if (pctSummit > 0.0) {
            add(
                FunCardData(
                    emoji = summit.emoji,
                    headline = "${"%.1f".format(pctSummit)}%",
                    sentence = "Ton dénivelé représente ${"%.1f".format(pctSummit)}% du ${summit.label} !",
                    color = PandaBlue,
                )
            )
        }
    }
    FunCardPager(items)
}

@Composable
private fun WeeklyCyclingDistanceChart(weeklyDistances: List<WeeklyPace>) {
    val maxDist = weeklyDistances.maxOf { it.weeklyDistanceKm }.coerceAtLeast(0.01)
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        weeklyDistances.forEach { wp ->
            val normalized = ((wp.weeklyDistanceKm / maxDist) * 0.8 + 0.2).toFloat().coerceIn(0.2f, 1f)
            val distLabel = if (wp.weeklyDistanceKm >= 10) "${"%.0f".format(wp.weeklyDistanceKm)} km"
                            else "${"%.1f".format(wp.weeklyDistanceKm)} km"
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(distLabel, style = MaterialTheme.typography.labelSmall.copy(fontSize = 8.sp), color = PandaSubtext, maxLines = 1)
                Spacer(Modifier.height(2.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height((normalized * 60).dp)
                        .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                        .background(PandaBlue),
                )
                Spacer(Modifier.height(2.dp))
                Text(wp.weekLabel, style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp), color = PandaSubtext)
            }
        }
    }
}

// ── Respiration ────────────────────────────────────────────────────────────────

@Composable
private fun BreathingSection(detail: BreathingDetailStats) {
    if (detail.totalSessions == 0) { EmptyCard(); return }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        // Chiffres clés
        PandaCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatItem(stringResource(R.string.stats_mini_card_sessions), detail.totalSessions.toString(), null, Modifier.weight(1f))
                    StatItem(stringResource(R.string.stats_breathing_total_duration), formatSeconds(detail.totalDurationSeconds), null, Modifier.weight(1f))
                    StatItem(stringResource(R.string.stats_breathing_avg_duration), formatSeconds(detail.avgDurationSeconds), null, Modifier.weight(1f))
                }
                if (detail.favoriteMethod != null) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(stringResource(R.string.stats_breathing_favorite_method), style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
                        Spacer(Modifier.width(8.dp))
                        Text(
                            detail.favoriteMethod,
                            style      = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
        }

        // Répartition par méthode
        if (detail.methodBreakdown.size >= 2) {
            PandaCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(stringResource(R.string.stats_breathing_method_breakdown), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = PandaSubtext)
                    Spacer(Modifier.height(8.dp))
                    detail.methodBreakdown.forEach { stat ->
                        BreathingMethodBar(stat)
                        Spacer(Modifier.height(6.dp))
                    }
                }
            }
        }

        // Tendance hebdomadaire
        val hasVariation = detail.weeklySessionCounts.any { it.count > 0 }
        if (detail.weeklySessionCounts.size >= 2 && hasVariation) {
            PandaCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(stringResource(R.string.stats_breathing_weekly_sessions), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = PandaSubtext)
                    Spacer(Modifier.height(8.dp))
                    WeeklyBreathingChart(detail.weeklySessionCounts)
                }
            }
        }
    }
}

@Composable
private fun BreathingMethodBar(stat: MethodStat) {
    Column {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(stat.methodName, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f), maxLines = 1)
            Text(
                "${(stat.percentage * 100).toInt()}% · ${stat.sessionCount} séance${if (stat.sessionCount > 1) "s" else ""}",
                style = MaterialTheme.typography.labelSmall,
                color = PandaSubtext,
            )
        }
        Spacer(Modifier.height(3.dp))
        Box(
            modifier = Modifier.fillMaxWidth().height(6.dp)
                .clip(RoundedCornerShape(3.dp))
                .background(BreathingTeal.copy(alpha = 0.12f)),
        ) {
            Box(
                modifier = Modifier.fillMaxWidth(stat.percentage).height(6.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(BreathingTeal),
            )
        }
    }
}

@Composable
private fun WeeklyBreathingChart(weeks: List<WeeklyBreathingCount>) {
    val maxCount = weeks.maxOf { it.count }.coerceAtLeast(1)
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        weeks.forEach { w ->
            val normalized = if (w.count == 0) 0.05f else ((w.count.toFloat() / maxCount) * 0.8f + 0.2f).coerceIn(0.05f, 1f)
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    if (w.count > 0) "${w.count}" else "",
                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 8.sp),
                    color = PandaSubtext,
                )
                Spacer(Modifier.height(2.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height((normalized * 60).dp)
                        .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                        .background(if (w.count > 0) BreathingTeal else BreathingTeal.copy(alpha = 0.15f)),
                )
                Spacer(Modifier.height(2.dp))
                Text(w.weekLabel, style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp), color = PandaSubtext)
            }
        }
    }
}

// ── Composants partagés ────────────────────────────────────────────────────────

@Composable
private fun SectionHeader(title: String, icon: ImageVector, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        SportIconBadge(icon = icon, contentDescription = null, accentColor = color, size = 36.dp, iconSize = 18.dp)
        Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun StatMiniCard(label: String, value: String, delta: StatDelta?, color: Color, modifier: Modifier = Modifier) {
    PandaCard(modifier = modifier, containerColor = color.copy(alpha = 0.08f), elevation = 0.dp) {
        Column(modifier = Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = color)
            Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
            if (delta != null) {
                Spacer(Modifier.height(4.dp))
                DeltaChip(delta)
            }
        }
    }
}

@Composable
private fun StatItem(label: String, value: String, delta: StatDelta?, modifier: Modifier = Modifier, invertColors: Boolean = false) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, maxLines = 1)
        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, maxLines = 1)
        if (delta != null) {
            Spacer(Modifier.height(2.dp))
            DeltaChip(delta, invertColors)
        }
    }
}

@Composable
private fun DeltaChip(delta: StatDelta, invertColors: Boolean = false) {
    val color = when (delta.direction) {
        DeltaDirection.UP -> if (invertColors) Color(0xFFD2543B) else Color(0xFF1F9D57)
        DeltaDirection.DOWN -> if (invertColors) Color(0xFF1F9D57) else Color(0xFFD2543B)
        DeltaDirection.FLAT -> PandaSubtext
    }
    Text(
        delta.label,
        style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.5.sp),
        fontWeight = FontWeight.Bold,
        color = color,
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(color.copy(alpha = 0.12f))
            .padding(horizontal = 5.dp, vertical = 1.dp),
        maxLines = 1,
    )
}

// ── Fun cards — carrousel d'équivalents, une carte par page (swipeable) ─────────

private data class FunCardData(
    val emoji: String,
    val headline: String,
    val sentence: String,
    val color: Color,
)

// Carrousel scrollable "maison" (Row + horizontalScroll) plutôt que HorizontalPager : ce module
// est compilé avec une version de compose-foundation différente de celle finalement packagée dans
// l'app (skew multi-module — activity-compose force 1.7.1 alors que le BOM local recommande 1.6.8),
// ce qui casse au runtime (NoSuchMethodError) la signature binaire instable de l'API Pager.
@Composable
private fun FunCardPager(items: List<FunCardData>) {
    if (items.isEmpty()) return
    val scrollState = rememberScrollState()
    val screenWidthDp = LocalConfiguration.current.screenWidthDp.dp
    val cardWidth = if (items.size > 1) screenWidthDp * 0.86f else screenWidthDp - 32.dp

    Column {
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(scrollState),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items.forEach { data ->
                Box(modifier = Modifier.width(cardWidth)) { FunCardBig(data) }
            }
        }
        if (items.size > 1) {
            val activeIndex = if (scrollState.maxValue > 0)
                (scrollState.value.toFloat() / scrollState.maxValue * (items.size - 1)).roundToInt()
            else 0
            Spacer(Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                repeat(items.size) { idx ->
                    val active = activeIndex == idx
                    Box(
                        modifier = Modifier
                            .padding(horizontal = 3.dp)
                            .size(if (active) 7.dp else 6.dp)
                            .clip(CircleShape)
                            .background(if (active) PandaPurple else PandaSubtext.copy(alpha = 0.3f)),
                    )
                }
            }
        }
    }
}

@Composable
private fun FunCardBig(data: FunCardData) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 176.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(Brush.linearGradient(listOf(data.color, data.color.copy(alpha = 0.65f)))),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.padding(20.dp).fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.18f)),
                contentAlignment = Alignment.Center,
            ) {
                Text(data.emoji, fontSize = 34.sp)
            }
            Spacer(Modifier.height(12.dp))
            Text(
                data.headline,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.ExtraBold,
                color = Color.White,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                data.sentence,
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.92f),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }
    }
}

private fun formatMultiple(value: Double): String = when {
    value >= 100 -> "%.0f".format(value)
    value >= 10  -> "%.1f".format(value)
    else         -> "%.2f".format(value)
}

@Composable
private fun CompletionBar(rate: Float, color: Color) {
    Column {
        Text(
            stringResource(R.string.stats_completion_bar_label, (rate * 100).toInt()),
            style = MaterialTheme.typography.bodySmall,
            color = PandaSubtext,
        )
        Spacer(Modifier.height(4.dp))
        LinearProgressIndicator(
            progress = { rate },
            modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
            color = color,
            trackColor = color.copy(alpha = 0.15f),
        )
    }
}

@Composable
private fun EmptyCard() {
    PandaCard(modifier = Modifier.fillMaxWidth()) {
        Text(
            stringResource(R.string.stats_empty_period),
            style = MaterialTheme.typography.bodySmall,
            color = PandaSubtext,
            modifier = Modifier.padding(14.dp),
        )
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

private fun periodLabel(period: StatsPeriod) = when (period) {
    StatsPeriod.WEEK         -> "7j"
    StatsPeriod.MONTH        -> "30j"
    StatsPeriod.THREE_MONTHS -> "3m"
    StatsPeriod.YEAR         -> "1an"
}

@Composable
private fun tabLabel(tab: StatsTab): String = when (tab) {
    StatsTab.TOUT    -> stringResource(R.string.stats_tab_all)
    StatsTab.RENFO   -> stringResource(R.string.stats_tab_strength)
    StatsTab.COURSE  -> stringResource(R.string.stats_tab_running)
    StatsTab.VELO    -> stringResource(R.string.stats_tab_cycling)
    StatsTab.RESPI   -> stringResource(R.string.stats_tab_breathing)
}

private fun formatDuration(minutes: Int): String {
    if (minutes <= 0) return "—"
    val h = minutes / 60; val m = minutes % 60
    return if (h > 0) "${h}h${m.toString().padStart(2, '0')}" else "${m}min"
}

private fun formatSeconds(seconds: Int): String {
    if (seconds <= 0) return "—"
    val h = seconds / 3600
    val m = (seconds % 3600) / 60
    val s = seconds % 60
    return when {
        h > 0 -> "${h}h${m.toString().padStart(2, '0')}m${s.toString().padStart(2, '0')}s"
        m > 0 -> "${m}min${if (s > 0) "${s}s" else ""}"
        else  -> "${s}s"
    }
}

private fun formatPace(paceMinPerKm: Double): String {
    if (paceMinPerKm <= 0) return "—"
    val min = paceMinPerKm.toInt()
    val sec = ((paceMinPerKm - min) * 60).toInt()
    return "${min}:${sec.toString().padStart(2, '0')}/km"
}

private fun formatTonnage(kg: Double): String = when {
    kg >= 1_000 -> "${"%.1f".format(kg / 1_000)} T"
    kg > 0      -> "${"%.0f".format(kg)} kg"
    else        -> "—"
}
