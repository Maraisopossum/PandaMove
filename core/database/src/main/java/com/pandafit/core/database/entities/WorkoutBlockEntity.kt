package com.pandafit.core.database.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "workout_blocks",
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
data class WorkoutBlockEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "workout_id")
    val workoutId: Long,

    @ColumnInfo(name = "block_type")
    val blockType: BlockType,

    val name: String,

    val position: Int,

    @ColumnInfo(name = "duration_minutes")
    val durationMinutes: Int? = null,

    @ColumnInfo(name = "distance_km")
    val distanceKm: Double? = null,

    @ColumnInfo(name = "target_pace_min_per_km")
    val targetPaceMinPerKm: Double? = null,

    @ColumnInfo(name = "target_power_watts")
    val targetPowerWatts: Int? = null,

    @ColumnInfo(name = "target_cadence_rpm")
    val targetCadenceRpm: Int? = null,

    @ColumnInfo(name = "target_heart_rate_bpm")
    val targetHeartRateBpm: Int? = null,

    @ColumnInfo(name = "rpe_target")
    val rpeTarget: Int? = null,

    @ColumnInfo(name = "recovery_minutes")
    val recoveryMinutes: Int? = null,

    // Répétitions pour fractionné (ex: 5 x 1000m)
    val repetitions: Int? = null,

    // Réalisé lors de l'exécution
    @ColumnInfo(name = "actual_pace_min_per_km")
    val actualPaceMinPerKm: Double? = null,

    @ColumnInfo(name = "actual_distance_km")
    val actualDistanceKm: Double? = null,

    @ColumnInfo(name = "actual_duration_minutes")
    val actualDurationMinutes: Int? = null,

    @ColumnInfo(name = "actual_heart_rate_bpm")
    val actualHeartRateBpm: Int? = null,

    @ColumnInfo(name = "actual_power_watts")
    val actualPowerWatts: Int? = null,

    @ColumnInfo(name = "actual_rpe")
    val actualRpe: Int? = null,

    @ColumnInfo(name = "is_success")
    val isSuccess: Boolean? = null,

    val notes: String = "",

    @ColumnInfo(name = "target_pace_max_min_per_km")
    val targetPaceMaxMinPerKm: Double? = null,

    @ColumnInfo(name = "target_hr_min")
    val targetHrMin: Int? = null,

    @ColumnInfo(name = "target_hr_max")
    val targetHrMax: Int? = null,

    @ColumnInfo(name = "target_type")
    val targetType: String = "none",

    @ColumnInfo(name = "distance_m")
    val distanceM: Int? = null,

    @ColumnInfo(name = "distance_unit")
    val distanceUnit: String = "km",

    @ColumnInfo(name = "duration_unit")
    val durationUnit: String = "min",

    @ColumnInfo(name = "recovery_distance_m")
    val recoveryDistanceM: Int? = null,

    @ColumnInfo(name = "recovery_duration_sec")
    val recoveryDurationSec: Int? = null,

    @ColumnInfo(name = "interval_rep_results_json")
    val intervalRepResultsJson: String = "",
)

enum class BlockType {
    WARMUP,
    MAIN,
    INTERVAL,
    COOLDOWN,
    CUSTOM,
}
