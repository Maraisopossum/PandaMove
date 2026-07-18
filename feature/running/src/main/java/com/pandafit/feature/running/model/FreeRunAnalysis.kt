package com.pandafit.feature.running.model

import com.pandafit.core.database.entities.GpsTrackPointEntity
import com.pandafit.core.database.model.IntervalRepResult
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

data class KmSplit(
    val km: Int,
    val paceSecPerKm: Int,
    /** Dénivelé positif cumulé sur ce split — null si aucun point n'a d'altitude. */
    val elevationGainM: Int?,
    /** Distance cumulée réelle (mètres) à la fin de ce split — sert d'abscisse au graphique. */
    val cumulativeDistanceM: Double = km * 1000.0,
)

data class FreeRunAnalysis(
    /** Splits par km exact — sert de base au % de régularité et aux stats meilleur/pire km. */
    val splits: List<KmSplit>,
    /**
     * Splits plus fins (ex. tous les 250 m) utilisés uniquement pour le tracé du graphique, plus
     * lisible qu'un point par km. N'affecte ni le % de régularité ni les stats meilleur/pire km,
     * qui restent basées sur [splits]. Retombe sur [splits] quand une sous-résolution n'a pas de
     * sens (import TCX par lap, cf. [computeFreeRunAnalysisFromLaps]).
     */
    val chartSplits: List<KmSplit>,
    /** Coefficient de variation de l'allure par km, borné [0,100] — indicatif, pas une mesure scientifique absolue. */
    val regularityPercent: Int?,
    val bestSplit: KmSplit,
    val worstSplit: KmSplit,
)

/** Pas des splits utilisés pour le tracé du graphique (GPS live uniquement — cf. [computeFreeRunAnalysis]). */
const val CHART_SPLIT_INTERVAL_M = 200.0

/**
 * Calcule les splits par kilomètre à partir du tracé GPS brut (distance cumulée par Haversine,
 * temps écoulé par différence d'horodatage). Nécessite de vrais horodatages point par point :
 * un import TCX les a tous à 0 ([GpsTrackPointEntity.timestampMs]), auquel cas cette fonction
 * renvoie une liste vide plutôt que d'inventer des temps de passage.
 */
fun computeKmSplits(points: List<GpsTrackPointEntity>): List<KmSplit> = computeSplitsAtInterval(points, 1000.0)

/**
 * Comme [computeKmSplits] mais avec un pas de distance configurable — utilisé pour lisser le tracé
 * du graphique (ex. 250 m) sans changer la sémantique "par km" du % de régularité et des stats.
 */
fun computeSplitsAtInterval(points: List<GpsTrackPointEntity>, intervalM: Double): List<KmSplit> {
    if (points.size < 2) return emptyList()
    if (points.all { it.timestampMs == 0L }) return emptyList()

    val splits = mutableListOf<KmSplit>()
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
                splits += KmSplit(
                    km = splits.size + 1,
                    paceSecPerKm = paceSecPerKm,
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

/** Coefficient de variation de l'allure, borné [0,100] — indicatif, pas une mesure scientifique absolue. */
fun computeRegularityFromSplits(splits: List<KmSplit>): Int? {
    if (splits.size < 2) return null
    val paces = splits.map { it.paceSecPerKm.toDouble() }
    val mean = paces.average()
    if (mean <= 0.0) return null
    val variance = paces.sumOf { (it - mean) * (it - mean) } / paces.size
    val coefficientOfVariation = sqrt(variance) / mean
    return (100 * (1 - coefficientOfVariation)).coerceIn(0.0, 100.0).toInt()
}

/**
 * Analyse d'une course libre à partir du tracé GPS brut. Retourne null si les splits par km ne
 * sont pas calculables (pas de tracé, ou horodatages absents — import TCX) : l'appelant doit alors
 * retomber sur une analyse basique, jamais une courbe inventée.
 */
fun computeFreeRunAnalysis(points: List<GpsTrackPointEntity>): FreeRunAnalysis? {
    val splits = computeKmSplits(points)
    if (splits.size < 2) return null
    val best = splits.minBy { it.paceSecPerKm }
    val worst = splits.maxBy { it.paceSecPerKm }
    val chartSplits = computeSplitsAtInterval(points, CHART_SPLIT_INTERVAL_M).takeIf { it.size >= 2 } ?: splits
    return FreeRunAnalysis(
        splits = splits,
        chartSplits = chartSplits,
        regularityPercent = computeRegularityFromSplits(splits),
        bestSplit = best,
        worstSplit = worst,
    )
}

/**
 * Analyse d'une course libre importée depuis un TCX, à partir des laps Garmin (distance/durée
 * brutes par lap, cf. [IntervalRepResult.distanceM]/[durationSec]) plutôt que des horodatages
 * point par point du tracé GPS — inexploitables sur un import TCX (tous à 0, cf. [computeKmSplits]).
 * Le dénivelé par split est approximé en attribuant les points GPS du tracé aux bornes de distance
 * cumulée de chaque lap, pour rester cohérent avec le tracé affiché sur la carte.
 */
fun computeFreeRunAnalysisFromLaps(reps: List<IntervalRepResult>, points: List<GpsTrackPointEntity>): FreeRunAnalysis? {
    val validReps = reps.filter { it.distanceM > 0.0 && it.durationSec > 0.0 }
    if (validReps.size < 2) return null

    var cumulativeDistanceM = 0.0
    val boundariesM = validReps.map { rep -> cumulativeDistanceM += rep.distanceM; cumulativeDistanceM }
    val elevations = computeElevationPerSplit(points, boundariesM)

    val splits = validReps.mapIndexed { index, rep ->
        KmSplit(
            km = index + 1,
            paceSecPerKm = (rep.durationSec / (rep.distanceM / 1000.0)).toInt(),
            elevationGainM = elevations[index],
            cumulativeDistanceM = boundariesM[index],
        )
    }

    // Un lap manuel très court (ex. arrêt à un feu rouge) n'est pas un effort comparable aux autres
    // laps — il fausserait la régularité et le meilleur/pire split. Affiché quand même sur le
    // graphique (fidèle aux vrais laps Garmin), juste exclu des stats. Repli sur tous les splits si
    // moins de 2 laps franchissent le seuil (évite un %/best/worst manquant sur une sortie atypique).
    val statSplits = validReps.zip(splits)
        .filter { (rep, _) -> rep.distanceM >= MIN_LAP_DISTANCE_FOR_STATS_M }
        .map { (_, split) -> split }
        .takeIf { it.size >= 2 } ?: splits

    val best = statSplits.minBy { it.paceSecPerKm }
    val worst = statSplits.maxBy { it.paceSecPerKm }
    return FreeRunAnalysis(
        splits = splits,
        chartSplits = splits, // pas de sous-résolution possible : un seul point de temps par lap Garmin.
        regularityPercent = computeRegularityFromSplits(statSplits),
        bestSplit = best,
        worstSplit = worst,
    )
}

/** Laps sous ce seuil (arrêt, feu rouge…) exclus du %régularité et meilleur/pire split — cf. [computeFreeRunAnalysisFromLaps]. */
private const val MIN_LAP_DISTANCE_FOR_STATS_M = 200.0

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
