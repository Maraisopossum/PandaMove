package com.pandafit.designsystem.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DirectionsRun
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.MonitorHeart
import androidx.compose.material.icons.filled.Terrain
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.pandafit.core.database.analysis.DistanceSplit
import com.pandafit.core.database.analysis.MascotVariant
import com.pandafit.core.database.analysis.MetricItem
import com.pandafit.core.database.analysis.MetricKind
import com.pandafit.core.database.analysis.SignatureMetric
import com.pandafit.core.database.analysis.SplitMetric
import com.pandafit.core.database.analysis.WorkoutFeedback
import com.pandafit.core.database.analysis.niceAxisTicks
import com.pandafit.core.designsystem.R as DesignSystemR
import com.pandafit.designsystem.theme.PandaGreen
import com.pandafit.designsystem.theme.PandaMascotFemaleAccent
import com.pandafit.designsystem.theme.PandaOnBackground
import com.pandafit.designsystem.theme.PandaOrange
import com.pandafit.designsystem.theme.PandaPurple
import com.pandafit.designsystem.theme.PandaRed
import com.pandafit.designsystem.theme.PandaSubtext
import java.util.Locale

/**
 * Composants d'écran de résultat (Hero, feedback, métriques, graphique allure/vitesse + dénivelé)
 * partagés entre running, cyclisme et randonnée — extraits de l'écran running (référence visuelle)
 * pour garantir un même style dans les 3 sports sans dupliquer le Compose ni le recalculer 3 fois.
 */

// ── Cadre commun ─────────────────────────────────────────────────────────────

/** Cadre commun à chaque zone du rapport (Analyse, Parcours, Métriques). */
@Composable
fun ReportSectionCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(modifier = Modifier.padding(16.dp), content = content)
    }
}

// ── Hero ─────────────────────────────────────────────────────────────────────

fun mascotDrawableRes(variant: MascotVariant): Int = when (variant) {
    MascotVariant.JOY_MALE -> DesignSystemR.drawable.panda_joy_male
    MascotVariant.JOY_FEMALE -> DesignSystemR.drawable.panda_joy_female
    MascotVariant.VICTORY_MALE -> DesignSystemR.drawable.panda_victory_male
    MascotVariant.VICTORY_FEMALE -> DesignSystemR.drawable.panda_victory_female
}

/** Une des 2-3 statistiques affichées sous la mascotte (ex. Distance / Allure ou Vitesse / métrique signature). */
data class HeroStat(
    val label: String,
    val value: String,
    val icon: ImageVector? = null,
    val iconTint: Color = PandaSubtext,
)

fun signatureMetricLabel(metric: SignatureMetric): String = when (metric) {
    is SignatureMetric.Elevation -> "Dénivelé +"
    is SignatureMetric.HeartRate -> "FC moyenne"
    is SignatureMetric.Calories -> "Calories"
    is SignatureMetric.RepsCompleted -> "Répétitions"
}

fun signatureMetricValueLabel(metric: SignatureMetric): String = when (metric) {
    is SignatureMetric.Elevation -> "${metric.meters} m"
    is SignatureMetric.HeartRate -> "${metric.bpm} bpm"
    is SignatureMetric.Calories -> "${metric.kcal} kcal"
    is SignatureMetric.RepsCompleted -> "${metric.done} / ${metric.total}"
}

fun signatureMetricIcon(metric: SignatureMetric): ImageVector = when (metric) {
    is SignatureMetric.Elevation -> Icons.Filled.Terrain
    is SignatureMetric.HeartRate -> Icons.Filled.Favorite
    is SignatureMetric.Calories -> Icons.Filled.LocalFireDepartment
    is SignatureMetric.RepsCompleted -> Icons.Filled.EmojiEvents
}

fun signatureMetricIconColor(metric: SignatureMetric): Color = when (metric) {
    is SignatureMetric.Elevation -> PandaPurple
    is SignatureMetric.HeartRate -> PandaMascotFemaleAccent
    is SignatureMetric.Calories -> PandaOrange
    is SignatureMetric.RepsCompleted -> PandaGreen
}

fun signatureMetricToHeroStat(metric: SignatureMetric): HeroStat = HeroStat(
    label = signatureMetricLabel(metric),
    value = signatureMetricValueLabel(metric),
    icon = signatureMetricIcon(metric),
    iconTint = signatureMetricIconColor(metric),
)

