package com.pandafit.core.database.relations

import androidx.room.Embedded
import androidx.room.Relation
import com.pandafit.core.database.entities.BlocSeanceEntity
import com.pandafit.core.database.entities.ExerciceSeanceEntity
import com.pandafit.core.database.entities.SeanceEntity

data class SeanceFull(
    @Embedded val seance: SeanceEntity,

    @Relation(
        parentColumn = "id",
        entityColumn = "seance_id",
    )
    val blocs: List<BlocSeanceEntity>,

    @Relation(
        parentColumn = "id",
        entityColumn = "seance_id",
        entity = ExerciceSeanceEntity::class,
    )
    val exercices: List<ExerciceSeanceWithExercise>,
)
