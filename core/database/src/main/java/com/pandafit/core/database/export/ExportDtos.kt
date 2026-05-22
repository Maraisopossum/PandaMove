package com.pandafit.core.database.export

import kotlinx.serialization.Serializable

// ── Export racine ──────────────────────────────────────────────────────────────

@Serializable
data class PandaMoveExport(
    val version: String = "2.0",
    val exportDate: String,
    val strengthTemplates: List<StrengthTemplateDto> = emptyList(),
    val strengthSessions: List<StrengthSessionDto> = emptyList(),
    val runWorkouts: List<RunWorkoutDto> = emptyList(),
    val customExercises: List<CustomExerciseDto> = emptyList(),
    val statistics: StatsSnapshotDto = StatsSnapshotDto(),
)

// ── Renforcement ───────────────────────────────────────────────────────────────

@Serializable
data class StrengthTemplateDto(
    val seance: SeanceDto,
    val blocs: List<BlocDto> = emptyList(),
    val exercices: List<ExerciceDto> = emptyList(),
)

@Serializable
data class SeanceDto(
    val id: Long,
    val nom: String,
    val groupesMusculaires: List<String> = emptyList(),
    val dureeEstimeeMin: Int = 60,
    val notes: String = "",
    val seanceCategory: String = "STRENGTH",
    val createdAt: String = "",
    val updatedAt: String = "",
)

@Serializable
data class BlocDto(
    val id: Long,
    val seanceId: Long,
    val nom: String,
    val type: String = "ECHAUFFEMENT",
    val position: Int = 0,
    val dureeMin: Int? = null,
    val description: String = "",
    val tempsReposInterSec: Int = 20,
    val tempsReposFinRoundSec: Int = 120,
)

@Serializable
data class ExerciceDto(
    val id: Long,
    val seanceId: Long,
    val exerciceId: Long,
    val blocId: Long? = null,
    val supersetGroupe: String? = null,
    val position: Int = 0,
    val nombreSeriesPrevues: Int = 3,
    val repsCibles: String = "",
    val chargeCible: String = "",
    val tempo: String = "",
    val repsType: String = "REPS",
    val tempsReposSec: Int = 90,
    val consigneCle: String = "",
    val equipement: String = "",
    val avertissement: String = "",
)

@Serializable
data class StrengthSessionDto(
    val instance: InstanceDto,
    val series: List<SerieDto> = emptyList(),
)

@Serializable
data class InstanceDto(
    val id: Long,
    val seanceId: Long,
    val date: String,
    val notes: String = "",
    val isCompleted: Boolean = false,
    val completedAt: String? = null,
    val durationSeconds: Int = 0,
    val createdAt: String = "",
)

@Serializable
data class SerieDto(
    val id: Long,
    val instanceSeanceId: Long,
    val exerciceSeanceId: Long,
    val numeroSerie: Int,
    val repsRealisees: Int? = null,
    val chargeKg: Float? = null,
    val chargeLabel: String? = null,
    val rpe: Float? = null,
    val notes: String = "",
    val isCompleted: Boolean = false,
)

// ── Running / Vélo ─────────────────────────────────────────────────────────────

@Serializable
data class RunWorkoutDto(
    val workout: WorkoutDto,
    val repeats: List<RunRepeatDto> = emptyList(),
    val steps: List<RunStepDto> = emptyList(),
)

@Serializable
data class WorkoutDto(
    val id: Long,
    val workoutType: String,
    val name: String,
    val notes: String = "",
    val objective: String = "",
    val scheduledDate: String,
    val createdAt: String = "",
    val updatedAt: String = "",
    val isCompleted: Boolean = false,
    val completedAt: String? = null,
    val durationMinutes: Int? = null,
    val tags: List<String> = emptyList(),
    val colorHex: String = "",
    val isTemplate: Boolean = false,
    val cycleLabel: String = "",
    val resultDistanceKm: Double? = null,
    val resultDurationSec: Int? = null,
    val resultPaceAvgMinPerKm: Double? = null,
    val resultHrAvg: Int? = null,
    val resultHrMax: Int? = null,
    val resultRpe: Int? = null,
    val resultNotes: String = "",
    val resultElevationM: Int? = null,
)

@Serializable
data class RunRepeatDto(
    val id: Long,
    val workoutId: Long,
    val position: Int,
    val repeatCount: Int,
    val resultsJson: String = "",
)

@Serializable
data class RunStepDto(
    val id: Long,
    val workoutId: Long,
    val repeatId: Long? = null,
    val position: Int,
    val stepType: String,
    val endType: String,
    val endValue: Int,
    val endUnit: String,
    val note: String? = null,
    val targetType: String,
    val targetMin: Int? = null,
    val targetMax: Int? = null,
    val resultsJson: String = "",
)

// ── Exercices custom ──────────────────────────────────────────────────────────

@Serializable
data class CustomExerciseDto(
    val id: Long,
    val name: String,
    val description: String = "",
    val category: String = "",
    val muscleGroups: List<String> = emptyList(),
    val exerciseType: String = "",
    val equipment: List<String> = emptyList(),
    val musclePrimary: String = "",
)

// ── Stats snapshot ────────────────────────────────────────────────────────────

@Serializable
data class StatsSnapshotDto(
    val computedAt: String = "",
    val totalStrengthSessions: Int = 0,
    val totalRunSessions: Int = 0,
    val totalDistanceKm: Double = 0.0,
    val totalTonnageKg: Double = 0.0,
)