/**
 * Bandeau d'en-tête du rapport : mascotte + badge "Terminé" + durée totale + jusqu'à 3 statistiques
 * (typiquement Distance / Allure-Vitesse / métrique signature). [accentColor] teinte le badge
 * "Terminé" — vert running, bleu cyclisme, ambre randonnée.
 */
@Composable
fun WorkoutResultHeroCard(
    mascotVariant: MascotVariant,
    accentColor: Color,
    completedLabel: String,
    durationValue: String,
    durationLabel: String,
    stats: List<HeroStat>,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Image(
                    painter = painterResource(mascotDrawableRes(mascotVariant)),
                    contentDescription = null,
                    modifier = Modifier.size(88.dp),
                )
                Spacer(Modifier.width(12.dp))
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = accentColor)
                        Spacer(Modifier.width(6.dp))
                        Text(
                            completedLabel,
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                            color = accentColor,
                        )
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(
                        durationValue,
                        style = MaterialTheme.typography.displaySmall,
                        fontWeight = FontWeight.ExtraBold,
                        color = PandaOnBackground,
                    )
                    Text(durationLabel, style = MaterialTheme.typography.bodyMedium, color = PandaSubtext)
                }
            }
            Spacer(Modifier.height(16.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                stats.forEach { HeroStatColumn(it) }
            }
        }
    }
}

@Composable
private fun HeroStatColumn(stat: HeroStat) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        if (stat.icon != null) {
            Icon(stat.icon, contentDescription = null, tint = stat.iconTint, modifier = Modifier.size(20.dp))
            Spacer(Modifier.height(4.dp))
        }
        Text(stat.value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold, color = PandaOnBackground)
        Text(stat.label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
    }
}

// ── Feedback ─────────────────────────────────────────────────────────────────

@Composable
fun WorkoutFeedbackBanner(feedback: WorkoutFeedback, containerColor: Color, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(containerColor, RoundedCornerShape(14.dp))
            .padding(14.dp),
    ) {
        Column {
            Text(feedback.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, color = PandaOnBackground)
            Text(feedback.message, style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
        }
    }
}

// ── Métriques secondaires (icônes) ────────────────────────────────────────────

fun metricIcon(kind: MetricKind): Pair<ImageVector, Color> = when (kind) {
    MetricKind.HR_AVG -> Icons.Filled.Favorite to PandaMascotFemaleAccent
    MetricKind.HR_MAX -> Icons.Filled.MonitorHeart to PandaRed
    MetricKind.CALORIES -> Icons.Filled.LocalFireDepartment to PandaOrange
    MetricKind.CADENCE -> Icons.Filled.DirectionsRun to Color(0xFF14B8A6)
    MetricKind.ELEVATION -> Icons.Filled.Terrain to PandaPurple
}

@Composable
fun WorkoutMetricsRow(metrics: List<MetricItem>, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
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
                        .background(color.copy(alpha = 0.15f), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(18.dp))
                }
                Spacer(Modifier.height(6.dp))
                Text(metric.value, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = PandaOnBackground)
                Spacer(Modifier.height(2.dp))
                Text(metric.label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext, textAlign = TextAlign.Center)
            }
        }
    }
}

// ── Régularité ───────────────────────────────────────────────────────────────

private fun regularityColor(pct: Int): Color = when {
    pct >= 85 -> PandaGreen
    pct >= 70 -> PandaOrange
    else -> PandaRed
}

@Composable
fun RegularityIndicator(pct: Int, label: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = PandaSubtext)
        Text("$pct %", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PandaOnBackground)
        Spacer(Modifier.height(6.dp))
        LinearProgressIndicator(
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

// ── Graphique métrique (allure/vitesse) + dénivelé ────────────────────────────

@Composable
fun ChartLegendItem(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Canvas(modifier = Modifier.size(width = 16.dp, height = 2.dp)) {
            drawLine(
                color = color,
                start = Offset(0f, size.height / 2),
                end = Offset(size.width, size.height / 2),
                strokeWidth = size.height,
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 6f)),
            )
        }
        Spacer(Modifier.width(4.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
    }
}

/**
 * Labels d'axe X : uniquement les km entiers (1, 2, 3…) + la distance totale exacte en fin de tracé,
 * pour ne pas surcharger l'axe. Un split est choisi par km entier (le plus proche de la borne
 * km*1000m) ; le dernier split est toujours affiché avec la distance totale précise.
 */
