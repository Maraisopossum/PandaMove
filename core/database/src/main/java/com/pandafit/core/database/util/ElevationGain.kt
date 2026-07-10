package com.pandafit.core.database.util

/**
 * Seuil sous lequel une variation d'altitude est considérée comme du bruit de mesure
 * (GPS téléphone ±10-20 m, baromètre montre plus fin mais pas parfait) et n'est pas comptée
 * comme dénivelé réel — sans ce filtre, le cumul naïf des diffs positives gonfle le dénivelé
 * sur un parcours plat (bruit qui monte et descend en permanence autour de la vraie altitude).
 */
private const val ELEVATION_NOISE_THRESHOLD_M = 2.0

/** Résultat d'une évaluation d'échantillon d'altitude face à la référence courante. */
data class ElevationStep(val newBaselineM: Double, val gainDeltaM: Int)

/**
 * Évalue un nouvel échantillon d'altitude par rapport à la référence courante avec hystérésis :
 * seule une variation dépassant [ELEVATION_NOISE_THRESHOLD_M] déplace la référence et compte
 * comme dénivelé (montée) ou fait redescendre silencieusement la référence (descente). Un
 * échantillon dans la zone de bruit n'a aucun effet — la référence ne bouge pas.
 *
 * Partagé entre [com.pandafit.core.database.catalog.GpsTrackingRepository] (streaming, live)
 * et le parseur TCX (batch, import) pour un calcul de dénivelé cohérent entre les deux sources.
 */
fun evaluateElevationSample(baselineM: Double?, sampleM: Double): ElevationStep {
    if (baselineM == null) return ElevationStep(sampleM, 0)
    val diff = sampleM - baselineM
    return when {
        diff > ELEVATION_NOISE_THRESHOLD_M -> ElevationStep(sampleM, diff.toInt())
        diff < -ELEVATION_NOISE_THRESHOLD_M -> ElevationStep(sampleM, 0)
        else -> ElevationStep(baselineM, 0)
    }
}
