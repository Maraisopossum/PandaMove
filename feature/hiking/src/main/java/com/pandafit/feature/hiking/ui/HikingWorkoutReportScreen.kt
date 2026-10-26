package com.pandafit.feature.hiking.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.analysis.SplitMetric
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
import com.pandafit.designsystem.theme.PandaAmber
import com.pandafit.designsystem.theme.PandaAmberLight
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaOnBackground
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.hiking.R
import com.pandafit.feature.hiking.viewmodel.HikingReportViewModel
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HikingWorkoutReportScreen(
    workoutId: Long,
    onNavigateBack: () -> Unit,
    onNavigateToEdit: (Long) -> Unit,
    viewModel: HikingReportViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showDeleteDialog by remember { mutableStateOf(false) }

    LaunchedEffect(workoutId) { viewModel.load(workoutId) }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text(stringResource(R.string.hiking_report_delete_dialog_title)) },
            text = { Text(stringResource(R.string.hiking_delete_dialog_text)) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.delete(workoutId) { onNavigateBack() }
                    showDeleteDialog = false
                }) { Text(stringResource(R.string.common_confirm_delete), color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) { Text(stringResource(R.string.common_cancel)) }
            },
        )
    }

    Scaffold(
        topBar = {
            PandaTopBar(
                title = uiState.workout?.name ?: stringResource(R.string.hiking_report_title_fallback),
                containerColor = PandaAmber,
                onNavigateBack = onNavigateBack,
                actions = {
                    IconButton(onClick = { onNavigateToEdit(workoutId) }) {
                        Icon(Icons.Default.Edit, contentDescription = stringResource(R.string.hiking_report_modify_cd), tint = Color.White)
                    }
                    IconButton(onClick = { showDeleteDialog = true }) {
                        Icon(Icons.Default.Delete, contentDescription = stringResource(R.string.hiking_report_delete_cd), tint = Color.White)
                    }
                },
            )
        },
    ) { innerPadding ->
        if (uiState.isLoading) { PandaLoadingIndicator(); return@Scaffold }
        val w = uiState.workout ?: return@Scaffold

        Column(
            modifier = Modifier
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            val dateFmt = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.FRENCH)
            val dayName = w.scheduledDate.dayOfWeek
                .getDisplayName(TextStyle.FULL, Locale.FRENCH)
                .replaceFirstChar { it.uppercaseChar() }

            Text(
                "$dayName ${w.scheduledDate.format(dateFmt)}",
                style = MaterialTheme.typography.bodyMedium,
                color = PandaSubtext,
            )

            val stats = buildList {
                add(HeroStat(stringResource(R.string.hiking_report_distance_label), w.resultDistanceKm?.let { "%.2f km".format(it) } ?: "—", Icons.Filled.Place, PandaAmber))
                add(HeroStat(stringResource(R.string.hiking_report_avg_speed_label), w.resultSpeedAvgKmh?.let { "%.1f km/h".format(it) } ?: "—", Icons.Filled.Speed, PandaGreen))
                uiState.signatureMetric?.let { add(signatureMetricToHeroStat(it)) }
            }
            WorkoutResultHeroCard(
                mascotVariant = uiState.mascotVariant,
                accentColor = PandaAmber,
                completedLabel = stringResource(R.string.hiking_report_completed_label),
                durationValue = formatDurationSec(w.resultDurationSec ?: 0),
                durationLabel = stringResource(R.string.hiking_report_total_duration_label),
                stats = stats,
            )

            uiState.feedback?.let { feedback -> WorkoutFeedbackBanner(feedback, PandaAmberLight) }

            uiState.splitAnalysis?.takeIf { it.splits.size >= 2 }?.let { analysis ->
                Column {
                    Text(
                        stringResource(R.string.hiking_report_analysis_title),
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = PandaOnBackground,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                    ReportSectionCard {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                            w.resultSpeedAvgKmh?.let {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(stringResource(R.string.hiking_report_avg_speed_label), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                                    Text("%.1f km/h".format(it), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PandaOnBackground)
                                }
                            }
                            analysis.regularityPercent?.let { pct ->
                                RegularityIndicator(pct, stringResource(R.string.hiking_report_regularity_label), Modifier.weight(1f))
                            }
                        }
                        Spacer(Modifier.height(16.dp))
                        // Dénivelé au premier plan (ligne + aire pleines) : en montagne, le profil de
                        // terrain compte plus que la vitesse — inverse l'emphase par rapport à running/vélo.
                        SplitAnalysisChart(
                            splits = analysis.chartSplits,
                            metric = SplitMetric.SPEED_KMH,
                            metricLegendLabel = stringResource(R.string.hiking_report_speed_legend),
                            metricColor = PandaGreen,
                            elevationColor = PandaAmber,
                            elevationLegendLabel = stringResource(R.string.hiking_report_elevation_legend),
                            metricTickSteps = SPEED_TICK_STEPS_KMH,
                            formatMetricTick = ::formatSpeedTick,
                            emphasizeElevation = true,
                        )
                        Spacer(Modifier.height(16.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                            Column {
                                Text(stringResource(R.string.hiking_report_best_km_label), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                                Text("%.1f km/h".format(analysis.bestSplit.metricValue), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PandaAmber)
                            }
                            Column {
                                Text(stringResource(R.string.hiking_report_worst_km_label), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                                Text("%.1f km/h".format(analysis.worstSplit.metricValue), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PandaOnBackground)
                            }
                        }
                    }
                }
            }

            if (uiState.gpsPoints.size >= 2) {
                Column {
                    Text(
                        stringResource(R.string.hiking_report_route_label),
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
                }
            }

            if (uiState.availableMetrics.isNotEmpty()) {
                Column {
                    Text(
                        stringResource(R.string.hiking_report_metrics_title),
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = PandaOnBackground,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                    ReportSectionCard { WorkoutMetricsRow(uiState.availableMetrics) }
                }
            }

            w.resultRpe?.let { rpe ->
                Card(elevation = CardDefaults.cardElevation(2.dp)) {
                    Row(modifier = Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(stringResource(R.string.hiking_report_rpe), style = MaterialTheme.typography.bodyMedium, color = PandaSubtext)
                        Text("$rpe / 10", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            if (w.resultNotes.isNotBlank()) {
                Card(elevation = CardDefaults.cardElevation(2.dp)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(stringResource(R.string.hiking_report_notes_title), style = MaterialTheme.typography.titleSmall, color = PandaAmber)
                        Spacer(Modifier.height(4.dp))
                        Text(w.resultNotes, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
    }
}

private fun formatDurationSec(totalSec: Int): String {
    val h = totalSec / 3600
    val m = (totalSec % 3600) / 60
    val s = totalSec % 60
    return if (h > 0) "$h:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
    else "$m:${s.toString().padStart(2, '0')}"
}
