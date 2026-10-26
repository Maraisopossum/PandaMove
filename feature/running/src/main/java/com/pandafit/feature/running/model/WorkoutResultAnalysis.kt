package com.pandafit.feature.running.model

import com.pandafit.core.database.entities.RunTargetType

/**
 * Vrai si la séance contient de vrais intervalles structurés (une cible d'allure/FC/cadence définie
 * sur au moins une étape course d'un bloc), et pas seulement des splits kilométriques auto-générés
 * par l'import TCX (qui produisent aussi un [RunRepeatEntity] mais sans cible associée).
 */
fun hasRealIntervals(repeatBlocks: List<RunRepeatExecution>): Boolean =
    repeatBlocks.any { it.targetStep?.targetType != null && it.targetStep.targetType != RunTargetType.NONE }
