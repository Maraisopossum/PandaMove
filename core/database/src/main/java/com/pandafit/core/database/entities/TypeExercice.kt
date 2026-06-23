package com.pandafit.core.database.entities

/** Type d'exercice — détermine le pourcentage cible par défaut de l'incrément (bible §4.1). */
enum class TypeExercice(val pourcentageCibleDefault: Float) {
    COMPOSE_BAS(0.05f),
    COMPOSE_HAUT(0.025f),
    ISOLATION(0.02f),
    MACHINE(0f),
    PDC(0f),
}
