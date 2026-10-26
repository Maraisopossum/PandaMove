package com.pandafit.feature.running.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutSource
import com.pandafit.designsystem.components.ChartLegendItem
import com.pandafit.designsystem.components.GpsTrackMapCard
import com.pandafit.designsystem.components.HeroStat
import com.pandafit.designsystem.components.PACE_TICK_STEPS_SEC
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.components.RegularityIndicator
import com.pandafit.designsystem.components.ReportSectionCard
import com.pandafit.designsystem.components.SplitAnalysisChart
import com.pandafit.designsystem.components.WorkoutFeedbackBanner
import com.pandafit.designsystem.components.WorkoutMetricsRow
import com.pandafit.designsystem.components.WorkoutResultHeroCard
import com.pandafit.designsystem.components.formatPaceTick
import com.pandafit.designsystem.components.signatureMetricToHeroStat
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaGreenContainer
import com.pandafit.designsystem.theme.PandaOnBackground
import com.pandafit.designsystem.theme.PandaOrange
import com.pandafit.designsystem.theme.PandaRed
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.core.database.analysis.DistanceSplit
import com.pandafit.core.database.analysis.MetricItem
import com.pandafit.core.database.analysis.SplitMetric
import com.pandafit.feature.running.R
import com.pandafit.feature.running.model.EffortClassification
import com.pandafit.feature.running.model.FreeRunAnalysis
import com.pandafit.feature.running.model.IntervalAnalysis
import com.pandafit.feature.running.model.KmSplit
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.MonitorHeart
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.DirectionsRun
import androidx.compose.material.icons.filled.Terrain
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.EmojiEvents
import com.pandafit.feature.running.model.formatPace
import com.pandafit.feature.running.model.formatPaceSecPerKm
import com.pandafit.feature.running.viewmodel.WorkoutResultUiState
import com.pandafit.feature.running.viewmodel.WorkoutResultViewModel
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Écran de résultat commun à toutes les séances running (course libre, intervalles, import TCX) :
 * Header → Hero → Feedback → Analyse (contenu variable) → Parcours → Métriques → Actions → Notice.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WorkoutResultScreen(
    workoutId: Long,
    onNavigateBack: () -> Unit,
    onNavigateToEdit: (Long) -> Unit,
    onNavigateToFullDetails: (Long) -> Unit,
    viewModel: WorkoutResultViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            WorkoutResultTopBar(
                workout = uiState.workout,
                onNavigateBack = onNavigateBack,
                onEdit = { onNavigateToEdit(workoutId) },
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { innerPadding ->
        if (uiState.isLoading || uiState.workout == null) { PandaLoadingIndicator(); return@Scaffold }
        val workout = uiState.workout!!

        LazyColumn(
            modifier = Modifier.fillMaxWidth().padding(innerPadding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 32.dp),
        ) {
            item {
                WorkoutResultHero(uiState = uiState, workout = workout)
                Spacer(Modifier.height(16.dp))
            }
            uiState.feedback?.let { feedback ->
                item {
                    WorkoutFeedbackBanner(feedback, PandaGreenContainer)
                    Spacer(Modifier.height(20.dp))
                }
            }
            item {
                WorkoutAnalysisSection(uiState = uiState, workout = workout)
                Spacer(Modifier.height(20.dp))
            }
            if (uiState.gpsPoints.size >= 2) {
                item {
                    Text(
                        stringResource(R.string.workout_result_route_label),
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = PandaOnBackground,
                    )
                    Spacer(Modifier.height(8.dp))
                    ReportSectionCard { GpsTrackMapCard(points = uiState.gpsPoints) }
                    Spacer(Modifier.height(20.dp))
                }
            }
            if (uiState.availableMetrics.isNotEmpty()) {
                item {
                    WorkoutMetricsSection(uiState.availableMetrics)
                    Spacer(Modifier.height(24.dp))
                }
            }
            item {
                WorkoutResultActions(onViewFullDetails = { onNavigateToFullDetails(workoutId) })
                Spacer(Modifier.height(12.dp))
                DataSourceNotice(workout.source)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WorkoutResultTopBar(
    workout: WorkoutEntity?,
    onNavigateBack: () -> Unit,
    onEdit: () -> Unit,
) {
    TopAppBar(
        title = {
            Column {
                Text(
                    workout?.name ?: stringResource(R.string.running_execute_title_fallback),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White,
                )
                val subtitle = buildString {
                    workout?.completedAt?.let {
                        append(it.format(DateTimeFormatter.ofPattern("EEEE d MMMM 'à' HH:mm", Locale.FRENCH)).replaceFirstChar { c -> c.uppercase() })
                    }
                    if (workout?.source == WorkoutSource.TCX_IMPORT) {
                        if (isNotEmpty()) append(" · ")
                        append(stringResource(R.string.workout_result_imported_tcx_suffix))
                    }
                }
                if (subtitle.isNotBlank()) {
                    Text(subtitle, style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.85f))
                }
            }
        },
        navigationIcon = {
            IconButton(onClick = onNavigateBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.running_execute_navigate_back_cd), tint = Color.White)
            }
        },
        actions = {
            IconButton(onClick = onEdit) {
                Icon(Icons.Filled.Edit, contentDescription = stringResource(R.string.running_report_edit_results_cd), tint = Color.White)
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = PandaGreen),
    )
}

@Composable
private fun WorkoutResultHero(uiState: WorkoutResultUiState, workout: WorkoutEntity) {
    val stats = buildList {
        add(
            HeroStat(
                label = stringResource(R.string.workout_result_distance_label),
                value = workout.resultDistanceKm?.let { "%.2f km".format(it) } ?: "—",
                icon = Icons.Filled.Place,
                iconTint = com.pandafit.designsystem.theme.PandaBlue,
            ),
        )
        add(
            HeroStat(
                label = stringResource(R.string.workout_result_avg_pace_label),
                value = workout.resultPaceAvgMinPerKm?.let { "${formatPace(it)} /km" } ?: "—",
                icon = Icons.Filled.Speed,
                iconTint = PandaGreen,
            ),
        )
        uiState.signatureMetric?.let { add(signatureMetricToHeroStat(it)) }
    }
    WorkoutResultHeroCard(
        mascotVariant = uiState.mascotVariant,
        accentColor = PandaGreen,
        completedLabel = stringResource(R.string.workout_result_completed_label),
        durationValue = formatDurationSec(workout.resultDurationSec ?: 0),
        durationLabel = stringResource(R.string.workout_result_total_duration_label),
        stats = stats,
    )
}

/** Contenu variable selon le type de séance. */
@Composable
private fun WorkoutAnalysisSection(uiState: WorkoutResultUiState, workout: WorkoutEntity) {
    Column {
        Text(
            stringResource(R.string.workout_result_analysis_title),
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Bold,
            color = PandaOnBackground,
        )
        Spacer(Modifier.height(8.dp))
        val intervalAnalysis = uiState.intervalAnalysis
        val freeRunAnalysis = uiState.freeRunAnalysis
        ReportSectionCard {
            when {
                uiState.hasIntervals && intervalAnalysis != null -> IntervalWorkoutAnalysis(intervalAnalysis)
                !uiState.hasIntervals && freeRunAnalysis != null -> FreeRunAnalysisSection(freeRunAnalysis, workout)
                else -> BasicWorkoutAnalysis(workout)
            }
        }
    }
}

private fun classificationColor(kind: EffortClassification) = when (kind) {
    EffortClassification.IN_TARGET -> PandaGreen
    EffortClassification.FASTER_THAN_TARGET -> PandaOrange
    EffortClassification.SLOWER_THAN_TARGET -> PandaRed
}

@Composable
private fun IntervalWorkoutAnalysis(analysis: IntervalAnalysis) {
    val inTarget = analysis.efforts.count { it.classification == EffortClassification.IN_TARGET }
    val faster = analysis.efforts.count { it.classification == EffortClassification.FASTER_THAN_TARGET }
    val slower = analysis.efforts.count { it.classification == EffortClassification.SLOWER_THAN_TARGET }

    Column {
        Column(
            modifier = Modifier
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(12.dp))
                .padding(horizontal = 14.dp, vertical = 10.dp),
        ) {
            Text(stringResource(R.string.workout_result_objective_label), style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
            Text(
                "${formatPaceSecPerKm(analysis.targetMinSec)} – ${formatPaceSecPerKm(analysis.targetMaxSec)} /km",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = PandaOnBackground,
            )
        }
        Spacer(Modifier.height(12.dp))
        // Chaque badge reçoit une part égale de la largeur (weight) — évite que le dernier badge se
        // retrouve écrasé dans le reliquat d'espace et que son libellé s'enroule lettre par lettre.
        Row(modifier = Modifier.fillMaxWidth()) {
            ClassificationCount(inTarget, PandaGreen, stringResource(R.string.workout_result_in_target_label), Modifier.weight(1f))
            ClassificationCount(faster, PandaOrange, stringResource(R.string.workout_result_faster_label), Modifier.weight(1f))
            ClassificationCount(slower, PandaRed, stringResource(R.string.workout_result_slower_label), Modifier.weight(1f))
        }
        Spacer(Modifier.height(16.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(24.dp)) {
            analysis.regularityPercent?.let { pct ->
                Column {
                    Text(stringResource(R.string.workout_result_regularity_label), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                    Text("$pct %", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PandaOnBackground)
                }
            }
            analysis.bestEffort?.let { best ->
                Column {
                    Text(stringResource(R.string.workout_result_best_pace_label), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                    Text(
                        "${formatPaceSecPerKm(best.paceSecPerKm)} /km",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = PandaOnBackground,
                    )
                    Text(
                        stringResource(R.string.workout_result_best_pace_rep, best.displayNumber),
                        style = MaterialTheme.typography.labelSmall,
                        color = PandaSubtext,
                    )
                }
            }
        }
        Spacer(Modifier.height(16.dp))
        IntervalEffortChart(analysis)
    }
}

@Composable
private fun ClassificationCount(count: Int, color: Color, label: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Canvas(modifier = Modifier.size(8.dp)) {
                drawCircle(color = color)
            }
            Spacer(Modifier.width(4.dp))
            Text("$count", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = PandaOnBackground)
        }
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = PandaSubtext,
            maxLines = 2,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
    }
}

/**
 * Graphique en barres fait maison (pas de bibliothèque de chart dans le projet) — une barre par
 * effort, dessinée dans un unique Canvas (plutôt qu'une Row/LazyRow de composables imbriqués par
 * barre, qui s'est révélée instable — ANR reproductible à l'affichage sur device).
 */
@Composable
private fun IntervalEffortChart(analysis: IntervalAnalysis) {
    val efforts = analysis.efforts
    val rawSlowest = (efforts.maxOf { it.paceSecPerKm }).coerceAtLeast(analysis.targetMaxSec)
    val rawFastest = (efforts.minOf { it.paceSecPerKm }).coerceAtMost(analysis.targetMinSec)
    // Marge de 30% de chaque côté : sans elle, la barre la plus haute touche le sommet du graphique
    // et la plus courte sa base — le mockup laisse toujours de l'air de part et d'autre.
    val rawRange = (rawSlowest - rawFastest).coerceAtLeast(1)
    val margin = (rawRange * 0.3f).toInt().coerceAtLeast(5)
    val fastestPace = rawFastest - margin
    val slowestPace = rawSlowest + margin
    val range = (slowestPace - fastestPace).coerceAtLeast(1)

    Column {
        // Labels au-dessus/en-dessous en Text() Compose classiques (pas de TextMeasurer dans
        // le DrawScope) ; seules les barres sont dessinées dans un Canvas — plusieurs variantes
        // plus complexes (LazyRow, Row+horizontalScroll, Canvas+TextMeasurer) se sont révélées
        // instables (ANR reproductible à l'affichage sur device).
        Row(modifier = Modifier.fillMaxWidth()) {
            efforts.forEach { effort ->
                Text(
                    formatPaceSecPerKm(effort.paceSecPerKm),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = classificationColor(effort.classification),
                    maxLines = 1,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        Spacer(Modifier.height(4.dp))
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(110.dp),
        ) {
            val slotWidthPx = size.width / efforts.size
            val barWidthPx = slotWidthPx * 0.6f

            // Zone cible — dégradé entre les deux lignes pointillées, dessinée avant les barres pour
            // servir de repère de fond, comme sur le mockup. Cible basse (plus rapide) en vert, cible
            // haute (plus lente) en orange — mêmes couleurs que le mockup.
            val targetMinY = size.height * (analysis.targetMinSec - fastestPace).toFloat() / range
            val targetMaxY = size.height * (analysis.targetMaxSec - fastestPace).toFloat() / range
            drawRect(
                brush = androidx.compose.ui.graphics.Brush.verticalGradient(
                    colors = listOf(PandaGreen.copy(alpha = 0.18f), PandaOrange.copy(alpha = 0.10f)),
                    startY = targetMinY,
                    endY = targetMaxY,
                ),
                topLeft = androidx.compose.ui.geometry.Offset(0f, targetMinY),
                size = androidx.compose.ui.geometry.Size(size.width, targetMaxY - targetMinY),
            )
            drawLine(
                color = PandaGreen.copy(alpha = 0.7f),
                start = androidx.compose.ui.geometry.Offset(0f, targetMinY),
                end = androidx.compose.ui.geometry.Offset(size.width, targetMinY),
                strokeWidth = 2f,
                pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(10f, 6f)),
            )
            drawLine(
                color = PandaOrange.copy(alpha = 0.7f),
                start = androidx.compose.ui.geometry.Offset(0f, targetMaxY),
                end = androidx.compose.ui.geometry.Offset(size.width, targetMaxY),
                strokeWidth = 2f,
                pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(10f, 6f)),
            )

            efforts.forEachIndexed { index, effort ->
                val slotCenterX = index * slotWidthPx + slotWidthPx / 2
                val color = classificationColor(effort.classification)
                val barFraction = (1f - (effort.paceSecPerKm - fastestPace).toFloat() / range).coerceIn(0.05f, 1f)
                val barHeightPx = size.height * barFraction

                drawRoundRect(
                    color = color,
                    topLeft = androidx.compose.ui.geometry.Offset(slotCenterX - barWidthPx / 2, size.height - barHeightPx),
                    size = androidx.compose.ui.geometry.Size(barWidthPx, barHeightPx),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(8f),
                )
            }
        }
        Spacer(Modifier.height(4.dp))
        Row(modifier = Modifier.fillMaxWidth()) {
            efforts.forEach { effort ->
                Text(
                    "#${effort.displayNumber}",
                    style = MaterialTheme.typography.labelSmall,
                    color = PandaSubtext,
                    maxLines = 1,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            ChartLegendItem(
                PandaGreen.copy(alpha = 0.7f),
                stringResource(R.string.workout_result_target_low, formatPaceSecPerKm(analysis.targetMinSec)),
            )
            Spacer(Modifier.width(16.dp))
            ChartLegendItem(
                PandaOrange.copy(alpha = 0.7f),
                stringResource(R.string.workout_result_target_high, formatPaceSecPerKm(analysis.targetMaxSec)),
            )
        }
    }
}

private fun KmSplit.toDistanceSplit() = DistanceSplit(km, paceSecPerKm.toDouble(), elevationGainM, cumulativeDistanceM)

@Composable
private fun FreeRunAnalysisSection(analysis: FreeRunAnalysis, workout: WorkoutEntity) {
    Column {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(24.dp)) {
            workout.resultPaceAvgMinPerKm?.let {
                Column(modifier = Modifier.weight(1f)) {
                    Text(stringResource(R.string.workout_result_avg_pace_label), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                    Text("${formatPace(it)} /km", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PandaOnBackground)
                }
            }
            analysis.regularityPercent?.let { pct ->
                RegularityIndicator(pct, stringResource(R.string.workout_result_regularity_label), Modifier.weight(1f))
            }
        }
        Spacer(Modifier.height(16.dp))
        SplitAnalysisChart(
            splits = analysis.chartSplits.map { it.toDistanceSplit() },
            metric = SplitMetric.PACE_SEC_PER_KM,
            metricLegendLabel = stringResource(R.string.running_execute_cell_pace),
            metricColor = PandaGreen,
            elevationColor = com.pandafit.designsystem.theme.PandaBlue,
            elevationLegendLabel = stringResource(R.string.running_execute_cell_elevation),
            metricTickSteps = PACE_TICK_STEPS_SEC,
            formatMetricTick = ::formatPaceTick,
        )
        Spacer(Modifier.height(16.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(24.dp)) {
            Column {
                Text(stringResource(R.string.workout_result_best_km_label), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                Text(
                    "${formatPaceSecPerKm(analysis.bestSplit.paceSecPerKm)} /km",
                    style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PandaGreen,
                )
            }
            Column {
                Text(stringResource(R.string.workout_result_worst_km_label), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                Text(
                    "${formatPaceSecPerKm(analysis.worstSplit.paceSecPerKm)} /km",
                    style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PandaOnBackground,
                )
            }
        }
    }
}

@Composable
private fun BasicWorkoutAnalysis(workout: WorkoutEntity) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(24.dp)) {
        workout.resultPaceAvgMinPerKm?.let {
            Column {
                Text(stringResource(R.string.workout_result_avg_pace_label), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                Text("${formatPace(it)} /km", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PandaOnBackground)
            }
        }
        workout.resultDistanceKm?.let {
            Column {
                Text(stringResource(R.string.workout_result_distance_label), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
                Text("%.2f km".format(it), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PandaOnBackground)
            }
        }
    }
}

@Composable
private fun WorkoutMetricsSection(metrics: List<MetricItem>) {
    Column {
        Text(
            stringResource(R.string.workout_result_metrics_title),
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Bold,
            color = PandaOnBackground,
        )
        Spacer(Modifier.height(8.dp))
        ReportSectionCard { WorkoutMetricsRow(metrics) }
    }
}

@Composable
private fun WorkoutResultActions(onViewFullDetails: () -> Unit) {
    Column {
        Button(
            onClick = onViewFullDetails,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = PandaGreen),
        ) {
            Text(stringResource(R.string.workout_result_view_details_button), color = Color.White, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(10.dp))
        OutlinedButton(
            // Partage réel (capture + ACTION_SEND) prévu à une étape ultérieure — bouton présent mais inactif.
            onClick = {},
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(14.dp),
        ) {
            Icon(Icons.Filled.Share, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(stringResource(R.string.workout_result_share_button))
        }
    }
}

@Composable
private fun DataSourceNotice(source: WorkoutSource) {
    if (source != WorkoutSource.TCX_IMPORT) return
    Text(
        stringResource(R.string.workout_result_data_source_tcx_notice),
        style = MaterialTheme.typography.labelSmall,
        color = PandaSubtext,
    )
}

private fun formatDurationSec(totalSec: Int): String {
    val h = totalSec / 3600
    val m = (totalSec % 3600) / 60
    val s = totalSec % 60
    return if (h > 0) "$h:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
    else "$m:${s.toString().padStart(2, '0')}"
}
