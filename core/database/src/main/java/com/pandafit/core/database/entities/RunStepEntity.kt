package com.pandafit.core.database.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

enum class RunStepType   { WARMUP, RUNNING, WALKING, RECOVERY, REST, OTHER }
enum class RunEndType    { DURATION, DISTANCE }
enum class RunEndUnit    { SECONDS, METERS, KM }
enum class RunTargetType { NONE, PACE, CADENCE, HR_ZONE, HR_CUSTOM }

@Entity(
    tableName = "run_steps",
    foreignKeys = [
        ForeignKey(
            entity = WorkoutEntity::class,
            parentColumns = ["id"],
            childColumns = ["workout_id"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = RunRepeatEntity::class,
            parentColumns = ["id"],
            childColumns = ["repeat_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("workout_id"), Index("repeat_id")]
)
data class RunStepEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "workout_id")
    val workoutId: Long,

    @ColumnInfo(name = "repeat_id")
    val repeatId: Long? = null,

    val position: Int,

    @ColumnInfo(name = "step_type")
    val stepType: RunStepType,

    @ColumnInfo(name = "end_type")
    val endType: RunEndType,

    // secondes quand DURATION ; valeur brute (m ou km entier) quand DISTANCE
    @ColumnInfo(name = "end_value")
    val endValue: Int,

    @ColumnInfo(name = "end_unit")
    val endUnit: RunEndUnit,

    val note: String? = null,

    @ColumnInfo(name = "target_type")
    val targetType: RunTargetType,

    // PACE=sec/km, CADENCE=spm, HR_ZONE=1-5, HR_CUSTOM=bpm
    @ColumnInfo(name = "target_min")
    val targetMin: Int? = null,

    @ColumnInfo(name = "target_max")
    val targetMax: Int? = null,

    @ColumnInfo(name = "results_json")
    val resultsJson: String = "",
)
