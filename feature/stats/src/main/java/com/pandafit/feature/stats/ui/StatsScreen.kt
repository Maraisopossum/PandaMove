package com.pandafit.feature.stats.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
import com.pandafit.feature.stats.model.ExerciseProgression
import com.pandafit.feature.stats.model.MethodStat
import com.pandafit.feature.stats.model.MuscleGroupStat
import com.pandafit.feature.stats.model.RunningDetailStats
import com.pandafit.feature.stats.model.SportStats
import com.pandafit.feature.stats.model.StatsConfig
import com.pandafit.feature.stats.model.StatsPeriod
import com.pandafit.feature.stats.model.StatsUiState
import com.pandafit.feature.stats.model.StrengthDetailStats
import com.pandafit.feature.stats.model.WeeklyBreathingCount
import com.pandafit.feature.stats.model.WeeklyPace
import com.pandafit.feature.stats.viewmodel.StatsViewModel

private val BreathingTeal = Color(0xFF00897B)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StatsScreen(
    onOpenDrawer: () -> Unit = {},
    viewModel: StatsViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    // Recalcul à chaque retour sur cet écran (drawer navigation préserve le ViewModel)
    val lifecycleOwner = LocalLifecycleOwner.current
    LaunchedEffect(lifecycleOwner) {
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            viewModel.reload()
        }
    }

    Scaffold(
        topBar = { PandaTopBar(title = "Statistiques", onOpenDrawer = onOpenDrawer) },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        if (uiState.isLoading) { PandaLoadingIndicator(); return@Scaffold }
        if (uiState.error != null) { PandaErrorState(description = uiState.error!!, modifier = Modifier.padding(innerPadding)); return@Scaffold }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Sélecteur de période
            item {
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
            }

            // Vue d'ensemble
            item { GlobalSummaryRow(uiState) }

            // Renforcement
            item {
                SectionHeader(
                    title = "Renforcement",
                    icon = Icons.Default.FitnessCenter,
                    color = PandaPurple,
                )
                Spacer(Modifier.height(8.dp))
                StrengthSection(uiState.strengthStats, uiState.strengthDetail, uiState.statsConfig)
            }

            // Running
            item {
                SectionHeader(
                    title = "Course à pieds",
                    icon = Icons.AutoMirrored.Filled.DirectionsRun,
                    color = PandaGreen,
                )
                Spacer(Modifier.height(8.dp))
                RunningSection(uiState.runningStats, uiState.runningDetail, uiState.statsConfig)
            }

            // Vélo
            item {
                SectionHeader(
                    title = "Vélo",
                    icon = Icons.AutoMirrored.Filled.DirectionsBike,
                    color = PandaBlue,
                )
                Spacer(Modifier.height(8.dp))
                CyclingSection(uiState.cyclingStats, uiState.cyclingDetail, uiState.statsConfig)
            }

            // Respiration
            item {
                SectionHeader(
                    title = "Respiration",
                    icon  = Icons.Default.Air,
                    color = BreathingTeal,
                )
                Spacer(Modifier.height(8.dp))
                BreathingSection(uiState.breathingDetail)
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

    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        StatMiniCard("Séances", "$completed/$planned", PandaGreen, Modifier.weight(1f))
        StatMiniCard("Durée", formatDuration(totalMin), PandaBlue, Modifier.weight(1f))
        StatMiniCard("Complétion", "$completionPct%", PandaPurple, Modifier.weight(1f))
    }
}

// ── Renforcement ───────────────────────────────────────────────────────────────

