package com.pandafit.core.database.tcx

import com.pandafit.core.database.entities.WorkoutType

/**
 * Représentation intermédiaire d'une activité TCX après parsing SAX,
 * avant toute écriture en base.
 */
data class TcxParsedActivity(
    /** Valeur brute du champ Sport dans le TCX ("Running", "Biking", etc.) */
    val sportRaw: String,
    /** Type mappé pour WorkoutEntity. */
    val workoutType: WorkoutType,
    /** Date-heure ISO-8601 du début d'activité. */
    val startTime: String,
    val totalDistanceM: Double,
    val totalDurationSec: Double,
    val totalCalories: Int,
    val avgHrBpm: Int?,
    val maxHrBpm: Int?,
    /** Vitesse maximale en m/s issue du meilleur lap (null si absent). */
    val maxSpeedMs: Double?,
    /** Cadence moyenne en rpm agrégée sur les laps (null si absent). */
    val avgCadenceRpm: Int?,
    /** Dénivelé positif cumulé calculé depuis l'altitude des trackpoints (null si absent). */
    val elevationGainM: Int?,
    /** Splits Garmin — un par km par défaut. */
    val laps: List<TcxLap>,
    /** Points GPS bruts avant simplification Douglas-Peucker. */
    val rawTrackPoints: List<TcxRawPoint>,
)

data class TcxLap(
    val durationSec: Double,
    val distanceM: Double,
    val avgHrBpm: Int?,
    val maxHrBpm: Int?,
    val calories: Int,
    /** Vitesse maximale du lap en m/s (champ MaximumSpeed du TCX). */
    val maxSpeedMs: Double? = null,
    /** Cadence moyenne du lap en rpm (champ Cadence ou AverageCadence du TCX). */
    val avgCadenceRpm: Int? = null,
)

data class TcxRawPoint(
    val latitude: Double,
    val longitude: Double,
    val altitudeM: Double?,
)
