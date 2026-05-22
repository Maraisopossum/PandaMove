package com.pandafit.core.database.relations

import androidx.room.Embedded
import androidx.room.Relation
import com.pandafit.core.database.entities.InstanceSeanceEntity
import com.pandafit.core.database.entities.SerieRealiseeEntity

data class InstanceWithSeries(
    @Embedded val instance: InstanceSeanceEntity,
    @Relation(
        parentColumn = "id",
        entityColumn = "instance_seance_id",
    )
    val series: List<SerieRealiseeEntity>,
)
