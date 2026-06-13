package com.pandafit.core.database.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import java.time.LocalDate

@Entity(tableName = "breathing_session")
data class BreathingSessionEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    /** Identifiant de la méthode (ex. "coherence_cardiaque", "4_7_8", …). */
    @ColumnInfo(name = "method_id")
    val methodId: String,

    /** Nom affiché de la méthode. */
    @ColumnInfo(name = "method_name")
    val methodName: String,

    /** Nombre de cycles complétés. */
    @ColumnInfo(name = "cycles_completed")
    val cyclesCompleted: Int,

    /** Durée réelle de la session en secondes. */
    @ColumnInfo(name = "duration_seconds")
    val durationSeconds: Int,

    /** Date de la session. */
    @ColumnInfo(name = "session_date")
    val sessionDate: LocalDate,
)
