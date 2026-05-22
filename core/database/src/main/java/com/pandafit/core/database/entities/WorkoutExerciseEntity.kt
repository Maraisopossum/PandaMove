package com.pandafit.core.database.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Jointure entre un workout (séance de renforcement) et un exercice.
 * Contient les paramètres de l'exercice pour cette séance spécifique.
 */
@Entity(
    tableName = "workout_exercises",
    foreignKeys = [
        ForeignKey(
            entity = WorkoutEntity::class,
            parentColumns = ["id"],
            childColumns = ["workout_id"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = ExerciseEntity::class,
            parentColumns = ["id"],
            childColumns = ["exercise_id"],
            onDelete = ForeignKey.RESTRICT,
        ),
    ],
    indices = [Index("workout_id"), Index("exercise_id")]
)
data class WorkoutExerciseEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "workout_id")
    val workoutId: Long,

    @ColumnInfo(name = "exercise_id")
    val exerciseId: Long,

    val position: Int,

    @ColumnInfo(name = "exercise_type")
    val exerciseType: WorkoutExerciseType = WorkoutExerciseType.STANDARD,

    @ColumnInfo(name = "superset_group")
    val supersetGroup: Int? = null,

    @ColumnInfo(name = "rest_between_sets_seconds")
    val restBetweenSetsSeconds: Int = 90,

    @ColumnInfo(name = "rest_after_exercise_seconds")
    val restAfterExerciseSeconds: Int = 120,

    val notes: String = "",
)

enum class WorkoutExerciseType {
    STANDARD, SUPERSET, CIRCUIT
}
