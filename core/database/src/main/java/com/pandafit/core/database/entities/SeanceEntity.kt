package com.pandafit.core.database.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import java.time.LocalDateTime

@Entity(
    tableName = "seances",
    indices = [Index("updated_at")],
)
data class SeanceEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    val nom: String,

    @ColumnInfo(name = "groupes_musculaires")
    val groupesMusculaires: List<String> = emptyList(),

    @ColumnInfo(name = "duree_estimee_min")
    val dureeEstimeeMin: Int = 60,

    val notes: String = "",

    @ColumnInfo(name = "seance_category")
    val seanceCategory: SeanceCategory = SeanceCategory.STRENGTH,

    @ColumnInfo(name = "created_at")
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @ColumnInfo(name = "updated_at")
    val updatedAt: LocalDateTime = LocalDateTime.now(),

    // Masquée de la liste "Séances types" mais conservée en base : supprimer le template
    // ne doit jamais effacer l'historique des instances déjà réalisées (cascade FK).
    @ColumnInfo(name = "is_archived")
    val isArchived: Boolean = false,
)
