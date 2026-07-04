package com.pandafit.core.database.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import com.pandafit.core.database.entities.WorkoutType
import java.time.LocalDate
import java.time.LocalDateTime

@Entity(
    tableName = "workouts",
    indices = [
        Index("scheduled_date"),
        Index("workout_type"),
        Index("is_completed"),
    ]
)
data class WorkoutEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "workout_type")
    val workoutType: WorkoutType,

    val name: String,

    val notes: String = "",

    val objective: String = "",

    @ColumnInfo(name = "scheduled_date")
    val scheduledDate: LocalDate,

    @ColumnInfo(name = "created_at")
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @ColumnInfo(name = "updated_at")
    val updatedAt: LocalDateTime = LocalDateTime.now(),

    @ColumnInfo(name = "is_completed")
    val isCompleted: Boolean = false,

    @ColumnInfo(name = "completed_at")
    val completedAt: LocalDateTime? = null,

    @ColumnInfo(name = "duration_minutes")
    val durationMinutes: Int? = null,

    val tags: List<String> = emptyList(),

    @ColumnInfo(name = "color_hex")
    val colorHex: String = "",

    @ColumnInfo(name = "is_template")
    val isTemplate: Boolean = false,

    @ColumnInfo(name = "cycle_label")
    val cycleLabel: String = "",

    @ColumnInfo(name = "result_distance_km")
    val resultDistanceKm: Double? = null,

    @ColumnInfo(name = "result_duration_sec")
    val resultDurationSec: Int? = null,

    @ColumnInfo(name = "result_pace_avg_min_per_km")
    val resultPaceAvgMinPerKm: Double? = null,

    @ColumnInfo(name = "result_hr_avg")
    val resultHrAvg: Int? = null,

    @ColumnInfo(name = "result_rpe")
    val resultRpe: Int? = null,

    @ColumnInfo(name = "result_notes")
    val resultNotes: String = "",

    @ColumnInfo(name = "result_hr_max")
    val resultHrMax: Int? = null,

    @ColumnInfo(name = "result_elevation_m")
    val resultElevationM: Int? = null,

    @ColumnInfo(name = "with_stroller")
    val withStroller: Boolean = false,

    // ── Résultats spécifiques cyclisme ────────────────────────────────────────
    @ColumnInfo(name = "result_speed_avg_kmh")
    val resultSpeedAvgKmh: Double? = null,

    @ColumnInfo(name = "result_speed_max_kmh")
    val resultSpeedMaxKmh: Double? = null,

    @ColumnInfo(name = "result_cadence_avg_rpm")
    val resultCadenceAvgRpm: Int? = null,

    @ColumnInfo(name = "result_calories")
    val resultCalories: Int? = null,

    /** Provenance de la séance — détermine l'affichage de la notice source dans l'écran de résultat. */
    val source: WorkoutSource = WorkoutSource.NATIVE,
)

enum class WorkoutType {
    RUNNING, CYCLING, STRENGTH, HIKING
}

enum class WorkoutSource {
    /** Saisie/exécutée directement dans PandaMove (manuelle ou GPS live). */
    NATIVE,
    /** Importée depuis un fichier TCX (Garmin Connect ou équivalent). */
    TCX_IMPORT,
}
