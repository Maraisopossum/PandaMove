package com.pandafit.core.database.relations

import androidx.room.Embedded
import androidx.room.Relation
import com.pandafit.core.database.entities.WorkoutBlockEntity
import com.pandafit.core.database.entities.WorkoutEntity

data class WorkoutWithBlocks(
    @Embedded val workout: WorkoutEntity,
    @Relation(
        parentColumn = "id",
        entityColumn = "workout_id",
    )
    val blocks: List<WorkoutBlockEntity>,
)
