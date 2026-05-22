package com.pandafit.core.database.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "exercices_seance",
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
        ForeignKey(
            entity = BlocSeanceEntity::class,
            parentColumns = ["id"],
            childColumns = ["bloc_id"],
            onDelete = ForeignKey.SET_NULL,
        ),
    ],
    indices = [Index("seance_id"), Index("exercise_id"), Index("bloc_id"), Index("instance_seance_id")],
)
data class ExerciceSeanceEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "seance_id")
    val seanceId: Long,

    @ColumnInfo(name = "exercise_id")
    val exerciceId: Long,

    @ColumnInfo(name = "bloc_id")
    val blocId: Long? = null,

    // Identifiant superset : "SS1A", "SS1B", "SS2" etc.
    @ColumnInfo(name = "superset_groupe")
    val supersetGroupe: String? = null,

    val position: Int = 0,

    @ColumnInfo(name = "nombre_series_prevues")
    val nombreSeriesPrevues: Int = 3,

    // Texte libre : "10", "15-20", "10/jambe"
    @ColumnInfo(name = "reps_cibles")
    val repsCibles: String = "",

    // Texte libre : "12-16 kg", "Poids corps"
    @ColumnInfo(name = "charge_cible")
    val chargeCible: String = "",

    // Ex. "3-1-1", "4-0-X", "Lent"
    val tempo: String = "",

    @ColumnInfo(name = "reps_type")
    val repsType: RepsType = RepsType.REPS,

    @ColumnInfo(name = "temps_repos_sec")
    val tempsReposSec: Int = 90,

    @ColumnInfo(name = "consigne_cle")
    val consigneCle: String = "",

    val equipement: String = "",

    val avertissement: String = "",

    // Non-null uniquement pour les copies d'instance (null = exercice du template)
    @ColumnInfo(name = "instance_seance_id")
    val instanceSeanceId: Long? = null,
)
