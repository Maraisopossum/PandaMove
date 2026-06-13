package com.pandafit.feature.breathing.method

import com.pandafit.core.database.entities.CustomBreathingMethodEntity
import com.pandafit.feature.breathing.engine.BreathingConfig

/**
 * Méthode respiratoire avec sa description et son icône emoji.
 *
 * [isCustom] distingue les méthodes intégrées (non modifiables) des méthodes
 * créées par l'utilisateur et stockées en base de données.
 * [customId] correspond à [CustomBreathingMethodEntity.id] pour les méthodes custom.
 */
data class BreathingMethod(
    val id: String,
    val name: String,
    val description: String,
    val emoji: String,
    val config: BreathingConfig,
    val isCustom: Boolean = false,
    val customId: Long? = null,
)

/** Convertit une entité Room en [BreathingMethod]. */
fun CustomBreathingMethodEntity.toBreathingMethod(): BreathingMethod {
    val inhaleMs   = inhaleSeconds.toLong()  * 1_000L
    val holdInMs   = holdInSeconds.toLong()  * 1_000L
    val exhaleMs   = exhaleSeconds.toLong()  * 1_000L
    val holdOutMs  = holdOutSeconds.toLong() * 1_000L

    // Description auto-générée : "4s · 7s · 8s — 4 cycles"
    val phases = buildList {
        add("${inhaleSeconds}s")
        if (holdInSeconds > 0)  add("${holdInSeconds}s")
        add("${exhaleSeconds}s")
        if (holdOutSeconds > 0) add("${holdOutSeconds}s")
    }
    val description = "${phases.joinToString(" · ")} — $defaultCycles cycles"

    return BreathingMethod(
        id          = "custom_$id",
        name        = name,
        description = description,
        emoji       = emoji,
        config      = BreathingConfig(
            methodName  = name,
            inhaleMs    = inhaleMs,
            holdInMs    = if (holdInSeconds > 0) holdInMs else 0L,
            exhaleMs    = exhaleMs,
            holdOutMs   = if (holdOutSeconds > 0) holdOutMs else 0L,
            cycles      = defaultCycles,
        ),
        isCustom    = true,
        customId    = id,
    )
}

/**
 * Catalogue des méthodes disponibles.
 *
 * Durées en millisecondes, cycles par défaut conformes aux recommandations de chaque méthode.
 */
object BreathingMethodRegistry {

    val coherenceCardiaque = BreathingMethod(
        id = "coherence_cardiaque",
        name = "Cohérence cardiaque",
        emoji = "💚",
        description = "5 secondes d'inspiration, 5 secondes d'expiration. 6 cycles/min pendant 5 minutes.",
        config = BreathingConfig(
            methodName = "Cohérence cardiaque",
            inhaleMs = 5_000L,
            exhaleMs = 5_000L,
            cycles = 30,  // 5 minutes = 30 cycles de 10 s
        ),
    )

    val breathing478 = BreathingMethod(
        id = "4_7_8",
        name = "4-7-8",
        emoji = "🌙",
        description = "Inspire 4s, retiens 7s, expire 8s. Favorise la relaxation profonde.",
        config = BreathingConfig(
            methodName = "4-7-8",
            inhaleMs = 4_000L,
            holdInMs = 7_000L,
            exhaleMs = 8_000L,
            cycles = 4,
        ),
    )

    val boxBreathing = BreathingMethod(
        id = "box_breathing",
        name = "Respiration en boîte",
        emoji = "⬛",
        description = "4 phases égales de 4 secondes. Utilisée par les Navy SEALs pour garder le calme.",
        config = BreathingConfig(
            methodName = "Respiration en boîte",
            inhaleMs = 4_000L,
            holdInMs = 4_000L,
            exhaleMs = 4_000L,
            holdOutMs = 4_000L,
            cycles = 6,
        ),
    )

    val wimHof = BreathingMethod(
        id = "wim_hof",
        name = "Wim Hof",
        emoji = "❄️",
        description = "30 inspirations rapides puis rétention poumons vides. Énergie et concentration.",
        config = BreathingConfig(
            methodName = "Wim Hof",
            inhaleMs = 1_500L,
            exhaleMs = 1_500L,
            holdOutMs = 15_000L,
            cycles = 30,
        ),
    )

    val all: List<BreathingMethod> = listOf(
        coherenceCardiaque,
        breathing478,
        boxBreathing,
        wimHof,
    )

    fun findById(id: String): BreathingMethod? = all.firstOrNull { it.id == id }
}
