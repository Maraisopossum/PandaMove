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
import com.pandafit.feature.running.model.FreeRunAnalysis
import com.pandafit.feature.running.model.IntervalAnalysis
import com.pandafit.feature.running.model.KmSplit
import com.pandafit.feature.running.model.MascotVariant
import com.pandafit.feature.running.model.MetricItem
import com.pandafit.feature.running.model.MetricKind
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.MonitorHeart
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.DirectionsRun
import androidx.compose.material.icons.filled.Terrain
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.EmojiEvents
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
                    icon = Icons.Filled.Place,
                    iconTint = com.pandafit.designsystem.theme.PandaBlue,
                )
                HeroStat(
                    label = stringResource(R.string.workout_result_avg_pace_label),
                    value = workout.resultPaceAvgMinPerKm?.let { "${formatPace(it)} /km" } ?: "—",
                    icon = Icons.Filled.Speed,
                    iconTint = PandaGreen,
                )
                uiState.signatureMetric?.let {
                    HeroStat(label = it.label(), value = it.valueLabel(), icon = it.icon(), iconTint = it.iconColor())
                }
            }
        }
    }
}

/** Cadre commun à chaque zone du rapport (Analyse, Parcours, Métriques) — même style que le Hero. */
@Composable
private fun ReportSectionCard(content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(modifier = Modifier.padding(16.dp), content = content)
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

private fun SignatureMetric.icon(): androidx.compose.ui.graphics.vector.ImageVector = when (this) {
    is SignatureMetric.Elevation -> Icons.Filled.Terrain
    is SignatureMetric.HeartRate -> Icons.Filled.Favorite
    is SignatureMetric.Calories -> Icons.Filled.LocalFireDepartment
    is SignatureMetric.RepsCompleted -> Icons.Filled.EmojiEvents
}

private fun SignatureMetric.iconColor(): Color = when (this) {
    is SignatureMetric.Elevation -> com.pandafit.designsystem.theme.PandaPurple
    is SignatureMetric.HeartRate -> com.pandafit.designsystem.theme.PandaMascotFemaleAccent
    is SignatureMetric.Calories -> PandaOrange
    is SignatureMetric.RepsCompleted -> PandaGreen
}

/** Icône (mockup : pin/vitesse/montagne au-dessus de la valeur) — [iconTint] null si pas d'icône. */
@Composable
private fun HeroStat(label: String, value: String, icon: androidx.compose.ui.graphics.vector.ImageVector? = null, iconTint: Color = PandaSubtext) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(20.dp))
            Spacer(Modifier.height(4.dp))
        }
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

/** Seuils de couleur de la barre de régularité — vert ≥85%, orange 70-84%, rouge <70%. */
private fun regularityColor(pct: Int): Color = when {
    pct >= 85 -> PandaGreen
    pct >= 70 -> PandaOrange
    else -> PandaRed
}

@Composable
private fun RegularityIndicator(pct: Int) {
    Column {
        Text(stringResource(R.string.workout_result_regularity_label), style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
        Text("$pct %", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PandaOnBackground)
        Spacer(Modifier.height(6.dp))
        androidx.compose.material3.LinearProgressIndicator(
            progress = { pct / 100f },
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp)),
            color = regularityColor(pct),
            trackColor = MaterialTheme.colorScheme.surfaceVariant,
        )
    }
}

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
                Box(modifier = Modifier.weight(1f)) { RegularityIndicator(pct) }
            }
        }
        Spacer(Modifier.height(16.dp))
        FreeRunPaceChart(analysis.chartSplits)
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

