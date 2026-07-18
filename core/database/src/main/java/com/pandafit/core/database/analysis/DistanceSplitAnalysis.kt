package com.pandafit.core.database.analysis

import com.pandafit.core.database.entities.GpsTrackPointEntity
import com.pandafit.core.database.model.IntervalRepResult
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Grandeur portée par [DistanceSplit.metricValue] — allure (running, secondes/km, plus petit = mieux)
 * ou vitesse (cyclisme/randonnée, km/h, plus grand = mieux). Généralisé depuis le calcul de splits
 * course à pied pour être réutilisé par les 3 sports GPS (cf. bible design "même style que le running").
 */
enum class SplitMetric { PACE_SEC_PER_KM, SPEED_KMH }

data class DistanceSplit(
    /** Numéro 1-based du split (km ou lap) — sert d'axe X / libellé. */
    val index: Int,
    /** Allure (sec/km) ou vitesse (km/h) selon [DistanceSplitAnalysis.metric]. */
    val metricValue: Double,
    /** Dénivelé positif cumulé sur ce split — null si aucun point n'a d'altitude. */
    val elevationGainM: Int?,
    /** Distance cumulée réelle (mètres) à la fin de ce split — sert d'abscisse au graphique. */
    val cumulativeDistanceM: Double,
)

data class DistanceSplitAnalysis(
    val metric: SplitMetric,
    /** Splits par km/lap exact — sert de base au % de régularité et aux stats meilleur/pire. */
    val splits: List<DistanceSplit>,
    /**
     * Splits plus fins (ex. tous les 200 m) utilisés uniquement pour le tracé du graphique, plus
     * lisible qu'un point par km. N'affecte ni le % de régularité ni les stats meilleur/pire, qui
     * restent basées sur [splits]. Retombe sur [splits] quand une sous-résolution n'a pas de sens
     * (import TCX par lap, cf. [computeDistanceSplitAnalysisFromLaps]).
     */
    val chartSplits: List<DistanceSplit>,
    /** Coefficient de variation de la métrique, borné [0,100] — indicatif, pas une mesure scientifique absolue. */
    val regularityPercent: Int?,
    /** Split représentant la meilleure performance (allure la plus rapide / vitesse la plus haute). */
    val bestSplit: DistanceSplit,
    /** Split représentant la moins bonne performance. */
    val worstSplit: DistanceSplit,
)

/** Pas des splits utilisés pour le tracé du graphique (GPS live uniquement — cf. [computeDistanceSplitAnalysis]). */
const val CHART_SPLIT_INTERVAL_M = 200.0

/** Laps sous ce seuil (arrêt, feu rouge…) exclus du %régularité et meilleur/pire split — cf. [computeDistanceSplitAnalysisFromLaps]. */
private const val MIN_LAP_DISTANCE_FOR_STATS_M = 200.0

private fun paceSecPerKmToMetric(paceSecPerKm: Double, metric: SplitMetric): Double = when (metric) {
    SplitMetric.PACE_SEC_PER_KM -> paceSecPerKm
    SplitMetric.SPEED_KMH -> if (paceSecPerKm > 0) 3600.0 / paceSecPerKm else 0.0
}

/** Vrai si une valeur plus petite est meilleure (allure) — sert à choisir le split min/max dans [computeDistanceSplitAnalysis]. */
private fun SplitMetric.lowerIsBetter() = this == SplitMetric.PACE_SEC_PER_KM

/**
 * Calcule les splits par kilomètre à partir du tracé GPS brut (distance cumulée par Haversine,
 * temps écoulé par différence d'horodatage). Nécessite de vrais horodatages point par point :
 * un import TCX les a tous à 0 ([GpsTrackPointEntity.timestampMs]), auquel cas cette fonction
 * renvoie une liste vide plutôt que d'inventer des temps de passage.
 */
fun computeKmSplits(points: List<GpsTrackPointEntity>, metric: SplitMetric): List<DistanceSplit> =
    computeSplitsAtInterval(points, 1000.0, metric)

/**
 * Comme [computeKmSplits] mais avec un pas de distance configurable — utilisé pour lisser le tracé
 * du graphique (ex. 200 m) sans changer la sémantique "par km" du % de régularité et des stats.
 */
