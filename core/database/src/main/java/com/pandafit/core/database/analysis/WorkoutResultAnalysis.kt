package com.pandafit.core.database.analysis

import com.pandafit.core.database.entities.WorkoutEntity

/**
 * Troisième métrique du Hero (les deux premières sont toujours Distance et Allure/Vitesse moyenne).
 * Sinon : dénivelé positif > FC moyenne > calories, la première valeur réellement disponible.
 * Ne retourne jamais une métrique dont la valeur serait vide/nulle.
 */
sealed class SignatureMetric {
    data class Elevation(val meters: Int) : SignatureMetric()
    data class HeartRate(val bpm: Int) : SignatureMetric()
    data class Calories(val kcal: Int) : SignatureMetric()
    data class RepsCompleted(val done: Int, val total: Int) : SignatureMetric()
}

fun computeSignatureMetric(workout: WorkoutEntity): SignatureMetric? {
    workout.resultElevationM?.takeIf { it > 0 }?.let { return SignatureMetric.Elevation(it) }
    workout.resultHrAvg?.takeIf { it > 0 }?.let { return SignatureMetric.HeartRate(it) }
    workout.resultCalories?.takeIf { it > 0 }?.let { return SignatureMetric.Calories(it) }
    return null
}

enum class MetricKind { HR_AVG, HR_MAX, CALORIES, CADENCE, ELEVATION }

data class MetricItem(val kind: MetricKind, val label: String, val value: String)

/** Construit dynamiquement la liste des métriques réellement disponibles — jamais de valeur vide/tiret. */
fun computeAvailableMetrics(workout: WorkoutEntity): List<MetricItem> = listOfNotNull(
    workout.resultHrAvg?.takeIf { it > 0 }?.let { MetricItem(MetricKind.HR_AVG, "FC moy.", "$it bpm") },
    workout.resultHrMax?.takeIf { it > 0 }?.let { MetricItem(MetricKind.HR_MAX, "FC max", "$it bpm") },
    workout.resultCalories?.takeIf { it > 0 }?.let { MetricItem(MetricKind.CALORIES, "Calories", "$it kcal") },
    workout.resultCadenceAvgRpm?.takeIf { it > 0 }?.let { MetricItem(MetricKind.CADENCE, "Cadence moy.", "$it ppm") },
    workout.resultElevationM?.takeIf { it > 0 }?.let { MetricItem(MetricKind.ELEVATION, "Dénivelé +", "$it m") },
)

enum class MascotVariant { JOY_MALE, JOY_FEMALE, VICTORY_MALE, VICTORY_FEMALE }

/**
 * Joy par défaut pour cette étape — genre selon la préférence profil. La variante Victory (objectif
 * d'intervalles atteint) nécessite la classification réelle des efforts par rapport à la plage
 * d'allure/puissance cible, pas encore câblée : pas fiable à calculer depuis les données actuelles.
 */
fun computeMascotVariant(isFemale: Boolean): MascotVariant =
    if (isFemale) MascotVariant.JOY_FEMALE else MascotVariant.JOY_MALE

data class WorkoutFeedback(val title: String, val message: String)

/**
 * Feedback déterministe simple — aucune IA, aucune analyse non calculable. Retourne null si les
 * données nécessaires manquent (pas de placeholder vide affiché dans ce cas).
 *
 * Ne fait PAS de claim sur l'atteinte d'une cible ("objectif atteint", "dans la cible") : cela
 * nécessite la classification réelle des efforts (étape ultérieure), pas fiable à calculer depuis
 * `reps.done` seul (toujours vrai pour un import TCX).
 */
fun computeFeedback(workout: WorkoutEntity, hasIntervals: Boolean): WorkoutFeedback? {
    val distanceKm = workout.resultDistanceKm ?: return null
    if (distanceKm <= 0) return null
    return if (hasIntervals) {
        WorkoutFeedback(
            title = "Séance d'intervalles terminée !",
            message = "Chaque séance compte, continue comme ça !",
        )
    } else {
        WorkoutFeedback(
            title = "Belle sortie ! Régularité et endurance au rendez-vous.",
            message = "Chaque sortie compte, continue comme ça !",
        )
    }
}
