package com.pandafit.core.database.model

import kotlinx.serialization.Serializable

/**
 * Résultat d'une répétition d'intervalle.
 * Sérialisé en JSON et stocké dans [RunRepeatEntity.resultsJson].
 * Utilisé aussi bien pour les séances exécutées manuellement que pour
 * les splits importés depuis un fichier TCX Garmin.
 */
@Serializable
data class IntervalRepResult(
    val repNumber: Int,
    val timeStr: String = "",
    /** Allure réelle, FC, cadence — selon le targetType du step. */
    val actualIntensity: String = "",
    val rpeStr: String = "",
    val done: Boolean = false,
    /** FC moyenne sur l'intervalle (rempli à l'import TCX). */
    val hrAvg: Int? = null,
    /** FC max sur l'intervalle (rempli à l'import TCX). */
    val hrMax: Int? = null,
)