@Composable
private fun StrengthSection(stats: SportStats, detail: StrengthDetailStats, config: StatsConfig) {
    if (detail.plannedSessions == 0) {
        EmptyCard()
        return
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        // Chiffres clés
        PandaCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatItem("Séances", "${detail.completedSessions}/${detail.plannedSessions}", Modifier.weight(1f))
                    StatItem("Séries", detail.totalSeries.toString(), Modifier.weight(1f))
                    StatItem("Reps", detail.totalReps.toString(), Modifier.weight(1f))
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatItem("Tonnage", formatTonnage(detail.totalTonnageKg), Modifier.weight(1f))
                    StatItem("Durée moy.", formatDuration(detail.avgDurationMin), Modifier.weight(1f))
                    StatItem("Durée max", formatDuration(detail.maxDurationMin), Modifier.weight(1f))
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

        // Fun stats panda
        if (detail.totalTonnageKg >= 1.0) {
            FunStrengthCard(detail.totalTonnageKg, config)
        }

        // Progressions par exercice
        if (detail.exerciseProgressions.isNotEmpty()) {
            PandaCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text("Progressions", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = PandaSubtext)
                    Spacer(Modifier.height(8.dp))
                    detail.exerciseProgressions.forEach { prog ->
                        ProgressionRow(prog)
                        Spacer(Modifier.height(6.dp))
                    }
                }
            }
        }

        // Répartition musculaire
        if (detail.muscleBreakdown.isNotEmpty()) {
            PandaCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text("Répartition musculaire", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = PandaSubtext)
                    Spacer(Modifier.height(8.dp))
                    detail.muscleBreakdown.forEach { muscle ->
                        MuscleBar(muscle)
                        Spacer(Modifier.height(6.dp))
                    }
                }
            }
        }

        // Taux de complétion
        CompletionBar(stats.completionRate, PandaPurple)
    }
}

