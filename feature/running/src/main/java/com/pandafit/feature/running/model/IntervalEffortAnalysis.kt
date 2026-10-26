package com.pandafit.feature.running.model

import com.pandafit.core.database.entities.RunTargetType
import com.pandafit.core.database.model.IntervalRepResult
import kotlin.math.sqrt

enum class EffortClassification { IN_TARGET, FASTER_THAN_TARGET, SLOWER_THAN_TARGET }

data class WorkEffort(
    val displayNumber: Int,
    val paceSecPerKm: Int,
    val classification: EffortClassification,
)

data class IntervalAnalysis(
    val targetMinSec: Int,
    val targetMaxSec: Int,
    val efforts: List<WorkEffort>,
    /** Coefficient de variation de l'allure des efforts, borné [0,100] — null si &lt; 2 efforts. */
    val regularityPercent: Int?,
    val bestEffort: WorkEffort?,
)

/**
 * Parse une allure formatée en secondes/km. Accepte les deux formats produits par le projet :
 * "3:51" (saisie manuelle, [formatPace]) et "3:51/km" (import TCX, `formatPaceMinKm`).
 */
fun parsePaceSecPerKm(raw: String): Int? {
    val cleaned = raw.substringBefore("/").trim()
    val parts = cleaned.split(":")
    if (parts.size != 2) return null
    val min = parts[0].toIntOrNull() ?: return null
    val sec = parts[1].toIntOrNull() ?: return null
    return min * 60 + sec
}

/** Allure en min/km plus petite = plus rapide. */
fun classifyPace(paceSecPerKm: Int, targetMinSec: Int, targetMaxSec: Int): EffortClassification = when {
    paceSecPerKm < targetMinSec -> EffortClassification.FASTER_THAN_TARGET
    paceSecPerKm > targetMaxSec -> EffortClassification.SLOWER_THAN_TARGET
    else -> EffortClassification.IN_TARGET
}

/**
 * Extrait les répétitions d'effort réelles d'un bloc, en excluant échauffement/récupérations/retour
 * au calme mélangés dans `reps` lors d'un import TCX (voir [hasRealIntervals] pour le contexte).
 *
 * - Exécution native (le ViewModel live crée exactement une entrée par répétition planifiée) :
 *   `reps.size == repeat.repeatCount`, donc déjà les vrais efforts — aucune extraction nécessaire.
 * - Import TCX (les laps Garmin bruts remplacent `resultsJson`, `repeatCount` reste celui du
 *   template) : `reps.size` &gt; `repeatCount`. On ne garde que les laps dont l'allure est plausible
 *   pour un effort (proche de la cible), ce qui exclut naturellement échauffement/récup/retour au
 *   calme — dans la pratique nettement plus lents que la cible d'un fractionné.
 */
fun extractWorkEfforts(reps: List<IntervalRepResult>, repeatCount: Int, targetMinSec: Int, targetMaxSec: Int): List<Pair<IntervalRepResult, Int>> {
    val parsed = reps.mapNotNull { rep -> parsePaceSecPerKm(rep.actualIntensity)?.let { rep to it } }
    if (reps.size <= repeatCount) return parsed
    val rangeWidth = (targetMaxSec - targetMinSec).coerceAtLeast(10)
    val cutoffSec = targetMaxSec + 3 * rangeWidth
    return parsed.filter { (_, pace) -> pace <= cutoffSec }
}

/** Coefficient de variation de l'allure, borné [0,100] — indicatif, pas une mesure scientifique absolue. */
fun computeRegularityPercent(paces: List<Int>): Int? {
    if (paces.size < 2) return null
    val mean = paces.average()
    if (mean <= 0.0) return null
    val variance = paces.sumOf { (it - mean) * (it - mean) } / paces.size
    val stddev = sqrt(variance)
    val coefficientOfVariation = stddev / mean
    return (100 * (1 - coefficientOfVariation)).coerceIn(0.0, 100.0).toInt()
}

/**
 * Analyse d'intervalles pour le bloc le plus pertinent (le premier ayant une cible d'allure PACE
 * exploitable). Retourne null si aucune cible d'allure n'est disponible ou si aucun effort n'a pu
 * être extrait — l'appelant doit alors retomber sur une analyse basique, jamais afficher de données
 * inventées.
 */
fun computeIntervalAnalysis(repeatBlocks: List<RunRepeatExecution>): IntervalAnalysis? {
    val block = repeatBlocks.firstOrNull {
        it.targetStep?.targetType == RunTargetType.PACE &&
            it.targetStep.targetMin != null && it.targetStep.targetMax != null
    } ?: return null

    val targetMinSec = block.targetStep!!.targetMin!!
    val targetMaxSec = block.targetStep.targetMax!!

    val efforts = extractWorkEfforts(block.reps, block.repeat.repeatCount, targetMinSec, targetMaxSec)
    if (efforts.isEmpty()) return null

    val workEfforts = efforts.mapIndexed { index, (_, pace) ->
        WorkEffort(
            displayNumber = index + 1,
            paceSecPerKm = pace,
            classification = classifyPace(pace, targetMinSec, targetMaxSec),
        )
    }
    val best = workEfforts.minByOrNull { it.paceSecPerKm }

    return IntervalAnalysis(
        targetMinSec = targetMinSec,
        targetMaxSec = targetMaxSec,
        efforts = workEfforts,
        regularityPercent = computeRegularityPercent(workEfforts.map { it.paceSecPerKm }),
        bestEffort = best,
    )
}

fun formatPaceSecPerKm(sec: Int): String = "${sec / 60}:${(sec % 60).toString().padStart(2, '0')}"
