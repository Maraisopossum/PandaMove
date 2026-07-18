package com.pandafit.feature.cycling.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.analysis.SplitMetric
import com.pandafit.core.database.entities.BlockType
import com.pandafit.core.database.entities.WorkoutBlockEntity
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutSource
import com.pandafit.designsystem.components.GpsTrackMapCard
import com.pandafit.designsystem.components.HeroStat
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.components.PandaTopBar
import com.pandafit.designsystem.components.RegularityIndicator
import com.pandafit.designsystem.components.ReportSectionCard
import com.pandafit.designsystem.components.SPEED_TICK_STEPS_KMH
import com.pandafit.designsystem.components.SplitAnalysisChart
import com.pandafit.designsystem.components.WorkoutFeedbackBanner
import com.pandafit.designsystem.components.WorkoutMetricsRow
import com.pandafit.designsystem.components.WorkoutResultHeroCard
import com.pandafit.designsystem.components.formatSpeedTick
import com.pandafit.designsystem.components.signatureMetricToHeroStat
import com.pandafit.designsystem.theme.PandaBlue
import com.pandafit.designsystem.theme.PandaBlueContainer
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaOnBackground
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.cycling.R
import com.pandafit.feature.cycling.viewmodel.CyclingReportViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CyclingWorkoutReportScreen(
    workoutId: Long,
    onNavigateBack: () -> Unit,
    onNavigateToEdit: (Long) -> Unit,
    onNavigateToExecute: (Long) -> Unit,
    viewModel: CyclingReportViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior(rememberTopAppBarState())

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) viewModel.reload()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val workout = uiState.workout
    val isCompleted = workout?.isCompleted == true
    val isTemplate  = workout?.isTemplate  == true

    Scaffold(
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            PandaTopBar(
                title = workout?.name ?: stringResource(R.string.cycling_report_title_fallback),
                onNavigateBack = onNavigateBack,
                scrollBehavior = scrollBehavior,
                containerColor = PandaBlue,
                contentColor = Color.White,
                actions = {
                    IconButton(onClick = {
                        if (isTemplate || !isCompleted) onNavigateToEdit(workoutId)
                        else onNavigateToExecute(workoutId)
                    }) {
                        Icon(Icons.Default.Edit, if (isCompleted) stringResource(R.string.cycling_report_edit_results_cd) else stringResource(R.string.cycling_report_edit_seance_cd))
                    }
                },
            )
        },
        floatingActionButton = {
            if (!isTemplate && !isCompleted) {
                FloatingActionButton(
                    onClick = { onNavigateToExecute(workoutId) },
                    containerColor = PandaBlue,
                ) {
                    Icon(Icons.Default.PlayArrow, stringResource(R.string.cycling_report_encode_cd), tint = Color.White)
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        if (uiState.isLoading) { PandaLoadingIndicator(); return@Scaffold }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp).let {
                PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 88.dp)
            },
        ) {
            item {
                Surface(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                    shape = MaterialTheme.shapes.medium,
                    color = MaterialTheme.colorScheme.surface,
                    tonalElevation = 1.dp,
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            workout?.name ?: "",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                        )
                        if (workout?.objective?.isNotBlank() == true) {
                            Spacer(Modifier.height(4.dp))
                            Text(workout.objective, style = MaterialTheme.typography.bodySmall, color = PandaBlue)
                        }
                        if (workout?.notes?.isNotBlank() == true) {
                            Spacer(Modifier.height(2.dp))
                            Text(workout.notes, style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                        }
                    }
                }
            }

            if (isCompleted && workout != null) {
                item {
                    val stats = buildList {
                        add(HeroStat(stringResource(R.string.cycling_report_distance_label), workout.resultDistanceKm?.let { "%.1f km".format(it) } ?: "—", Icons.Filled.Place, PandaBlue))
                        add(HeroStat(stringResource(R.string.cycling_report_avg_speed_label), workout.resultSpeedAvgKmh?.let { "%.1f km/h".format(it) } ?: "—", Icons.Filled.Speed, PandaGreen))
                        uiState.signatureMetric?.let { add(signatureMetricToHeroStat(it)) }
                    }
                    WorkoutResultHeroCard(
                        mascotVariant = uiState.mascotVariant,
                        accentColor = PandaBlue,
                        completedLabel = stringResource(R.string.cycling_report_completed_label),
                        durationValue = formatDurSec(workout.resultDurationSec ?: 0),
                        durationLabel = stringResource(R.string.cycling_report_total_duration_label),
                        stats = stats,
                        modifier = Modifier.padding(vertical = 4.dp),
                    )
                }
                uiState.feedback?.let { feedback ->
                    item { WorkoutFeedbackBanner(feedback, PandaBlueContainer, Modifier.padding(vertical = 8.dp)) }
                }
                uiState.splitAnalysis?.takeIf { it.splits.size >= 2 }?.let { analysis ->
                    item {
                        Text(
                            stringResource(R.string.cycling_report_analysis_title),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                            color = PandaOnBackground,
                            modifier = Modifier.padding(top = 4.dp, bottom = 8.dp),
                        )
                        ReportSectionCard {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                                workout.resultSpeedAvgKmh?.let {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(stringResource(R.string.cycling_report_avg_speed_label), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                                        Text("%.1f km/h".format(it), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PandaOnBackground)
                                    }
                                }
                                analysis.regularityPercent?.let { pct ->
                                    RegularityIndicator(pct, stringResource(R.string.cycling_report_regularity_label), Modifier.weight(1f))
                                }
                            }
                            Spacer(Modifier.height(16.dp))
                            SplitAnalysisChart(
                                splits = analysis.chartSplits,
                                metric = SplitMetric.SPEED_KMH,
                                metricLegendLabel = stringResource(R.string.cycling_report_speed_legend),
                                metricColor = PandaBlue,
                                elevationColor = PandaGreen,
                                elevationLegendLabel = stringResource(R.string.cycling_report_elevation_legend),
                                metricTickSteps = SPEED_TICK_STEPS_KMH,
                                formatMetricTick = ::formatSpeedTick,
                            )
                            Spacer(Modifier.height(16.dp))
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                                Column {
                                    Text(stringResource(R.string.cycling_report_best_km_label), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                                    Text("%.1f km/h".format(analysis.bestSplit.metricValue), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PandaBlue)
                                }
                                Column {
                                    Text(stringResource(R.string.cycling_report_worst_km_label), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                                    Text("%.1f km/h".format(analysis.worstSplit.metricValue), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PandaOnBackground)
                                }
                            }
                        }
                        Spacer(Modifier.height(20.dp))
                    }
                }
            }

            // ── Tracé GPS ────────────────────────────────────────────────────
            if (uiState.gpsPoints.size >= 2) {
                item {
                    Text(
                        stringResource(R.string.cycling_report_route_label),
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = PandaOnBackground,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                    ReportSectionCard {
                        GpsTrackMapCard(
                            points = uiState.gpsPoints,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(220.dp)
                                .clip(MaterialTheme.shapes.medium),
                        )
                    }
                    Spacer(Modifier.height(20.dp))
                }
            }

            if (uiState.availableMetrics.isNotEmpty()) {
                item {
                    Text(
                        stringResource(R.string.cycling_report_metrics_title),
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = PandaOnBackground,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                    ReportSectionCard { WorkoutMetricsRow(uiState.availableMetrics) }
                    Spacer(Modifier.height(20.dp))
                }
            }

            // ── Blocs de la séance ────────────────────────────────────────────
            if (uiState.blocks.isNotEmpty()) {
                item {
                    Text(
                        stringResource(R.string.cycling_report_section_blocks),
                        style = MaterialTheme.typography.labelSmall,
                        color = PandaSubtext,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(vertical = 8.dp),
                    )
                }
                items(uiState.blocks, key = { "block_${it.id}" }) { block ->
                    CyclingBlockReadRow(
                        block = block,
                        modifier = Modifier.padding(vertical = 3.dp),
                    )
                }
            }
        }
    }
}

