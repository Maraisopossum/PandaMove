package com.pandafit.core.database.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "exercises",
    indices = [
        Index("name"),
        Index("category"),
        Index("is_favorite"),
    ]
)
data class ExerciseEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    val name: String,

    val category: ExerciseCategory,

    @ColumnInfo(name = "muscle_groups")
    val muscleGroups: List<String> = emptyList(),

    val description: String = "",

    @ColumnInfo(name = "is_favorite")
    val isFavorite: Boolean = false,

    @ColumnInfo(name = "is_custom")
    val isCustom: Boolean = true,

    @ColumnInfo(name = "image_url")
    val imageUrl: String? = null,

    // Champs catalogue musculation
    @ColumnInfo(name = "exercise_type")
    val exerciseType: String = "",   // "Mono" | "Pluri" | ""

    @ColumnInfo(name = "equipment")
    val equipment: List<String> = emptyList(),

    @ColumnInfo(name = "muscle_primary")
    val musclePrimary: String = "",  // Muscle 1 (pour filtrage/couleur rapide)
)

/** Muscle principal fiable : muscleGroups[0] si disponible, sinon musclePrimary. */
val ExerciseEntity.effectivePrimary: String
    get() = muscleGroups.firstOrNull()?.takeIf { it.isNotBlank() } ?: musclePrimary

enum class ExerciseCategory {
    CHEST, BACK, SHOULDERS, BICEPS, TRICEPS,
    LEGS, GLUTES, CORE, CARDIO, FULL_BODY, OTHER
}