@Composable
private fun FunStrengthCard(tonnageKg: Double, config: StatsConfig) {
    val w1  = config.strWeight1
    val w2  = config.strWeight2
    val w3  = config.strWeight3
    val mon = config.strMonument

    val v1  = tonnageKg / w1.kg
    val v2  = tonnageKg / w2.kg
    val v3  = tonnageKg / w3.kg
    val v4  = tonnageKg / mon.kg * 100

    PandaCard(modifier = Modifier.fillMaxWidth(), containerColor = PandaPurple.copy(alpha = 0.06f), elevation = 0.dp) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text("🐼  Ton tonnage en équivalents", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = PandaPurple)
            Spacer(Modifier.height(10.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                FunItem(w1.emoji, "${"%.1f".format(v1)}", w1.label, Modifier.weight(1f))
                FunItem(w2.emoji, "${"%.2f".format(v2)}", w2.label, Modifier.weight(1f))
                FunItem(w3.emoji, "${"%.2f".format(v3)}", w3.label, Modifier.weight(1f))
                FunItem(mon.emoji, "${"%.4f".format(v4)}%", mon.label, Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun ProgressionRow(prog: ExerciseProgression) {
    val delta = prog.deltaKg ?: return
    val color = when {
        delta > 0  -> Color(0xFF2E7D32)
        delta < 0  -> Color(0xFFC62828)
        else       -> PandaSubtext
    }
    val sign = if (delta > 0) "+" else ""
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(prog.exerciseName, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f), maxLines = 1)
        Text(
            "$sign${"%.1f".format(delta)} kg",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = color,
        )
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
private fun RunningSection(stats: SportStats, detail: RunningDetailStats, config: StatsConfig) {
    if (stats.totalSessions == 0) {
        EmptyCard()
        return
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        // Chiffres clés
        PandaCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatItem("Séances", "${stats.completedSessions}/${stats.totalSessions}", Modifier.weight(1f))
                    StatItem("Distance", "${"%.1f".format(detail.totalDistanceKm)} km", Modifier.weight(1f))
                    StatItem("Durée", formatSeconds(detail.totalDurationSec), Modifier.weight(1f))
                }
                if (detail.avgPaceMinPerKm > 0) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatItem("Allure moy.", formatPace(detail.avgPaceMinPerKm), Modifier.weight(1f))
                        StatItem("Meilleure", formatPace(detail.bestPaceMinPerKm), Modifier.weight(1f))
                        StatItem("+ longue", if (detail.longestSessionKm > 0) "${"%.1f".format(detail.longestSessionKm)} km" else "—", Modifier.weight(1f))
                    }
                }
                if (detail.avgHrBpm > 0 || detail.maxHrBpm > 0 || detail.totalElevationM > 0) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (detail.avgHrBpm > 0) StatItem("FC moy.", "${detail.avgHrBpm} bpm", Modifier.weight(1f))
                        else Spacer(Modifier.weight(1f))
                        if (detail.maxHrBpm > 0) StatItem("FC max", "${detail.maxHrBpm} bpm", Modifier.weight(1f))
                        else Spacer(Modifier.weight(1f))
                        if (detail.totalElevationM > 0) StatItem("Dénivelé", "${detail.totalElevationM} m", Modifier.weight(1f))
                        else Spacer(Modifier.weight(1f))
                    }
                }
                if (detail.avgCadencePpm > 0) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatItem("Cadence moy.", "${detail.avgCadencePpm} ppm", Modifier.weight(1f))
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
                        "Avec la poussette 🚼",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = PandaSubtext,
                    )
                    Spacer(Modifier.height(4.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatItem(
                            "Séances",
                            "${detail.strollerSessions}",
                            Modifier.weight(1f),
                        )
                        StatItem(
                            "Distance",
                            "${"%.1f".format(detail.strollerDistanceKm)} km",
                            Modifier.weight(1f),
                        )
                        StatItem(
                            "Du total",
                            "${(detail.strollerDistancePct * 100).toInt()}%",
                            Modifier.weight(1f),
                        )
                    }
                }
            }
        }

        // Fun stats distance
        if (detail.totalDistanceKm >= 0.4) {
            FunRunningCard(detail.totalDistanceKm, detail.totalElevationM, config)
        }

        // Distance par semaine
        if (detail.weeklyPaces.size >= 2) {
            PandaCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text("Distance par semaine", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = PandaSubtext)
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
    val dist1  = config.runDist1
    val dist2  = config.runDist2
    val summit = config.runSummit

    val pct1 = distanceKm / dist1.km * 100
    val pct2 = distanceKm / dist2.km * 100
    val pctSummit = if (summit.elevationM > 0 && totalElevationM > 0)
        totalElevationM.toDouble() / summit.elevationM * 100 else 0.0

    PandaCard(modifier = Modifier.fillMaxWidth(), containerColor = PandaGreen.copy(alpha = 0.06f), elevation = 0.dp) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text("🏃  Ta distance en équivalents", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = PandaGreen)
            Spacer(Modifier.height(10.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                FunItem(dist1.emoji, "${"%.2f".format(pct1)}%", dist1.label, Modifier.weight(1f))
                FunItem(dist2.emoji, "${"%.4f".format(pct2)}%", dist2.label, Modifier.weight(1f))
                FunItem(summit.emoji, "${"%.1f".format(pctSummit)}%", summit.label, Modifier.weight(1f))
            }
        }
    }
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
private fun CyclingSection(stats: SportStats, detail: CyclingDetailStats, config: StatsConfig) {
    if (stats.totalSessions == 0) { EmptyCard(); return }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        PandaCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                // Ligne 1 : séances / distance / durée
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatItem("Séances", "${stats.completedSessions}/${stats.totalSessions}", Modifier.weight(1f))
                    StatItem(
                        "Distance",
                        if (detail.totalDistanceKm > 0) "${"%.1f".format(detail.totalDistanceKm)} km" else "—",
                        Modifier.weight(1f),
                    )
                    StatItem("Durée", formatSeconds(detail.totalDurationSec), Modifier.weight(1f))
                }
                // Ligne 2 : vitesse moy / meilleure / + longue
                if (detail.avgSpeedKmh > 0 || detail.longestSessionKm > 0) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatItem(
                            "Vit. moy.",
                            if (detail.avgSpeedKmh > 0) "${"%.1f".format(detail.avgSpeedKmh)} km/h" else "—",
                            Modifier.weight(1f),
                        )
                        StatItem(
                            "Meilleure",
                            if (detail.bestSpeedKmh > 0) "${"%.1f".format(detail.bestSpeedKmh)} km/h" else "—",
                            Modifier.weight(1f),
                        )
                        StatItem(
                            "+ longue",
                            if (detail.longestSessionKm > 0) "${"%.1f".format(detail.longestSessionKm)} km" else "—",
                            Modifier.weight(1f),
                        )
                    }
                }
                // Ligne 3 : FC moy. / FC max / Dénivelé+
                if (detail.avgHrBpm > 0 || detail.maxHrBpm > 0 || detail.totalElevationM > 0) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (detail.avgHrBpm > 0) StatItem("FC moy.", "${detail.avgHrBpm} bpm", Modifier.weight(1f))
                        else Spacer(Modifier.weight(1f))
                        if (detail.maxHrBpm > 0) StatItem("FC max", "${detail.maxHrBpm} bpm", Modifier.weight(1f))
                        else Spacer(Modifier.weight(1f))
                        if (detail.totalElevationM > 0) StatItem("Dénivelé +", "${detail.totalElevationM} m", Modifier.weight(1f))
                        else Spacer(Modifier.weight(1f))
                    }
                }
                // Ligne 4 : Cadence (si renseignée)
                if (detail.avgCadenceRpm > 0) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatItem("Cadence moy.", "${detail.avgCadenceRpm} rpm", Modifier.weight(1f))
                        Spacer(Modifier.weight(1f))
                        Spacer(Modifier.weight(1f))
                    }
                }
            }
        }

        // Fun stats distance vélo
        if (detail.totalDistanceKm >= 0.1) {
            FunCyclingCard(detail.totalDistanceKm, detail.totalElevationM, config)
        }

        // Distance par semaine
        if (detail.weeklyDistances.isNotEmpty()) {
            PandaCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text("Distance par semaine", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = PandaSubtext)
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
    val dist1  = config.cycDist1
    val dist2  = config.cycDist2
    val summit = config.cycSummit

    val pct1 = distanceKm / dist1.km * 100
    val pct2 = distanceKm / dist2.km * 100
    val pctSummit = if (summit.elevationM > 0 && totalElevationM > 0)
        totalElevationM.toDouble() / summit.elevationM * 100 else 0.0

    PandaCard(modifier = Modifier.fillMaxWidth(), containerColor = PandaBlue.copy(alpha = 0.06f), elevation = 0.dp) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text("🚴  Ta distance en équivalents", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = PandaBlue)
            Spacer(Modifier.height(10.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                FunItem(dist1.emoji, "${"%.2f".format(pct1)}%", dist1.label, Modifier.weight(1f))
                FunItem(dist2.emoji, "${"%.4f".format(pct2)}%", dist2.label, Modifier.weight(1f))
                if (pctSummit > 0.0) {
                    FunItem(summit.emoji, "${"%.1f".format(pctSummit)}%", summit.label, Modifier.weight(1f))
                } else {
                    Spacer(Modifier.weight(1f))
                }
            }
        }
    }
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
                    StatItem("Séances", detail.totalSessions.toString(), Modifier.weight(1f))
                    StatItem("Durée totale", formatSeconds(detail.totalDurationSeconds), Modifier.weight(1f))
                    StatItem("Durée moy.", formatSeconds(detail.avgDurationSeconds), Modifier.weight(1f))
                }
                if (detail.favoriteMethod != null) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("🏆 Méthode favorite", style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
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
                    Text("Répartition par méthode", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = PandaSubtext)
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
                    Text("Sessions par semaine", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = PandaSubtext)
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
private fun StatMiniCard(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    PandaCard(modifier = modifier, containerColor = color.copy(alpha = 0.08f), elevation = 0.dp) {
        Column(modifier = Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = color)
            Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
        }
    }
}

@Composable
private fun StatItem(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, maxLines = 1)
        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, maxLines = 1)
    }
}

@Composable
private fun FunItem(emoji: String, value: String, label: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(emoji, style = MaterialTheme.typography.titleSmall)
        Text(value, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, maxLines = 1)
        Text(label, style = MaterialTheme.typography.labelSmall.copy(fontSize = 9.sp), color = PandaSubtext, maxLines = 1)
    }
}

@Composable
private fun CompletionBar(rate: Float, color: Color) {
    Column {
        Text(
            "Taux de complétion : ${(rate * 100).toInt()}%",
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
            "Aucune donnée sur cette période.",
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

private fun formatDuration(minutes: Int): String {
    if (minutes <= 0) return "—"
    val h = minutes / 60; val m = minutes % 60
    return if (h > 0) "${h}h${m.toString().padStart(2, '0')}" else "${m}min"
}

private fun formatSeconds(seconds: Int): String {
    if (seconds <= 0) return "—"
    val h = seconds / 3600; val m = (seconds % 3600) / 60
    return if (h > 0) "${h}h${m.toString().padStart(2, '0')}" else "${m}min"
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
