package com.pandafit.feature.running.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutSource
import com.pandafit.designsystem.components.GpsTrackMapCard
import com.pandafit.designsystem.components.PandaLoadingIndicator
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaGreenContainer
import com.pandafit.designsystem.theme.PandaOnBackground
import com.pandafit.designsystem.theme.PandaOrange
import com.pandafit.designsystem.theme.PandaRed
import com.pandafit.designsystem.theme.PandaSubtext
import com.pandafit.feature.running.R
import com.pandafit.feature.running.model.EffortClassification
import com.pandafit.feature.running.model.IntervalAnalysis
import com.pandafit.feature.running.model.MascotVariant
import com.pandafit.feature.running.model.MetricItem
import com.pandafit.feature.running.model.SignatureMetric
import com.pandafit.feature.running.model.WorkoutFeedback
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
                    PandaFeedbackBanner(feedback)
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
                    GpsTrackMapCard(points = uiState.gpsPoints)
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
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Image(
                    painter = painterResource(mascotDrawableRes(uiState.mascotVariant)),
                    contentDescription = null,
                    modifier = Modifier.size(88.dp),
                )
                Spacer(Modifier.width(12.dp))
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = PandaGreen)
                        Spacer(Modifier.width(6.dp))
                        Text(
                            stringResource(R.string.workout_result_completed_label),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                            color = PandaGreen,
                        )
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(
                        formatDurationSec(workout.resultDurationSec ?: 0),
                        style = MaterialTheme.typography.displaySmall,
                        fontWeight = FontWeight.ExtraBold,
                        color = PandaOnBackground,
                    )
                    Text(
                        stringResource(R.string.workout_result_total_duration_label),
                        style = MaterialTheme.typography.bodyMedium,
                        color = PandaSubtext,
                    )
                }
            }
            Spacer(Modifier.height(16.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                HeroStat(
                    label = stringResource(R.string.workout_result_distance_label),
                    value = workout.resultDistanceKm?.let { "%.2f km".format(it) } ?: "—",
                )
                HeroStat(
                    label = stringResource(R.string.workout_result_avg_pace_label),
                    value = workout.resultPaceAvgMinPerKm?.let { "${formatPace(it)} /km" } ?: "—",
                )
                uiState.signatureMetric?.let { HeroStat(label = it.label(), value = it.valueLabel()) }
            }
        }
    }
}

private fun mascotDrawableRes(variant: MascotVariant): Int = when (variant) {
    MascotVariant.JOY_MALE -> R.drawable.panda_joy_male
    MascotVariant.JOY_FEMALE -> R.drawable.panda_joy_female
    MascotVariant.VICTORY_MALE -> R.drawable.panda_victory_male
    MascotVariant.VICTORY_FEMALE -> R.drawable.panda_victory_female
}

private fun SignatureMetric.label(): String = when (this) {
    is SignatureMetric.Elevation -> "Dénivelé +"
    is SignatureMetric.HeartRate -> "FC moyenne"
    is SignatureMetric.Calories -> "Calories"
    is SignatureMetric.RepsCompleted -> "Répétitions"
}

private fun SignatureMetric.valueLabel(): String = when (this) {
    is SignatureMetric.Elevation -> "$meters m"
    is SignatureMetric.HeartRate -> "$bpm bpm"
    is SignatureMetric.Calories -> "$kcal kcal"
    is SignatureMetric.RepsCompleted -> "$done / $total"
}

@Composable
private fun HeroStat(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = PandaOnBackground)
        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
    }
}

@Composable
private fun PandaFeedbackBanner(feedback: WorkoutFeedback) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(PandaGreenContainer, RoundedCornerShape(14.dp))
            .padding(14.dp),
    ) {
        Column {
            Text(feedback.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, color = PandaOnBackground)
            Text(feedback.message, style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
        }
    }
}

/**
 * Contenu variable selon le type de séance. FreeRunAnalysis (graphique allure/dénivelé, régularité
 * course libre) reste à faire dans une étape ultérieure.
 */
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
        val analysis = uiState.intervalAnalysis
        when {
            uiState.hasIntervals && analysis != null -> IntervalWorkoutAnalysis(analysis)
            else -> BasicWorkoutAnalysis(workout) // FreeRunAnalysis — étape ultérieure
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
        Row(verticalAlignment = Alignment.CenterVertically) {
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
            Spacer(Modifier.width(16.dp))
            ClassificationCount(inTarget, PandaGreen, stringResource(R.string.workout_result_in_target_label))
            Spacer(Modifier.width(12.dp))
            ClassificationCount(faster, PandaOrange, stringResource(R.string.workout_result_faster_label))
            Spacer(Modifier.width(12.dp))
            ClassificationCount(slower, PandaRed, stringResource(R.string.workout_result_slower_label))
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
private fun ClassificationCount(count: Int, color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Canvas(modifier = Modifier.size(8.dp)) {
            drawCircle(color = color)
        }
        Spacer(Modifier.width(4.dp))
        Text("$count", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = PandaOnBackground)
        Spacer(Modifier.width(4.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
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
    val slowestPace = (efforts.maxOf { it.paceSecPerKm }).coerceAtLeast(analysis.targetMaxSec)
    val fastestPace = (efforts.minOf { it.paceSecPerKm }).coerceAtMost(analysis.targetMinSec)
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
            Text(
                stringResource(R.string.workout_result_target_low, formatPaceSecPerKm(analysis.targetMinSec)),
                style = MaterialTheme.typography.labelSmall,
                color = PandaSubtext,
            )
            Spacer(Modifier.width(12.dp))
            Text(
                stringResource(R.string.workout_result_target_high, formatPaceSecPerKm(analysis.targetMaxSec)),
                style = MaterialTheme.typography.labelSmall,
                color = PandaSubtext,
            )
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
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            metrics.forEach { metric ->
                Column(
                    modifier = Modifier
                        .width(84.dp)
                        .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(12.dp))
                        .padding(vertical = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(metric.value, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = PandaOnBackground)
                    Spacer(Modifier.height(2.dp))
                    Text(metric.label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                }
            }
        }
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
