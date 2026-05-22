package com.pandafit.core.database.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "exercise_sets",
    foreignKeys = [
        ForeignKey(
            entity = WorkoutExerciseEntity::class,
            parentColumns = ["id"],
            childColumns = ["workout_exercise_id"],
            onDelete = ForeignKey.CASCADE,
        )
    ],
    indices = [Index("workout_exercise_id")]
)
data class ExerciseSetEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "workout_exercise_id")
    val workoutExerciseId: Long,

    @ColumnInfo(name = "set_number")
    val setNumber: Int,

    // Cibles
    @ColumnInfo(name = "target_reps")
    val targetReps: Int? = null,

    @ColumnInfo(name = "target_weight_kg")
    val targetWeightKg: Double? = null,

    @ColumnInfo(name = "target_duration_seconds")
    val targetDurationSeconds: Int? = null,

    @ColumnInfo(name = "target_rpe")
    val targetRpe: Int? = null,

    // Réalisé
    @ColumnInfo(name = "actual_reps")
    val actualReps: Int? = null,

    @ColumnInfo(name = "actual_weight_kg")
    val actualWeightKg: Double? = null,

    @ColumnInfo(name = "actual_duration_seconds")
    val actualDurationSeconds: Int? = null,

    @ColumnInfo(name = "actual_rpe")
    val actualRpe: Int? = null,

    @ColumnInfo(name = "is_completed")
    val isCompleted: Boolean = false,

    @ColumnInfo(name = "set_type")
    val setType: SetType = SetType.WORKING,
)

enum class SetType {
    WARMUP, WORKING, DROP, FAILURE
}
