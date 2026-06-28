package com.pandafit.core.database.progression

import com.pandafit.core.database.entities.TypeExercice

enum class WarmupProtocole(val templates: List<WarmupPalierTemplate>) {
    DEBUTANT(listOf(
        WarmupPalierTemplate(pct = 0.50f, reps = 8,  reposSec = 60),
        WarmupPalierTemplate(pct = 0.70f, reps = 5,  reposSec = 60),
    )),
    STANDARD(listOf(
        WarmupPalierTemplate(pct = 0.40f, reps = 10, reposSec = 60),
        WarmupPalierTemplate(pct = 0.60f, reps = 5,  reposSec = 75),
        WarmupPalierTemplate(pct = 0.80f, reps = 3,  reposSec = 90),
    )),
    LOURD(listOf(
        WarmupPalierTemplate(pct = 0.40f, reps = 5,  reposSec = 60),
        WarmupPalierTemplate(pct = 0.55f, reps = 4,  reposSec = 75),
        WarmupPalierTemplate(pct = 0.70f, reps = 3,  reposSec = 90),
        WarmupPalierTemplate(pct = 0.83f, reps = 2,  reposSec = 90),
        WarmupPalierTemplate(pct = 0.92f, reps = 1,  reposSec = 120),
    )),
}

data class WarmupPalierTemplate(val pct: Float, val reps: Int, val reposSec: Int)

data class WarmupPalier(
    val chargeKg: Float,
    val chargeLabel: String,
    val reps: Int,
    val reposSec: Int,
    val isDone: Boolean = false,
)

// COMPOSE_BAS → LOURD, COMPOSE_HAUT → STANDARD, autres → DEBUTANT, null → null (pas de suggestion)
fun protocoleDefaut(typeExercice: TypeExercice?): WarmupProtocole? = when (typeExercice) {
    TypeExercice.COMPOSE_BAS  -> WarmupProtocole.LOURD
    TypeExercice.COMPOSE_HAUT -> WarmupProtocole.STANDARD
    TypeExercice.ISOLATION,
    TypeExercice.MACHINE,
    TypeExercice.PDC          -> WarmupProtocole.DEBUTANT
    null                      -> null
}

fun calculerPaliers(
    chargeObjectifKg: Float,
    protocole: WarmupProtocole,
    chargesAtteignables: List<Float>,
): List<WarmupPalier> = protocole.templates.map { template ->
    val cible = chargeObjectifKg * template.pct
    val charge = if (chargesAtteignables.isNotEmpty()) {
        chargesAtteignables.minByOrNull { kotlin.math.abs(it - cible) } ?: cible
    } else {
        // Arrondi au 0.5 kg le plus proche
        (kotlin.math.round(cible * 2) / 2.0).toFloat()
    }
    WarmupPalier(
        chargeKg = charge,
        chargeLabel = charge.toWarmupLabel(),
        reps = template.reps,
        reposSec = template.reposSec,
    )
}

private fun Float.toWarmupLabel(): String = when {
    this <= 0f -> "PDC"
    this == this.toLong().toFloat() -> "${this.toInt()} kg"
    else -> "$this kg"
}
