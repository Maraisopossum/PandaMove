package com.pandafit.feature.running.model

import com.pandafit.core.database.entities.GpsTrackPointEntity
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

data class KmSplit(
    val km: Int,
    val paceSecPerKm: Int,
    /** Dénivelé positif cumulé sur ce kilomètre — null si aucun point n'a d'altitude. */
    val elevationGainM: Int?,
)

data class FreeRunAnalysis(
    val splits: List<KmSplit>,
    /** Coefficient de variation de l'allure par km, borné [0,100] — indicatif, pas une mesure scientifique absolue. */
    val regularityPercent: Int?,
    val bestSplit: KmSplit,
    val worstSplit: KmSplit,
)

/**
 * Calcule les splits par kilomètre à partir du tracé GPS brut (distance cumulée par Haversine,
 * temps écoulé par différence d'horodatage). Nécessite de vrais horodatages point par point :
 * un import TCX les a tous à 0 ([GpsTrackPointEntity.timestampMs]), auquel cas cette fonction
 * renvoie une liste vide plutôt que d'inventer des temps de passage.
 */
fun computeKmSplits(points: List<GpsTrackPointEntity>): List<KmSplit> {
    if (points.size < 2) return emptyList()
    if (points.all { it.timestampMs == 0L }) return emptyList()

    val splits = mutableListOf<KmSplit>()
    var cumulativeDistanceM = 0.0
    var splitStartDistanceM = 0.0
    var splitStartTimeMs = points.first().timestampMs
    var splitElevationGainM = 0.0
    var nextKmBoundary = 1000.0

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

        while (cumulativeDistanceM >= nextKmBoundary) {
            val elapsedSec = (curr.timestampMs - splitStartTimeMs) / 1000.0
            val splitDistanceKm = (nextKmBoundary - splitStartDistanceM) / 1000.0
            if (elapsedSec > 0 && splitDistanceKm > 0) {
                val paceSecPerKm = (elapsedSec / splitDistanceKm).toInt()
                splits += KmSplit(
                    km = splits.size + 1,
                    paceSecPerKm = paceSecPerKm,
                    elevationGainM = splitElevationGainM.toInt().takeIf { prevAlt != null || currAlt != null },
                )
            }
            splitStartDistanceM = nextKmBoundary
            splitStartTimeMs = curr.timestampMs
            splitElevationGainM = 0.0
            nextKmBoundary += 1000.0
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
    return FreeRunAnalysis(
        splits = splits,
        regularityPercent = computeRegularityFromSplits(splits),
        bestSplit = best,
        worstSplit = worst,
    )
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
