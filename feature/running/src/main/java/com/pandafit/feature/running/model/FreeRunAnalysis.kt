package com.pandafit.feature.running.model

import com.pandafit.core.database.analysis.DistanceSplit
import com.pandafit.core.database.analysis.DistanceSplitAnalysis
import com.pandafit.core.database.analysis.SplitMetric
import com.pandafit.core.database.analysis.computeDistanceSplitAnalysis
import com.pandafit.core.database.analysis.computeDistanceSplitAnalysisFromLaps
import com.pandafit.core.database.analysis.computeRegularityFromSplits as computeRegularityFromDistanceSplits
import com.pandafit.core.database.entities.GpsTrackPointEntity
import com.pandafit.core.database.model.IntervalRepResult

/**
 * Modèle allure (running) au-dessus du moteur générique [DistanceSplitAnalysis] partagé avec
 * cyclisme/randonnée (cf. core/database/analysis) — même calcul, unité vitesse (km/h) pour ces
 * deux autres sports. Conservé tel quel (type + fonctions) pour ne pas casser les appelants running
 * existants (UI, tests) lors de l'extraction du moteur vers core:database.
 */
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
    /** Splits plus fins utilisés uniquement pour le tracé du graphique — cf. [DistanceSplitAnalysis.chartSplits]. */
    val chartSplits: List<KmSplit>,
    /** Coefficient de variation de l'allure par km, borné [0,100] — indicatif, pas une mesure scientifique absolue. */
    val regularityPercent: Int?,
    val bestSplit: KmSplit,
    val worstSplit: KmSplit,
)

private fun DistanceSplit.toKmSplit() = KmSplit(
    km = index,
    paceSecPerKm = metricValue.toInt(),
    elevationGainM = elevationGainM,
    cumulativeDistanceM = cumulativeDistanceM,
)

private fun DistanceSplitAnalysis.toFreeRunAnalysis(): FreeRunAnalysis {
    val kmSplits = splits.map { it.toKmSplit() }
    // bestSplit/worstSplit du moteur générique sont des instances de [splits] (même objet) — on
    // retrouve l'instance convertie correspondante par égalité de contenu plutôt que de dupliquer
    // la logique min/max ici.
    return FreeRunAnalysis(
        splits = kmSplits,
        chartSplits = chartSplits.map { it.toKmSplit() },
        regularityPercent = regularityPercent,
        bestSplit = kmSplits[splits.indexOf(bestSplit)],
        worstSplit = kmSplits[splits.indexOf(worstSplit)],
    )
}

/**
 * Calcule les splits par kilomètre à partir du tracé GPS brut (distance cumulée par Haversine,
 * temps écoulé par différence d'horodatage). Nécessite de vrais horodatages point par point :
 * un import TCX les a tous à 0 ([GpsTrackPointEntity.timestampMs]), auquel cas cette fonction
 * renvoie une liste vide plutôt que d'inventer des temps de passage.
 */
fun computeKmSplits(points: List<GpsTrackPointEntity>): List<KmSplit> =
    com.pandafit.core.database.analysis.computeKmSplits(points, SplitMetric.PACE_SEC_PER_KM).map { it.toKmSplit() }

/** Coefficient de variation de l'allure, borné [0,100] — indicatif, pas une mesure scientifique absolue. */
fun computeRegularityFromSplits(splits: List<KmSplit>): Int? =
    computeRegularityFromDistanceSplits(
        splits.map { DistanceSplit(it.km, it.paceSecPerKm.toDouble(), it.elevationGainM, it.cumulativeDistanceM) },
    )

/**
 * Analyse d'une course libre à partir du tracé GPS brut. Retourne null si les splits par km ne
 * sont pas calculables (pas de tracé, ou horodatages absents — import TCX) : l'appelant doit alors
 * retomber sur une analyse basique, jamais une courbe inventée.
 */
fun computeFreeRunAnalysis(points: List<GpsTrackPointEntity>): FreeRunAnalysis? =
    computeDistanceSplitAnalysis(points, SplitMetric.PACE_SEC_PER_KM)?.toFreeRunAnalysis()

/**
 * Analyse d'une course libre importée depuis un TCX, à partir des laps Garmin (distance/durée
 * brutes par lap) plutôt que des horodatages point par point du tracé GPS — inexploitables sur un
 * import TCX (tous à 0, cf. [computeKmSplits]).
 */
fun computeFreeRunAnalysisFromLaps(reps: List<IntervalRepResult>, points: List<GpsTrackPointEntity>): FreeRunAnalysis? =
    computeDistanceSplitAnalysisFromLaps(reps, points, SplitMetric.PACE_SEC_PER_KM)?.toFreeRunAnalysis()
