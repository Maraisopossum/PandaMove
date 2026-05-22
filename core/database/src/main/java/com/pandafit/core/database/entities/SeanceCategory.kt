package com.pandafit.core.database.entities
enum class SeanceCategory {
    STRENGTH,
    WARMUP_GENERAL, WARMUP_MOBILITY, WARMUP_ACTIVATION,
    /** Séance planifiée directe — pas de template, suppression de la SeanceEntity quand l'instance est supprimée. */
    STRENGTH_ONESHOT,
}
