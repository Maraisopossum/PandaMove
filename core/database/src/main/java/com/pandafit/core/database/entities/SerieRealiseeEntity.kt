package com.pandafit.core.database.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "series_realisees",
    foreignKeys = [
        ForeignKey(
            entity = InstanceSeanceEntity::class,
            parentColumns = ["id"],
            childColumns = ["instance_seance_id"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = ExerciceSeanceEntity::class,
            parentColumns = ["id"],
            childColumns = ["exercice_seance_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("instance_seance_id"), Index("exercice_seance_id")],
)
data class SerieRealiseeEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "instance_seance_id")
    val instanceSeanceId: Long,

    @ColumnInfo(name = "exercice_seance_id")
    val exerciceSeanceId: Long,

    @ColumnInfo(name = "numero_serie")
    val numeroSerie: Int,

    @ColumnInfo(name = "reps_realisees")
    val repsRealisees: Int? = null,

    // Valeur numérique en kg (null si PDC ou Élastique)
    @ColumnInfo(name = "charge_kg")
    val chargeKg: Float? = null,

    // Label affiché : "PDC", "Élastique", "12 kg", "11.25 kg"
    @ColumnInfo(name = "charge_label")
    val chargeLabel: String? = null,

    val rpe: Float? = null,

    val notes: String = "",

    @ColumnInfo(name = "is_completed")
    val isCompleted: Boolean = false,
)
