package com.pandafit.core.database.catalog

import kotlinx.serialization.Serializable

// Plafond défensif sur le nombre de paires par denomination, contre une saisie aberrante
// (ex: 500 disques) qui ferait exploser la combinatoire de chargesAtteignables().
private const val MAX_PAIRES_PAR_DENOMINATION = 30

/**
 * Barre/poignée + disques disponibles (bible §4.3). `disques` : poids unitaire d'un disque (kg) →
 * quantité totale possédée (les paires = quantité / 2, un disque par côté).
 */
@Serializable
data class DisquesConfig(val barreKg: Float, val disques: Map<Float, Int> = emptyMap())

/** Matériel modulable à crans (kettlebell ajustable, poulie/câble) — bible §4.3. */
@Serializable
data class PlageConfig(val minKg: Float, val maxKg: Float, val pasKg: Float)

/** Haltères : poids fixes possédés et/ou haltères chargeables (poignée + disques dédiés). */
@Serializable
data class HalteresConfig(val poidsFixes: List<Float> = emptyList(), val chargeable: DisquesConfig? = null)

data class EquipmentInventaire(
    val halteres: HalteresConfig = HalteresConfig(),
    val barre: DisquesConfig? = null,
    val kettlebell: PlageConfig? = null,
    val cable: PlageConfig? = null,
)

/** Combinatoire des charges totales réellement composables (bible §4.3 `arrondir_a_charge_realisable`). */
fun DisquesConfig.chargesAtteignables(): List<Float> {
    var sommes = setOf(0f)
    disques.forEach { (poidsUnitaire, quantite) ->
        val maxPaires = (quantite / 2).coerceIn(0, MAX_PAIRES_PAR_DENOMINATION)
        if (maxPaires <= 0) return@forEach
        val nouvelles = mutableSetOf<Float>()
        sommes.forEach { somme ->
            for (n in 0..maxPaires) nouvelles += somme + n * 2 * poidsUnitaire
        }
        sommes = nouvelles
    }
    return sommes.map { barreKg + it }.sorted()
}

/** Séquence arithmétique min→max par pas de pasKg — maxKg toujours inclus. */
fun PlageConfig.chargesAtteignables(): List<Float> {
    if (pasKg <= 0f || maxKg <= minKg) return listOf(minKg)
    val paliers = generateSequence(minKg) { it + pasKg }.takeWhile { it < maxKg }.toList()
    return (paliers + maxKg).distinct().sorted()
}

/** Union des poids fixes et des combinaisons chargeables, dédupliquée. */
fun HalteresConfig.chargesAtteignables(): List<Float> =
    (poidsFixes + (chargeable?.chargesAtteignables() ?: emptyList())).distinct().sorted()

/** `null` pour les catégories sans inventaire structuré (gérées par le pas simple, ex. MACHINE). */
fun EquipmentInventaire.chargesAtteignablesPour(category: EquipmentCategory): List<Float>? = when (category) {
    EquipmentCategory.HALTERES -> halteres.chargesAtteignables().ifEmpty { null }
    EquipmentCategory.BARRE -> barre?.chargesAtteignables()
    EquipmentCategory.KETTLEBELL -> kettlebell?.chargesAtteignables()
    EquipmentCategory.CABLE -> cable?.chargesAtteignables()
    else -> null
}