/**
 * Ajoute une courbe lissée (Catmull-Rom convertie en Bézier cubique, tension 1/6) passant par
 * [points], en partant du point courant du Path (qui doit déjà être à `points.first()`). Les points
 * de contrôle aux extrémités dupliquent le point de bord (clamping), pour un lissage cohérent sans
 * dépasser les données en dehors de la plage.
 *
 * [maxY] (optionnel) plafonne la courbe : un Catmull-Rom peut légèrement "dépasser" (undershoot)
 * sous ses points d'ancrage entre deux valeurs basses proches de la ligne de base — indésirable pour
 * un dénivelé, qui ne doit jamais descendre sous l'axe des abscisses. Comme un Bézier cubique n'a pas
 * de solution triviale pour son extremum, chaque segment est échantillonné en petits pas rectilignes
 * (au lieu d'un unique cubicTo) pour pouvoir clamper chaque point à la volée.
 */
private fun androidx.compose.ui.graphics.Path.addSmoothCurveThrough(
    points: List<androidx.compose.ui.geometry.Offset>,
    maxY: Float? = null,
) {
    if (points.size < 2) return
    val steps = if (maxY != null) 16 else 1
    for (i in 0 until points.size - 1) {
        val p0 = points.getOrElse(i - 1) { points[i] }
        val p1 = points[i]
        val p2 = points[i + 1]
        val p3 = points.getOrElse(i + 2) { p2 }
        val c1x = p1.x + (p2.x - p0.x) / 6f
        val c1y = p1.y + (p2.y - p0.y) / 6f
        val c2x = p2.x - (p3.x - p1.x) / 6f
        val c2y = p2.y - (p3.y - p1.y) / 6f
        if (maxY == null) {
            cubicTo(c1x, c1y, c2x, c2y, p2.x, p2.y)
        } else {
            for (s in 1..steps) {
                val t = s / steps.toFloat()
                val x = cubicBezierAt(p1.x, c1x, c2x, p2.x, t)
                val y = cubicBezierAt(p1.y, c1y, c2y, p2.y, t).coerceAtMost(maxY)
                lineTo(x, y)
            }
        }
    }
}

private fun cubicBezierAt(p0: Float, p1: Float, p2: Float, p3: Float, t: Float): Float {
    val u = 1f - t
    return u * u * u * p0 + 3f * u * u * t * p1 + 3f * u * t * t * p2 + t * t * t * p3
}

private val PACE_TICK_STEPS_SEC = listOf(10.0, 15.0, 30.0, 60.0, 120.0, 180.0, 300.0, 600.0)
private val ELEVATION_TICK_STEPS_M = listOf(5.0, 10.0, 20.0, 50.0, 100.0, 200.0, 500.0)

/**
 * Labels d'axe X : uniquement les km entiers (1, 2, 3…) + la distance totale exacte en fin de tracé
 * (ex. 4,83 km), pour ne pas surcharger l'axe. Un split est choisi par km entier (le plus proche de
 * la borne km*1000m) ; le dernier split est toujours affiché avec la distance totale précise.
 */
private fun kmAxisLabels(splits: List<KmSplit>): List<Pair<Int, String>> {
    if (splits.isEmpty()) return emptyList()
    val totalM = splits.last().cumulativeDistanceM
    val totalKmFloor = (totalM / 1000.0).toInt()
    val labels = LinkedHashMap<Int, String>()
    for (km in 1..totalKmFloor) {
        val targetM = km * 1000.0
        val idx = splits.indices.minBy { kotlin.math.abs(splits[it].cumulativeDistanceM - targetM) }
        labels[idx] = "$km km"
    }
    labels[splits.lastIndex] = "%.2f km".format(Locale.FRANCE, totalM / 1000.0)
    return labels.entries.map { it.key to it.value }.sortedBy { it.first }
}

private fun formatPaceTick(sec: Double): String {
    val total = sec.toInt().coerceAtLeast(0)
    return "%d:%02d".format(total / 60, total % 60)
}

/**
 * Légende (- - Allure / - - Dénivelé) au-dessus du graphique, dans le style du mockup de référence.
 */
