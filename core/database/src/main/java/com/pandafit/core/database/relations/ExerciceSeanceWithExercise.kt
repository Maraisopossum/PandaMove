package com.pandafit.core.database.relations

import androidx.room.Embedded
import androidx.room.Relation
import com.pandafit.core.database.entities.ExerciceSeanceEntity
import com.pandafit.core.database.entities.ExerciseEntity

data class ExerciceSeanceWithExercise(
    @Embedded val exerciceSeance: ExerciceSeanceEntity,
    @Relation(
        parentColumn = "exercise_id",
        entityColumn = "id",
    )
    val exercise: ExerciseEntity,
)