fun computeSplitsAtInterval(points: List<GpsTrackPointEntity>, intervalM: Double, metric: SplitMetric): List<DistanceSplit> {
    if (points.size < 2) return emptyList()
    if (points.all { it.timestampMs == 0L }) return emptyList()

    val splits = mutableListOf<DistanceSplit>()
    var cumulativeDistanceM = 0.0
    var splitStartDistanceM = 0.0
    var splitStartTimeMs = points.first().timestampMs
    var splitElevationGainM = 0.0
    var nextBoundary = intervalM

    for (i in 1 until points.size) {
        val prev = points[i - 1]
        val curr = points[i]
        val segmentDistanceM = haversineMeters(prev.latitude, prev.longitude, curr.latitude, curr.longitude)
        cumulativeDistanceM += segmentDistanceM

        val prevAlt = prev.altitudeM
        val currAlt = curr.altitudeM
        if (prevAlt != null && currAlt != null && currAlt > prevAlt) {
            splitElevationGainM += currAlt - prevAlt
        }

        while (cumulativeDistanceM >= nextBoundary) {
            val elapsedSec = (curr.timestampMs - splitStartTimeMs) / 1000.0
            val splitDistanceKm = (nextBoundary - splitStartDistanceM) / 1000.0
            if (elapsedSec > 0 && splitDistanceKm > 0) {
                val paceSecPerKm = (elapsedSec / splitDistanceKm).toInt()
                splits += DistanceSplit(
                    index = splits.size + 1,
                    metricValue = paceSecPerKmToMetric(paceSecPerKm.toDouble(), metric),
                    elevationGainM = splitElevationGainM.toInt().takeIf { prevAlt != null || currAlt != null },
                    cumulativeDistanceM = nextBoundary,
                )
            }
            splitStartDistanceM = nextBoundary
            splitStartTimeMs = curr.timestampMs
            splitElevationGainM = 0.0
            nextBoundary += intervalM
        }
    }
    return splits
}

/** Coefficient de variation de la métrique, borné [0,100] — indicatif, pas une mesure scientifique absolue. */
fun computeRegularityFromSplits(splits: List<DistanceSplit>): Int? {
    if (splits.size < 2) return null
    val values = splits.map { it.metricValue }
    val mean = values.average()
    if (mean <= 0.0) return null
    val variance = values.sumOf { (it - mean) * (it - mean) } / values.size
    val coefficientOfVariation = sqrt(variance) / mean
    return (100 * (1 - coefficientOfVariation)).coerceIn(0.0, 100.0).toInt()
}

/**
 * Analyse d'une sortie libre à partir du tracé GPS brut. Retourne null si les splits par km ne
 * sont pas calculables (pas de tracé, ou horodatages absents — import TCX) : l'appelant doit alors
 * retomber sur une analyse basique, jamais une courbe inventée.
 */
fun computeDistanceSplitAnalysis(points: List<GpsTrackPointEntity>, metric: SplitMetric): DistanceSplitAnalysis? {
    val splits = computeKmSplits(points, metric)
    if (splits.size < 2) return null
    val best = if (metric.lowerIsBetter()) splits.minBy { it.metricValue } else splits.maxBy { it.metricValue }
    val worst = if (metric.lowerIsBetter()) splits.maxBy { it.metricValue } else splits.minBy { it.metricValue }
    val chartSplits = computeSplitsAtInterval(points, CHART_SPLIT_INTERVAL_M, metric).takeIf { it.size >= 2 } ?: splits
    return DistanceSplitAnalysis(
        metric = metric,
        splits = splits,
        chartSplits = chartSplits,
        regularityPercent = computeRegularityFromSplits(splits),
        bestSplit = best,
        worstSplit = worst,
    )
}

/**
 * Analyse d'une sortie libre importée depuis un TCX, à partir des laps de la montre (distance/durée
 * brutes par lap, cf. [IntervalRepResult.distanceM]/[durationSec]) plutôt que des horodatages point
 * par point du tracé GPS — inexploitables sur un import TCX (tous à 0, cf. [computeKmSplits]).
 * Le dénivelé par split est approximé en attribuant les points GPS du tracé aux bornes de distance
 * cumulée de chaque lap, pour rester cohérent avec le tracé affiché sur la carte.
 */
