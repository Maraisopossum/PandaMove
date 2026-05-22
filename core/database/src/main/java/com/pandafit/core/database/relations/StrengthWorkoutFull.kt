package com.pandafit.core.database.relations

import androidx.room.Embedded
import androidx.room.Relation
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutExerciseEntity

data class StrengthWorkoutFull(
    @Embedded val workout: WorkoutEntity,
    @Relation(
        entity = WorkoutExerciseEntity::class,
        parentColumn = "id",
        entityColumn = "workout_id",
    )
    val exercises: List<WorkoutExerciseWithSets>,
)
