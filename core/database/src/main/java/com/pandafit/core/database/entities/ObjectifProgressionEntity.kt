package com.pandafit.core.database.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import java.time.LocalDate

// Objectif courant (cible évolutive) d'un exercice au sein d'une séance type.
// Clé (seance_id, exercise_id) : stable entre le template et toutes ses copies d'instance,
// ce qui permet la propagation automatique aux instances futures sans code dédié.
@Entity(
    tableName = "objectifs_progression",
    foreignKeys = [
        ForeignKey(
            entity = SeanceEntity::class,
            parentColumns = ["id"],
            childColumns = ["seance_id"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = ExerciseEntity::class,
            parentColumns = ["id"],
            childColumns = ["exercise_id"],
            onDelete = ForeignKey.RESTRICT,
        ),
    ],
    indices = [
        Index(value = ["seance_id", "exercise_id"], unique = true),
        Index("exercise_id"),
    ],
)
data class ObjectifProgressionEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "seance_id")
    val seanceId: Long,

    @ColumnInfo(name = "exercise_id")
    val exerciceId: Long,

    @ColumnInfo(name = "charge_cible")
    val chargeCible: Float? = null,

    @ColumnInfo(name = "reps_cible")
    val repsCible: Int? = null,

    @ColumnInfo(name = "duree_cible_sec")
    val dureeCibleSec: Int? = null,

    @ColumnInfo(name = "compteur_echec")
    val compteurEchec: Int = 0,

    @ColumnInfo(name = "derniere_maj")
    val derniereMaj: LocalDate? = null,
)
