package com.pandafit.core.database.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import java.time.LocalDate
import java.time.LocalDateTime

@Entity(
    tableName = "instances_seance",
    foreignKeys = [
        ForeignKey(
            entity = SeanceEntity::class,
            parentColumns = ["id"],
            childColumns = ["seance_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("seance_id"), Index("date")],
)
data class InstanceSeanceEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "seance_id")
    val seanceId: Long,

    val date: LocalDate,

    val notes: String = "",

    @ColumnInfo(name = "is_completed")
    val isCompleted: Boolean = false,

    @ColumnInfo(name = "completed_at")
    val completedAt: LocalDateTime? = null,

    @ColumnInfo(name = "duration_seconds")
    val durationSeconds: Int = 0,

    @ColumnInfo(name = "created_at")
    val createdAt: LocalDateTime = LocalDateTime.now(),
)
