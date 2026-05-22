package com.pandafit.core.database.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "run_repeats",
    foreignKeys = [
        ForeignKey(
            entity = WorkoutEntity::class,
            parentColumns = ["id"],
            childColumns = ["workout_id"],
            onDelete = ForeignKey.CASCADE,
        )
    ],
    indices = [Index("workout_id")]
)
data class RunRepeatEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "workout_id")
    val workoutId: Long,

    val position: Int,

    @ColumnInfo(name = "repeat_count")
    val repeatCount: Int,

    // JSON sérialisé de List<IntervalRepResult> — résultats de validation
    @ColumnInfo(name = "results_json")
    val resultsJson: String = "",
)