private fun distanceAxisLabels(splits: List<DistanceSplit>): List<Pair<Int, String>> {
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

/**
 * Ajoute une courbe lissée (Catmull-Rom convertie en Bézier cubique, tension 1/6) passant par
 * [points]. Les points de contrôle aux extrémités dupliquent le point de bord (clamping).
 * [maxY] (optionnel) plafonne la courbe pour un dénivelé, qui ne doit jamais descendre sous l'axe.
 */
private fun Path.addSmoothCurveThrough(points: List<Offset>, maxY: Float? = null) {
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

/**
 * Graphique métrique (allure ou vitesse selon [metric]) + dénivelé si disponible, par split, avec
 * axes Y annotés et axe X en distance cumulée réelle — un seul Canvas.
 *
 * [emphasizeElevation] inverse l'emphase visuelle (dénivelé au premier plan, trait plus épais) —
 * utilisé en randonnée où le profil de terrain compte plus que la vitesse.
 */
@Composable
fun SplitAnalysisChart(
    splits: List<DistanceSplit>,
    metric: SplitMetric,
    metricLegendLabel: String,
    metricColor: Color,
    elevationColor: Color,
    elevationLegendLabel: String,
    metricTickSteps: List<Double>,
    formatMetricTick: (Double) -> String,
    emphasizeElevation: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val hasElevation = splits.any { (it.elevationGainM ?: 0) > 0 }
    val slowest = splits.maxOf { it.metricValue }
    val fastest = splits.minOf { it.metricValue }
    val maxElevation = splits.maxOf { it.elevationGainM ?: 0 }.toDouble().coerceAtLeast(1.0)

    val metricTicks = niceAxisTicks(fastest, slowest, 4, metricTickSteps)
    val elevationTicks = niceAxisTicks(0.0, maxElevation, 4, ELEVATION_TICK_STEPS_M, padMin = false)
    val metricTickMin = metricTicks.first()
    val metricTickRange = (metricTicks.last() - metricTickMin).coerceAtLeast(0.001)
    val elevationTickMax = elevationTicks.last().coerceAtLeast(0.001)

    // Allure : valeur basse (rapide) = mieux = en haut du graphique. Vitesse : valeur haute = mieux
    // = en haut. La fraction Y est donc inversée pour la vitesse, y compris l'ordre des libellés d'axe.
    val higherIsBetter = metric == SplitMetric.SPEED_KMH
    fun yFraction(value: Double): Float {
        val raw = ((value - metricTickMin) / metricTickRange).toFloat()
        return if (higherIsBetter) 1f - raw else raw
    }
    val orderedMetricTicks = if (higherIsBetter) metricTicks.asReversed() else metricTicks

    val gridColor = PandaSubtext.copy(alpha = 0.15f)
    val axisLabels = remember(splits) { distanceAxisLabels(splits) }
    val chartHeightDp = 140.dp

    Column(modifier = modifier) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (emphasizeElevation && hasElevation) {
                ChartLegendItem(elevationColor, elevationLegendLabel)
                Spacer(Modifier.width(16.dp))
                ChartLegendItem(metricColor, metricLegendLabel)
            } else {
                ChartLegendItem(metricColor, metricLegendLabel)
                if (hasElevation) {
                    Spacer(Modifier.width(16.dp))
                    ChartLegendItem(elevationColor, elevationLegendLabel)
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.height(chartHeightDp),
                verticalArrangement = Arrangement.SpaceBetween,
                horizontalAlignment = Alignment.End,
            ) {
                orderedMetricTicks.forEach { tick ->
                    Text(formatMetricTick(tick), style = MaterialTheme.typography.labelSmall, color = PandaSubtext)
                }
            }
            Spacer(Modifier.width(4.dp))
            Canvas(modifier = Modifier.weight(1f).height(chartHeightDp)) {
                val slotWidth = size.width / splits.size
                val chartHeight = size.height

                metricTicks.forEach { tick ->
                    val y = chartHeight * yFraction(tick)
                    drawLine(gridColor, Offset(0f, y), Offset(size.width, y), strokeWidth = 1f)
                }
                if (hasElevation) {
                    elevationTicks.forEach { tick ->
                        val y = chartHeight - chartHeight * (tick / elevationTickMax).toFloat()
                        drawLine(gridColor, Offset(0f, y), Offset(size.width, y), strokeWidth = 1f)
                    }
                }

                val elevationStrokeWidth = if (emphasizeElevation) 5f else 3f
                val elevationFillAlpha = if (emphasizeElevation) 0.42f else 0.38f
                val metricStrokeWidth = if (emphasizeElevation) 3f else 5f
                val metricFillAlpha = if (emphasizeElevation) 0.18f else 0.30f

                fun drawElevation() {
                    val elevationPoints = splits.mapIndexed { index, split ->
                        val x = index * slotWidth + slotWidth / 2
                        val elevationFraction = (split.elevationGainM ?: 0).toDouble() / elevationTickMax
                        val y = chartHeight - chartHeight * elevationFraction.toFloat()
                        Offset(x, y)
                    }
                    val elevationPath = Path()
                    elevationPath.moveTo(0f, chartHeight)
                    elevationPath.lineTo(elevationPoints.first().x, elevationPoints.first().y)
                    elevationPath.addSmoothCurveThrough(elevationPoints, maxY = chartHeight)
                    elevationPath.lineTo(size.width, chartHeight)
                    elevationPath.close()
                    drawPath(
                        elevationPath,
                        brush = Brush.verticalGradient(
                            colors = listOf(elevationColor.copy(alpha = elevationFillAlpha), elevationColor.copy(alpha = 0.03f)),
                            startY = 0f,
                            endY = chartHeight,
                        ),
                    )
                    drawPath(elevationPath, color = elevationColor.copy(alpha = 0.5f), style = Stroke(width = elevationStrokeWidth))
                }

                fun drawMetric() {
                    val metricPoints = splits.mapIndexed { index, split ->
                        val x = index * slotWidth + slotWidth / 2
                        val y = chartHeight * yFraction(split.metricValue)
                        Offset(x, y)
                    }
                    val metricFillPath = Path()
                    metricFillPath.moveTo(metricPoints.first().x, chartHeight)
                    metricPoints.forEach { metricFillPath.lineTo(it.x, it.y) }
                    metricFillPath.lineTo(metricPoints.last().x, chartHeight)
                    metricFillPath.close()
                    drawPath(
                        metricFillPath,
                        brush = Brush.verticalGradient(
                            colors = listOf(metricColor.copy(alpha = metricFillAlpha), metricColor.copy(alpha = 0.02f)),
                            startY = 0f,
                            endY = chartHeight,
                        ),
                    )
                    val metricLinePath = Path()
                    metricPoints.forEachIndexed { index, point ->
                        if (index == 0) metricLinePath.moveTo(point.x, point.y) else metricLinePath.lineTo(point.x, point.y)
                    }
                    drawPath(metricLinePath, color = metricColor, style = Stroke(width = metricStrokeWidth))
                }

                // La courbe dessinée en dernier est visuellement au premier plan.
                if (emphasizeElevation) {
                    drawMetric()
                    if (hasElevation) drawElevation()
                } else {
                    if (hasElevation) drawElevation()
                    drawMetric()
                }
            }
            if (hasElevation) {
                Spacer(Modifier.width(4.dp))
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
            Column(horizontalAlignment = Alignment.End) {
                orderedMetricTicks.forEach { tick ->
                    Text(formatMetricTick(tick), style = MaterialTheme.typography.labelSmall, modifier = Modifier.alpha(0f))
                }
            }
            Spacer(Modifier.width(4.dp))
            val totalDistanceM = splits.last().cumulativeDistanceM
            val density = LocalDensity.current
            BoxWithConstraints(modifier = Modifier.weight(1f)) {
                val widthPx = with(density) { maxWidth.toPx() }
                val reservedRightPx = with(density) { 40.dp.toPx() }
                axisLabels.forEach { (index, label) ->
                    val isLast = index == splits.lastIndex
                    if (isLast) {
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
                        Text("${tick.toInt()} m", style = MaterialTheme.typography.labelSmall, modifier = Modifier.alpha(0f))
                    }
                }
            }
        }
    }
}

val PACE_TICK_STEPS_SEC = listOf(10.0, 15.0, 30.0, 60.0, 120.0, 180.0, 300.0, 600.0)
val SPEED_TICK_STEPS_KMH = listOf(1.0, 2.0, 5.0, 10.0, 20.0, 50.0)
private val ELEVATION_TICK_STEPS_M = listOf(5.0, 10.0, 20.0, 50.0, 100.0, 200.0, 500.0)

fun formatPaceTick(sec: Double): String {
    val total = sec.toInt().coerceAtLeast(0)
    return "%d:%02d".format(total / 60, total % 60)
}

fun formatSpeedTick(kmh: Double): String = "%.0f".format(kmh)