// ── Ligne bloc (lecture seule) ────────────────────────────────────────────────

@Composable
private fun CyclingBlockReadRow(block: WorkoutBlockEntity, modifier: Modifier = Modifier) {
    val color = blockColor(block.blockType)
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.small,
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.width(4.dp).height(52.dp).background(color))
            Column(modifier = Modifier.weight(1f).padding(horizontal = 12.dp, vertical = 8.dp)) {
                Text(block.name.ifBlank { blockLabel(block.blockType) }, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold, color = color)
                Text(blockSummary(block), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
            }
        }
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

private fun blockLabel(type: BlockType) = when (type) {
    BlockType.WARMUP   -> "Échauffement"
    BlockType.MAIN     -> "Bloc principal"
    BlockType.INTERVAL -> "Intervalles"
    BlockType.COOLDOWN -> "Retour au calme"
    BlockType.CUSTOM   -> "Bloc"
}

private fun blockColor(type: BlockType): Color = when (type) {
    BlockType.WARMUP   -> Color(0xFFE57373)
    BlockType.MAIN     -> PandaBlue
    BlockType.INTERVAL -> Color(0xFFFF7043)
    BlockType.COOLDOWN -> Color(0xFF66BB6A)
    BlockType.CUSTOM   -> Color(0xFFAB47BC)
}

private fun blockSummary(block: WorkoutBlockEntity): String = buildString {
    block.durationMinutes?.let { append("${it} min") }
    block.distanceKm?.let { if (isNotEmpty()) append(" · "); append("%.1f km".format(it)) }
    block.targetPowerWatts?.let { if (isNotEmpty()) append(" · "); append("${it} W") }
    block.targetCadenceRpm?.let { if (isNotEmpty()) append(" · "); append("${it} rpm") }
    block.targetHeartRateBpm?.let { if (isNotEmpty()) append(" · "); append("${it} bpm") }
    block.repetitions?.let { reps ->
        block.recoveryMinutes?.let { rec ->
            if (isNotEmpty()) append(" · ")
            append("${reps}×, récup. ${rec} min")
        }
    }
    if (isBlank() && block.notes.isNotBlank()) append(block.notes)
}

private fun formatDurSec(sec: Int): String {
    val h = sec / 3600; val m = (sec % 3600) / 60; val s = sec % 60
    return if (h > 0) "$h:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
    else "$m:${s.toString().padStart(2, '0')}"
}