fun computeDistanceSplitAnalysisFromLaps(
    reps: List<IntervalRepResult>,
    points: List<GpsTrackPointEntity>,
    metric: SplitMetric,
): DistanceSplitAnalysis? {
    val validReps = reps.filter { it.distanceM > 0.0 && it.durationSec > 0.0 }
    if (validReps.size < 2) return null

    var cumulativeDistanceM = 0.0
    val boundariesM = validReps.map { rep -> cumulativeDistanceM += rep.distanceM; cumulativeDistanceM }
    val elevations = computeElevationPerSplit(points, boundariesM)

    val splits = validReps.mapIndexed { index, rep ->
        val paceSecPerKm = rep.durationSec / (rep.distanceM / 1000.0)
        DistanceSplit(
            index = index + 1,
            metricValue = paceSecPerKmToMetric(paceSecPerKm, metric),
            elevationGainM = elevations[index],
            cumulativeDistanceM = boundariesM[index],
        )
    }

    // Un lap manuel très court (ex. arrêt à un feu rouge) n'est pas un effort comparable aux autres
    // laps — il fausserait la régularité et le meilleur/pire split. Affiché quand même sur le
    // graphique (fidèle aux vrais laps de la montre), juste exclu des stats. Repli sur tous les
    // splits si moins de 2 laps franchissent le seuil (évite un %/best/worst manquant sur une sortie
    // atypique).
    val statSplits = validReps.zip(splits)
        .filter { (rep, _) -> rep.distanceM >= MIN_LAP_DISTANCE_FOR_STATS_M }
        .map { (_, split) -> split }
        .takeIf { it.size >= 2 } ?: splits

    val best = if (metric.lowerIsBetter()) statSplits.minBy { it.metricValue } else statSplits.maxBy { it.metricValue }
    val worst = if (metric.lowerIsBetter()) statSplits.maxBy { it.metricValue } else statSplits.minBy { it.metricValue }
    return DistanceSplitAnalysis(
        metric = metric,
        splits = splits,
        chartSplits = splits, // pas de sous-résolution possible : un seul point de temps par lap.
        regularityPercent = computeRegularityFromSplits(statSplits),
        bestSplit = best,
        worstSplit = worst,
    )
}

/** Dénivelé positif par split, en attribuant chaque segment GPS au split dont la borne de distance cumulée n'est pas encore atteinte. */
private fun computeElevationPerSplit(points: List<GpsTrackPointEntity>, boundariesM: List<Double>): List<Int?> {
    if (points.size < 2 || boundariesM.isEmpty()) return boundariesM.map { null }
    val gains = DoubleArray(boundariesM.size)
    val hasAltitude = BooleanArray(boundariesM.size)
    var cumulativeDistanceM = 0.0
    var splitIndex = 0

    for (i in 1 until points.size) {
        val prev = points[i - 1]
        val curr = points[i]
        cumulativeDistanceM += haversineMeters(prev.latitude, prev.longitude, curr.latitude, curr.longitude)
        while (splitIndex < boundariesM.lastIndex && cumulativeDistanceM > boundariesM[splitIndex]) {
            splitIndex++
        }

        val prevAlt = prev.altitudeM
        val currAlt = curr.altitudeM
        if (prevAlt != null && currAlt != null) {
            hasAltitude[splitIndex] = true
            if (currAlt > prevAlt) gains[splitIndex] += currAlt - prevAlt
        }
    }
    return gains.indices.map { if (hasAltitude[it]) gains[it].toInt() else null }
}

private fun haversineMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
    val earthRadiusM = 6_371_000.0
    val dLat = Math.toRadians(lat2 - lat1)
    val dLon = Math.toRadians(lon2 - lon1)
    val a = sin(dLat / 2) * sin(dLat / 2) +
        cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2) * sin(dLon / 2)
    val c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return earthRadiusM * c
}

/**
 * Génère des graduations "rondes" couvrant [min, max] à partir d'une liste de pas candidats
 * (ex. secondes d'allure : 10/15/30/60/120s ; mètres de dénivelé : 5/10/20/50/100m), en choisissant
 * le plus petit pas qui tient en ~[targetCount] graduations.
 */
fun niceAxisTicks(
    min: Double,
    max: Double,
    targetCount: Int,
    candidateSteps: List<Double>,
    /** false pour un axe pinné à [min] (ex. dénivelé qui part toujours de 0) — pas de marge en dessous. */
    padMin: Boolean = true,
): List<Double> {
    val range = (max - min).coerceAtLeast(0.001)
    val rawStep = range / (targetCount - 1).coerceAtLeast(1)
    val step = candidateSteps.firstOrNull { it >= rawStep } ?: candidateSteps.last()
    // Marge explicite avant l'arrondi (15% d'un pas) : sans ça, une valeur juste en dessous d'un
    // multiple du pas (ex. max=449.9 avec pas=30) s'arrondit presque sans marge visible (450), et la
    // courbe touche quasiment le bord du graphique — pas seulement dans le cas pile-exact.
    val margin = step * 0.15
    val niceMin = if (padMin) floor((min - margin) / step) * step else floor(min / step) * step
    val niceMax = ceil((max + margin) / step) * step
    val ticks = mutableListOf<Double>()
    var v = niceMin
    while (v <= niceMax + step * 0.5) {
        ticks.add(v)
        v += step
    }
    return ticks
}

private fun floor(x: Double) = kotlin.math.floor(x)
private fun ceil(x: Double) = kotlin.math.ceil(x)
