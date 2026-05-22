package com.pandafit.core.database.relations

import androidx.room.Embedded
import androidx.room.Relation
import com.pandafit.core.database.entities.ExerciseEntity
import com.pandafit.core.database.entities.ExerciseSetEntity
import com.pandafit.core.database.entities.WorkoutExerciseEntity

data class WorkoutExerciseWithSets(
    @Embedded val workoutExercise: WorkoutExerciseEntity,
    @Relation(
        parentColumn = "id",
        entityColumn = "workout_exercise_id",
    )
    val sets: List<ExerciseSetEntity>,
    @Relation(
        parentColumn = "exercise_id",
        entityColumn = "id",
    )
    val exercise: ExerciseEntity,
)
