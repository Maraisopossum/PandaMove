package com.pandafit.feature.running.model

import com.pandafit.core.database.entities.RunTargetType
import com.pandafit.core.database.entities.WorkoutEntity

/**
 * Vrai si la séance contient de vrais intervalles structurés (une cible d'allure/FC/cadence définie
 * sur au moins une étape course d'un bloc), et pas seulement des splits kilométriques auto-générés
 * par l'import TCX (qui produisent aussi un [RunRepeatEntity] mais sans cible associée).
 */
fun hasRealIntervals(repeatBlocks: List<RunRepeatExecution>): Boolean =
    repeatBlocks.any { it.targetStep?.targetType != null && it.targetStep.targetType != RunTargetType.NONE }

sealed class SignatureMetric {
    data class Elevation(val meters: Int) : SignatureMetric()
    data class HeartRate(val bpm: Int) : SignatureMetric()
    data class Calories(val kcal: Int) : SignatureMetric()
    data class RepsCompleted(val done: Int, val total: Int) : SignatureMetric()
}

/**
 * Troisième métrique du Hero (les deux premières sont toujours Distance et Allure moyenne).
 * Sinon : dénivelé positif > FC moyenne > calories, la première valeur réellement disponible.
 *
 * Le nombre de répétitions n'est PAS utilisé comme métrique signature pour l'instant : pour une
 * séance importée depuis TCX, `repeatBlocks.reps` reflète les laps Garmin bruts (ex. 19 : échauffement
 * + 8 efforts + 8 récups + retour au calme), pas les 8 efforts réels du "8×200". Extraire uniquement
 * les efforts (rawSteps → classifiedSteps → workIntervals) est prévu dans une étape ultérieure
 * (analyse intervalles) ; l'afficher avant cette extraction serait trompeur.
 * Ne retourne jamais une métrique dont la valeur serait vide/nulle.
 */
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
 * d'allure cible (IN_TARGET/FASTER/SLOWER), prévue dans l'étape d'analyse intervalles : pas encore
 * fiable à calculer depuis `reps.done` (coché automatiquement à l'import TCX, sans lien avec l'allure).
 */
fun computeMascotVariant(isFemale: Boolean): MascotVariant =
    if (isFemale) MascotVariant.JOY_FEMALE else MascotVariant.JOY_MALE

data class WorkoutFeedback(val title: String, val message: String)

/**
 * Feedback déterministe simple — aucune IA, aucune analyse non calculable. Retourne null si les
 * données nécessaires manquent (pas de placeholder vide affiché dans ce cas).
 *
 * Ne fait PAS de claim sur l'atteinte d'une cible d'allure ("objectif atteint", "dans la cible") :
 * cela nécessite la classification réelle des efforts (étape ultérieure). `reps.done` ne reflète que
 * si la case a été cochée (toujours vrai pour un import TCX), pas si l'allure était dans la plage cible.
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
