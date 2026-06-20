package com.pandafit.core.database.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Un point GPS simplifié (Douglas-Peucker appliqué à l'import TCX).
 * Rattaché à un workout via workout_id (ON DELETE CASCADE).
 * L'ordre de tracé est donné par [pointIndex].
 */
@Entity(
    tableName = "gps_track_points",
    foreignKeys = [
        ForeignKey(
            entity = WorkoutEntity::class,
            parentColumns = ["id"],
            childColumns = ["workout_id"],
            onDelete = ForeignKey.CASCADE,
        )
    ],
    indices = [Index("workout_id")]
)
data class GpsTrackPointEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "workout_id")
    val workoutId: Long,

    /** Position dans le tracé (0-based, croissant). */
    @ColumnInfo(name = "point_index")
    val pointIndex: Int,

    val latitude: Double,
    val longitude: Double,

    /** Altitude en mètres (null si non disponible). */
    @ColumnInfo(name = "altitude_m")
    val altitudeM: Double? = null,

    /** Horodatage Unix en millisecondes (0 pour les points importés via TCX). */
    @ColumnInfo(name = "timestamp_ms")
    val timestampMs: Long = 0L,

    /** Vitesse en m/s fournie par FusedLocation (null pour les imports TCX). */
    @ColumnInfo(name = "speed_mps")
    val speedMps: Float? = null,

    /** Précision horizontale en mètres (null pour les imports TCX). */
    @ColumnInfo(name = "accuracy_m")
    val accuracyM: Float? = null,
)
