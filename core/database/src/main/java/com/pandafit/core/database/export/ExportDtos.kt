package com.pandafit.core.database.export

import kotlinx.serialization.Serializable

// ── Racine v3.0 ───────────────────────────────────────────────────────────────
//
// Changements depuis v2.0 :
//  • strengthSessions : List → StrengthSessionsDto { completed, planned }
//  • runWorkouts (liste plate) → runTemplates + runSessions + cyclingTemplates + cyclingSessions
//  • statistics (snapshot) supprimé — non utile à l'import
//  • WorkoutDto.isCompleted / isTemplate : Boolean? (nullable) pour lire
//    les anciens exports v2.0 où ces champs pouvaient être null.
//    L'export v3.0 écrit toujours true/false (jamais null).

@Serializable
data class PandaMoveExport(
    val version: String = "3.0",
    val exportDate: String,
    // ── Renforcement
    val strengthTemplates: List<StrengthTemplateDto> = emptyList(),
    val strengthSessions: StrengthSessionsDto = StrengthSessionsDto(),
    // ── Running
    val runTemplates: List<RunWorkoutDto> = emptyList(),
    val runSessions: RunSessionsDto = RunSessionsDto(),
    // ── Cyclisme
    val cyclingTemplates: List<RunWorkoutDto> = emptyList(),
    val cyclingSessions: RunSessionsDto = RunSessionsDto(),
    // ── Exercices personnalisés
    val customExercises: List<CustomExerciseDto> = emptyList(),
)

// ── Renforcement ───────────────────────────────────────────────────────────────

@Serializable
data class StrengthSessionsDto(
    val completed: List<StrengthSessionDto> = emptyList(),
    val planned: List<StrengthSessionDto> = emptyList(),
)

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
data class RunSessionsDto(
    val completed: List<RunWorkoutDto> = emptyList(),
    val planned: List<RunWorkoutDto> = emptyList(),
)

@Serializable
data class RunWorkoutDto(
    val workout: WorkoutDto,
    val repeats: List<RunRepeatDto> = emptyList(),
    val steps: List<RunStepDto> = emptyList(),
    /** Tracé GPS simplifié (Douglas-Peucker déjà appliqué). Absent dans les exports antérieurs → defaut emptyList(). */
    val gpsPoints: List<GpsPointDto> = emptyList(),
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
    // Boolean? — nullable pour lire les exports v2.0 où ces champs étaient null.
    // En v3.0, le DataExportManager écrit toujours true/false (entité non-nullable).
    val isCompleted: Boolean? = false,
    val completedAt: String? = null,
    val durationMinutes: Int? = null,
    val tags: List<String> = emptyList(),
    val colorHex: String = "",
    val isTemplate: Boolean? = false,
    val cycleLabel: String = "",
    val resultDistanceKm: Double? = null,
    val resultDurationSec: Int? = null,
    val resultPaceAvgMinPerKm: Double? = null,
    val resultHrAvg: Int? = null,
    val resultHrMax: Int? = null,
    val resultRpe: Int? = null,
    val resultNotes: String = "",
    val resultElevationM: Int? = null,
    // null dans les exports antérieurs → false par défaut à l'import
    val withStroller: Boolean? = false,
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

@Serializable
data class GpsPointDto(
    /** Position dans le tracé (0-based). */
    val index: Int,
    val lat: Double,
    val lon: Double,
    /** Altitude en mètres (null si non disponible). */
    val alt: Double? = null,
)

// ── Exercices personnalisés ───────────────────────────────────────────────────

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