@Composable
private fun ChartLegendItem(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Canvas(modifier = Modifier.size(width = 16.dp, height = 2.dp)) {
            drawLine(
                color = color,
                start = androidx.compose.ui.geometry.Offset(0f, size.height / 2),
                end = androidx.compose.ui.geometry.Offset(size.width, size.height / 2),
                strokeWidth = size.height,
                pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(8f, 6f)),
            )
        }
        Spacer(Modifier.width(4.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
    }
}

/**
 * Graphique allure (+ dénivelé si disponible) par split, avec axes Y annotés (allure à gauche,
 * dénivelé à droite) et axe X en distance cumulée réelle — en Canvas unique (cf. leçon de l'étape
 * intervalles : éviter les composables imbriqués multiples par point, préférer un seul Canvas).
 */
@Composable
private fun FreeRunPaceChart(splits: List<KmSplit>) {
    val hasElevation = splits.any { (it.elevationGainM ?: 0) > 0 }
    val slowestPace = splits.maxOf { it.paceSecPerKm }.toDouble()
    val fastestPace = splits.minOf { it.paceSecPerKm }.toDouble()
    val maxElevation = splits.maxOf { it.elevationGainM ?: 0 }.toDouble().coerceAtLeast(1.0)

    val paceTicks = com.pandafit.feature.running.model.niceAxisTicks(fastestPace, slowestPace, 4, PACE_TICK_STEPS_SEC)
    val elevationTicks = com.pandafit.feature.running.model.niceAxisTicks(0.0, maxElevation, 4, ELEVATION_TICK_STEPS_M, padMin = false)
    val paceTickMin = paceTicks.first()
    val paceTickRange = (paceTicks.last() - paceTickMin).coerceAtLeast(0.001)
    val elevationTickMax = elevationTicks.last().coerceAtLeast(0.001)

    val paceLineColor = PandaGreen
    val elevationColor = com.pandafit.designsystem.theme.PandaBlue
    val gridColor = PandaSubtext.copy(alpha = 0.15f)

    val axisLabels = remember(splits) { kmAxisLabels(splits) }

    // Deux bandes distinctes dans la même hauteur de graphique — l'allure en haut, le dénivelé en
    // bas — les deux axes partagent toute la hauteur du graphique (ils peuvent se chevaucher, accepté).
    val chartHeightDp = 140.dp

    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            ChartLegendItem(paceLineColor, stringResource(R.string.running_execute_cell_pace))
            if (hasElevation) {
                Spacer(Modifier.width(16.dp))
                ChartLegendItem(elevationColor, stringResource(R.string.running_execute_cell_elevation))
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(modifier = Modifier.fillMaxWidth()) {
            // Axe Y gauche — allure, sur toute la hauteur.
            Column(
                modifier = Modifier.height(chartHeightDp),
                verticalArrangement = Arrangement.SpaceBetween,
                horizontalAlignment = Alignment.End,
            ) {
                // Pas de asReversed() ici : l'allure la plus rapide (valeur la plus petite) doit
                // être en haut, l'allure la plus lente en bas — cf. mapping du Canvas plus bas.
                paceTicks.forEach { tick ->
                    Text(formatPaceTick(tick), style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
                }
            }
            Spacer(Modifier.width(4.dp))
            Canvas(
                modifier = Modifier
                    .weight(1f)
                    .height(chartHeightDp),
            ) {
                val slotWidth = size.width / splits.size
                val chartHeight = size.height

                // Grille horizontale — une ligne par graduation, sur toute la hauteur.
                paceTicks.forEach { tick ->
                    val y = chartHeight * ((tick - paceTickMin) / paceTickRange).toFloat()
                    drawLine(gridColor, androidx.compose.ui.geometry.Offset(0f, y), androidx.compose.ui.geometry.Offset(size.width, y), strokeWidth = 1f)
                }
                if (hasElevation) {
                    elevationTicks.forEach { tick ->
                        val y = chartHeight - chartHeight * (tick / elevationTickMax).toFloat()
                        drawLine(gridColor, androidx.compose.ui.geometry.Offset(0f, y), androidx.compose.ui.geometry.Offset(size.width, y), strokeWidth = 1f)
                    }
                }

                // Dénivelé — part toujours du bas (0 m), dégradé qui s'estompe vers la ligne de base.
                // Lissé en courbe (Catmull-Rom → Bézier) plutôt qu'en segments droits : un profil de
                // terrain n'est jamais anguleux, et ça évite l'effet "pic de montagne" en dents de scie.
                if (hasElevation) {
                    val elevationPoints = splits.mapIndexed { index, split ->
                        val x = index * slotWidth + slotWidth / 2
                        val elevationFraction = (split.elevationGainM ?: 0).toDouble() / elevationTickMax
                        val y = chartHeight - chartHeight * elevationFraction.toFloat()
                        androidx.compose.ui.geometry.Offset(x, y)
                    }
                    val elevationPath = androidx.compose.ui.graphics.Path()
                    elevationPath.moveTo(0f, chartHeight)
                    elevationPath.lineTo(elevationPoints.first().x, elevationPoints.first().y)
                    elevationPath.addSmoothCurveThrough(elevationPoints, maxY = chartHeight)
                    elevationPath.lineTo(size.width, chartHeight)
                    elevationPath.close()
                    drawPath(
                        elevationPath,
                        brush = androidx.compose.ui.graphics.Brush.verticalGradient(
                            colors = listOf(elevationColor.copy(alpha = 0.38f), elevationColor.copy(alpha = 0.03f)),
                            startY = 0f,
                            endY = chartHeight,
                        ),
                    )
                    drawPath(elevationPath, color = elevationColor.copy(alpha = 0.5f), style = androidx.compose.ui.graphics.drawscope.Stroke(width = 3f))
                }

                // Allure — part toujours du bas, dégradé sous la ligne. Axe inversé : allure plus
                // rapide (valeur plus petite) = plus haut.
                val pacePoints = splits.mapIndexed { index, split ->
                    val x = index * slotWidth + slotWidth / 2
                    val y = chartHeight * ((split.paceSecPerKm - paceTickMin) / paceTickRange).toFloat()
                    androidx.compose.ui.geometry.Offset(x, y)
                }
                val paceFillPath = androidx.compose.ui.graphics.Path()
                paceFillPath.moveTo(pacePoints.first().x, chartHeight)
                pacePoints.forEach { paceFillPath.lineTo(it.x, it.y) }
                paceFillPath.lineTo(pacePoints.last().x, chartHeight)
                paceFillPath.close()
                drawPath(
                    paceFillPath,
                    brush = androidx.compose.ui.graphics.Brush.verticalGradient(
                        colors = listOf(paceLineColor.copy(alpha = 0.30f), paceLineColor.copy(alpha = 0.02f)),
                        startY = 0f,
                        endY = chartHeight,
                    ),
                )
                val paceLinePath = androidx.compose.ui.graphics.Path()
                pacePoints.forEachIndexed { index, point ->
                    if (index == 0) paceLinePath.moveTo(point.x, point.y) else paceLinePath.lineTo(point.x, point.y)
                }
                drawPath(paceLinePath, color = paceLineColor, style = androidx.compose.ui.graphics.drawscope.Stroke(width = 5f))
            }
            if (hasElevation) {
                Spacer(Modifier.width(4.dp))
                // Axe Y droit — dénivelé, sur toute la hauteur.
                Column(
                    modifier = Modifier.height(chartHeightDp),
                    verticalArrangement = Arrangement.SpaceBetween,
                    horizontalAlignment = Alignment.Start,
                ) {
                    elevationTicks.asReversed().forEach { tick ->
                        Text("${tick.toInt()} m", style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
                    }
                }
            }
        }
        Spacer(Modifier.height(4.dp))
        Row(modifier = Modifier.fillMaxWidth()) {
            // Réserve la même largeur que la colonne de graduations Y gauche (invisible), pour
            // que les labels de distance restent alignés sous le Canvas — pas sous la ligne entière.
            Column(horizontalAlignment = Alignment.End) {
                paceTicks.forEach { tick ->
                    Text(
                        formatPaceTick(tick),
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.alpha(0f),
                    )
                }
            }
            Spacer(Modifier.width(4.dp))
            val totalDistanceM = splits.last().cumulativeDistanceM
            val density = LocalDensity.current
            BoxWithConstraints(modifier = Modifier.weight(1f)) {
                val widthPx = with(density) { maxWidth.toPx() }
                // Réserve la place du dernier label (distance totale) à droite : tout label intermédiaire
                // qui empiéterait dessus est masqué, plutôt que de se chevaucher avec lui.
                val reservedRightPx = with(density) { 40.dp.toPx() }
                axisLabels.forEach { (index, label) ->
                    val isLast = index == splits.lastIndex
                    if (isLast) {
                        // Distance totale — collée au bord droit du graphique, jamais décalée par fraction
                        // (évite tout débordement puisque le texte s'étend vers la gauche depuis ce bord).
                        Text(
                            label,
                            style = MaterialTheme.typography.labelSmall,
                            color = PandaSubtext,
                            maxLines = 1,
                            softWrap = false,
                            modifier = Modifier.align(Alignment.CenterEnd),
                        )
                    } else {
                        val fraction = (splits[index].cumulativeDistanceM / totalDistanceM).toFloat().coerceIn(0f, 1f)
                        val xPx = fraction * widthPx
                        if (xPx < widthPx - reservedRightPx) {
                            val xDp = with(density) { xPx.toDp() }
                            Text(
                                label,
                                style = MaterialTheme.typography.labelSmall,
                                color = PandaSubtext,
                                maxLines = 1,
                                softWrap = false,
                                modifier = Modifier.align(Alignment.CenterStart).offset(x = xDp),
                            )
                        }
                    }
                }
            }
            if (hasElevation) {
                Spacer(Modifier.width(4.dp))
                Column(horizontalAlignment = Alignment.Start) {
                    elevationTicks.asReversed().forEach { tick ->
                        Text(
                            "${tick.toInt()} m",
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.alpha(0f),
                        )
                    }
                }
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

/** Icône + couleur par métrique, dans l'esprit du mockup (cœur rose/rouge, flamme, chaussure, montagne). */
private fun metricIcon(kind: MetricKind): Pair<androidx.compose.ui.graphics.vector.ImageVector, Color> = when (kind) {
    MetricKind.HR_AVG -> Icons.Filled.Favorite to com.pandafit.designsystem.theme.PandaMascotFemaleAccent
    MetricKind.HR_MAX -> Icons.Filled.MonitorHeart to PandaRed
    MetricKind.CALORIES -> Icons.Filled.LocalFireDepartment to PandaOrange
    MetricKind.CADENCE -> Icons.Filled.DirectionsRun to androidx.compose.ui.graphics.Color(0xFF14B8A6)
    MetricKind.ELEVATION -> Icons.Filled.Terrain to com.pandafit.designsystem.theme.PandaPurple
}

@Composable
private fun WorkoutMetricsRow(metrics: List<MetricItem>) {
    Row(
        modifier = Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        metrics.forEach { metric ->
            val (icon, color) = metricIcon(metric.kind)
            Column(
                modifier = Modifier
                    .width(84.dp)
                    .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(12.dp))
                    .padding(vertical = 12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .background(color.copy(alpha = 0.15f), androidx.compose.foundation.shape.CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(18.dp))
                }
                Spacer(Modifier.height(6.dp))
                Text(metric.value, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = PandaOnBackground)
                Spacer(Modifier.height(2.dp))
                Text(metric.label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
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
