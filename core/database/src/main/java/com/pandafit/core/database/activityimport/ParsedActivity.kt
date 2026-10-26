package com.pandafit.core.database.activityimport

import com.pandafit.core.database.entities.WorkoutType

/** Format source d'un fichier d'activité importé. */
enum class ActivityFileFormat { TCX, GPX, FIT }

/**
 * Représentation intermédiaire d'une activité (TCX, GPX ou FIT) après parsing,
 * avant toute écriture en base.
 *
 * Disponibilité des champs selon [sourceFormat] :
 * - **TCX** : tout disponible (calories, HR, cadence, vitesse max, laps Garmin).
 * - **GPX** : distance/durée/dénivelé recalculés depuis les trackpoints (Haversine + timestamps) ;
 *   HR/cadence uniquement si l'extension `gpxtpx:TrackPointExtension` est présente ; calories
 *   toujours 0 ; `laps` toujours vide (pas de notion de lap en GPX standard).
 * - **FIT** : quasi tout nativement via les messages SessionMesg/LapMesg/RecordMesg du SDK Garmin.
 */
data class ParsedActivity(
    /** Format source du fichier importé. */
    val sourceFormat: ActivityFileFormat,
    /** Valeur brute du champ sport détecté dans le fichier ("Running", "Biking", etc.) */
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
    /** Splits — un par km par défaut (toujours vide pour le GPX). */
    val laps: List<ParsedLap>,
    /** Points GPS bruts avant simplification Douglas-Peucker. */
    val rawTrackPoints: List<ParsedTrackPoint>,
)

data class ParsedLap(
    val durationSec: Double,
    val distanceM: Double,
    val avgHrBpm: Int?,
    val maxHrBpm: Int?,
    val calories: Int,
    /** Vitesse maximale du lap en m/s. */
    val maxSpeedMs: Double? = null,
    /** Cadence moyenne du lap en rpm. */
    val avgCadenceRpm: Int? = null,
)

data class ParsedTrackPoint(
    val latitude: Double,
    val longitude: Double,
    val altitudeM: Double?,
    /** Epoch millis du timestamp du trackpoint (null si absent/invalide). */
    val timestampMs: Long? = null,
    /** Vitesse instantanée en m/s (absente de certains exports). */
    val speedMs: Double? = null,
)
