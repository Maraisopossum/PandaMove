package com.pandafit.core.database.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "blocs_seance",
    foreignKeys = [
        ForeignKey(
            entity = SeanceEntity::class,
            parentColumns = ["id"],
            childColumns = ["seance_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("seance_id"), Index("instance_seance_id")],
)
data class BlocSeanceEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "seance_id")
    val seanceId: Long,

    val nom: String,

    val type: BlocType = BlocType.ECHAUFFEMENT,

    val position: Int = 0,

    @ColumnInfo(name = "duree_min")
    val dureeMin: Int? = null,

    val description: String = "",

    // Repos entre exercices au sein du superset/circuit
    @ColumnInfo(name = "temps_repos_inter_sec")
    val tempsReposInterSec: Int = 20,

    // Repos après un round complet du superset/circuit
    @ColumnInfo(name = "temps_repos_fin_round_sec")
    val tempsReposFinRoundSec: Int = 120,

    // Non-null uniquement pour les copies d'instance (null = bloc du template)
    @ColumnInfo(name = "instance_seance_id")
    val instanceSeanceId: Long? = null,
)

enum class BlocType { ECHAUFFEMENT, SUPERSET, CIRCUIT, RECUPERATION }
