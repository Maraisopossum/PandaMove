package com.pandafit.core.database.export

import com.pandafit.core.database.dao.ExerciseDao
import com.pandafit.core.database.dao.GpsTrackPointDao
import com.pandafit.core.database.dao.InstanceSeanceDao
import com.pandafit.core.database.dao.RunRepeatDao
import com.pandafit.core.database.dao.RunStepDao
import com.pandafit.core.database.dao.SeanceDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.BlocSeanceEntity
import com.pandafit.core.database.entities.GpsTrackPointEntity
import com.pandafit.core.database.entities.BlocType
import com.pandafit.core.database.entities.ExerciceSeanceEntity
import com.pandafit.core.database.entities.ExerciseCategory
import com.pandafit.core.database.entities.ExerciseEntity
import com.pandafit.core.database.entities.InstanceSeanceEntity
import com.pandafit.core.database.entities.RepsType
import com.pandafit.core.database.entities.RunEndType
import com.pandafit.core.database.entities.RunEndUnit
import com.pandafit.core.database.entities.RunRepeatEntity
import com.pandafit.core.database.entities.RunStepEntity
import com.pandafit.core.database.entities.RunStepType
import com.pandafit.core.database.entities.RunTargetType
import com.pandafit.core.database.entities.SeanceCategory
import com.pandafit.core.database.entities.SeanceEntity
import com.pandafit.core.database.entities.SerieRealiseeEntity
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.time.LocalDate
import java.time.LocalDateTime
import javax.inject.Inject
import javax.inject.Singleton

data class ImportResult(
    val imported: Int = 0,
    val skipped: Int = 0,
    val errors: Int = 0,
) {
    val total get() = imported + skipped + errors
    override fun toString() =
        "$imported importé${if (imported > 1) "s" else ""}, $skipped ignoré${if (skipped > 1) "s" else ""} (doublon${if (skipped > 1) "s" else ""})"
}

// ── Format legacy v2.0 (import uniquement) ────────────────────────────────────
// Utilisé pour lire les fichiers générés avant v3.0, où :
//   • strengthSessions était une liste plate (pas de completed/planned)
//   • tous les workouts running/vélo étaient dans runWorkouts (liste plate)
//   • WorkoutDto.isCompleted / isTemplate pouvaient être null

@Serializable
private data class PandaMoveExportV2(
    val version: String = "2.0",
    val exportDate: String = "",
    val strengthTemplates: List<StrengthTemplateDto> = emptyList(),
    val strengthSessions: List<StrengthSessionDto> = emptyList(),
    val runWorkouts: List<RunWorkoutDto> = emptyList(),
    val customExercises: List<CustomExerciseDto> = emptyList(),
)

/** Convertit un export v2.0 vers la structure v3.0, en corrigeant les null → false. */
private fun PandaMoveExportV2.toV3(): PandaMoveExport {
    val running = runWorkouts.filter { it.workout.workoutType == "RUNNING" }
    val cycling = runWorkouts.filter { it.workout.workoutType == "CYCLING" }

    // isTemplate et isCompleted pouvaient être null dans les exports v2.0 → coerce false
    fun RunWorkoutDto.isTemplateCoerced() = workout.isTemplate ?: false
    fun RunWorkoutDto.isCompletedCoerced() = workout.isCompleted ?: false

    return PandaMoveExport(
        version = "3.0",
        exportDate = exportDate,
        strengthTemplates = strengthTemplates,
        strengthSessions = StrengthSessionsDto(
            completed = strengthSessions.filter { it.instance.isCompleted },
            planned = strengthSessions.filter { !it.instance.isCompleted },
        ),
        runTemplates = running.filter { it.isTemplateCoerced() },
        runSessions = RunSessionsDto(
            completed = running.filter { !it.isTemplateCoerced() && it.isCompletedCoerced() },
            planned = running.filter { !it.isTemplateCoerced() && !it.isCompletedCoerced() },
        ),
        cyclingTemplates = cycling.filter { it.isTemplateCoerced() },
        cyclingSessions = RunSessionsDto(
            completed = cycling.filter { !it.isTemplateCoerced() && it.isCompletedCoerced() },
            planned = cycling.filter { !it.isTemplateCoerced() && !it.isCompletedCoerced() },
        ),
        customExercises = customExercises,
    )
}

// ── Manager ───────────────────────────────────────────────────────────────────

@Singleton
class DataImportManager @Inject constructor(
    private val workoutDao: WorkoutDao,
    private val repeatDao: RunRepeatDao,
    private val stepDao: RunStepDao,
    private val seanceDao: SeanceDao,
    private val instanceSeanceDao: InstanceSeanceDao,
    private val exerciseDao: ExerciseDao,
    private val gpsDao: GpsTrackPointDao,
) {
    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Importe un fichier JSON (v2.0 ou v3.0) dans la base Room.
     * [options] permet de n'importer qu'une partie des sections.
     * Par défaut, toutes les sections sont importées.
     */
    suspend fun import(
        jsonContent: String,
        options: ImportOptions = ImportOptions.ALL,
    ): ImportResult = withContext(Dispatchers.IO) {
        var imported = 0; var skipped = 0; var errors = 0

        // ── Détection de version ───────────────────────────────────────────────
        val version = runCatching {
            json.parseToJsonElement(jsonContent).jsonObject["version"]?.jsonPrimitive?.contentOrNull
        }.getOrNull() ?: "2.0"

        val export: PandaMoveExport = when {
            version.startsWith("3") -> {
                runCatching { json.decodeFromString<PandaMoveExport>(jsonContent) }.getOrNull()
                    ?: return@withContext ImportResult(errors = 1)
            }
            else -> {
                // v2.0 ou format inconnu → parsing legacy puis conversion
                val legacy = runCatching {
                    json.decodeFromString<PandaMoveExportV2>(jsonContent)
                }.getOrNull() ?: return@withContext ImportResult(errors = 1)
                legacy.toV3()
            }
        }

        // ── 1. Exercices personnalisés (à importer en premier — les séances y réfèrent) ──
        if (options.customExercises) {
            for (ex in export.customExercises) {
                try {
                    val r = exerciseDao.insertIgnore(
                        ExerciseEntity(
                            id = ex.id, name = ex.name, description = ex.description,
                            category = runCatching { ExerciseCategory.valueOf(ex.category) }
                                .getOrDefault(ExerciseCategory.OTHER),
                            muscleGroups = ex.muscleGroups,
                            exerciseType = ex.exerciseType, equipment = ex.equipment,
                            musclePrimary = ex.musclePrimary, isCustom = true,
                        )
                    )
                    if (r > 0) imported++ else skipped++
                } catch (_: Exception) {
                    errors++
                }
            }
        }

        // ── 2. Templates renforcement ──────────────────────────────────────────
        if (options.strengthTemplates) {
            for (template in export.strengthTemplates) {
                try {
                    val seanceResult = seanceDao.insertSeanceIgnore(
                        SeanceEntity(
                            id = template.seance.id, nom = template.seance.nom,
                            groupesMusculaires = template.seance.groupesMusculaires,
                            dureeEstimeeMin = template.seance.dureeEstimeeMin,
                            notes = template.seance.notes,
                            seanceCategory = runCatching {
                                SeanceCategory.valueOf(template.seance.seanceCategory)
                            }.getOrDefault(SeanceCategory.STRENGTH),
                            createdAt = runCatching {
                                LocalDateTime.parse(template.seance.createdAt)
                            }.getOrDefault(LocalDateTime.now()),
                            updatedAt = runCatching {
                                LocalDateTime.parse(template.seance.updatedAt)
                            }.getOrDefault(LocalDateTime.now()),
                        )
                    )
                    if (seanceResult == -1L) { skipped++; continue }
                    imported++
                } catch (_: Exception) {
                    errors++; continue
                }

                for (bloc in template.blocs) {
                    try {
                        val r = seanceDao.insertBlocIgnore(
                            BlocSeanceEntity(
                                id = bloc.id, seanceId = bloc.seanceId, nom = bloc.nom,
                                type = runCatching { BlocType.valueOf(bloc.type) }
                                    .getOrDefault(BlocType.ECHAUFFEMENT),
                                position = bloc.position, dureeMin = bloc.dureeMin,
                                description = bloc.description,
                                tempsReposInterSec = bloc.tempsReposInterSec,
                                tempsReposFinRoundSec = bloc.tempsReposFinRoundSec,
                            )
                        )
                        if (r > 0) imported++ else skipped++
                    } catch (_: Exception) {
                        errors++
                    }
                }

                for (ex in template.exercices) {
                    try {
                        val r = seanceDao.insertExerciceIgnore(
                            ExerciceSeanceEntity(
                                id = ex.id, seanceId = ex.seanceId, exerciceId = ex.exerciceId,
                                blocId = ex.blocId, supersetGroupe = ex.supersetGroupe,
                                position = ex.position,
                                nombreSeriesPrevues = ex.nombreSeriesPrevues,
                                repsCibles = ex.repsCibles, chargeCible = ex.chargeCible,
                                tempo = ex.tempo,
                                repsType = runCatching { RepsType.valueOf(ex.repsType) }
                                    .getOrDefault(RepsType.REPS),
                                tempsReposSec = ex.tempsReposSec, consigneCle = ex.consigneCle,
                                equipement = ex.equipement, avertissement = ex.avertissement,
                            )
                        )
                        if (r > 0) imported++ else skipped++
                    } catch (_: Exception) {
                        errors++
                    }
                }
            }
        }

        // ── 3. Sessions renforcement ───────────────────────────────────────────
        if (options.strengthSessions) {
            val sessions = export.strengthSessions.completed + export.strengthSessions.planned
            for (session in sessions) {
                try {
                    val instResult = instanceSeanceDao.insertInstanceIgnore(
                        InstanceSeanceEntity(
                            id = session.instance.id, seanceId = session.instance.seanceId,
                            date = runCatching { LocalDate.parse(session.instance.date) }
                                .getOrDefault(LocalDate.now()),
                            notes = session.instance.notes,
                            isCompleted = session.instance.isCompleted,
                            completedAt = session.instance.completedAt?.let {
                                runCatching { LocalDateTime.parse(it) }.getOrNull()
                            },
                            durationSeconds = session.instance.durationSeconds,
                            createdAt = runCatching {
                                LocalDateTime.parse(session.instance.createdAt)
                            }.getOrDefault(LocalDateTime.now()),
                        )
                    )
                    if (instResult == -1L) { skipped++; continue }
                    imported++
                } catch (_: Exception) {
                    errors++; continue
                }

                for (serie in session.series) {
                    try {
                        val r = instanceSeanceDao.insertSerieIgnore(
                            SerieRealiseeEntity(
                                id = serie.id, instanceSeanceId = serie.instanceSeanceId,
                                exerciceSeanceId = serie.exerciceSeanceId,
                                numeroSerie = serie.numeroSerie,
                                repsRealisees = serie.repsRealisees, chargeKg = serie.chargeKg,
                                chargeLabel = serie.chargeLabel, rpe = serie.rpe,
                                notes = serie.notes, isCompleted = serie.isCompleted,
                            )
                        )
                        if (r > 0) imported++ else skipped++
                    } catch (_: Exception) {
                        errors++
                    }
                }
            }
        }

        // ── 4. Templates + sessions running ───────────────────────────────────
        val runWorkoutsToImport = mutableListOf<RunWorkoutDto>()
        if (options.runningTemplates) runWorkoutsToImport.addAll(export.runTemplates)
        if (options.runningSessions) {
            runWorkoutsToImport.addAll(export.runSessions.completed)
            runWorkoutsToImport.addAll(export.runSessions.planned)
        }

        // ── 5. Templates + sessions cyclisme ──────────────────────────────────
        val cyclingWorkoutsToImport = mutableListOf<RunWorkoutDto>()
        if (options.cyclingTemplates) cyclingWorkoutsToImport.addAll(export.cyclingTemplates)
        if (options.cyclingSessions) {
            cyclingWorkoutsToImport.addAll(export.cyclingSessions.completed)
            cyclingWorkoutsToImport.addAll(export.cyclingSessions.planned)
        }

        for (runWorkout in runWorkoutsToImport + cyclingWorkoutsToImport) {
            try {
                val w = runWorkout.workout
                val workoutResult = workoutDao.insertIgnore(
                    WorkoutEntity(
                        id = w.id,
                        workoutType = runCatching { WorkoutType.valueOf(w.workoutType) }
                            .getOrDefault(WorkoutType.RUNNING),
                        name = w.name, notes = w.notes, objective = w.objective,
                        scheduledDate = runCatching { LocalDate.parse(w.scheduledDate) }
                            .getOrDefault(LocalDate.now()),
                        createdAt = runCatching { LocalDateTime.parse(w.createdAt) }
                            .getOrDefault(LocalDateTime.now()),
                        updatedAt = runCatching { LocalDateTime.parse(w.updatedAt) }
                            .getOrDefault(LocalDateTime.now()),
                        // ?: false — corrige les null des exports v2.0
                        isCompleted = w.isCompleted ?: false,
                        completedAt = w.completedAt?.let {
                            runCatching { LocalDateTime.parse(it) }.getOrNull()
                        },
                        durationMinutes = w.durationMinutes, tags = w.tags,
                        colorHex = w.colorHex,
                        isTemplate = w.isTemplate ?: false,
                        cycleLabel = w.cycleLabel,
                        resultDistanceKm = w.resultDistanceKm,
                        resultDurationSec = w.resultDurationSec,
                        resultPaceAvgMinPerKm = w.resultPaceAvgMinPerKm,
                        resultHrAvg = w.resultHrAvg, resultHrMax = w.resultHrMax,
                        resultRpe = w.resultRpe, resultNotes = w.resultNotes,
                        resultElevationM = w.resultElevationM,
                        withStroller = w.withStroller ?: false,
                    )
                )
                if (workoutResult == -1L) { skipped++; continue }
                imported++
            } catch (_: Exception) {
                errors++; continue
            }

            for (repeat in runWorkout.repeats) {
                try {
                    val r = repeatDao.insertIgnore(
                        RunRepeatEntity(
                            id = repeat.id, workoutId = repeat.workoutId,
                            position = repeat.position, repeatCount = repeat.repeatCount,
                            resultsJson = repeat.resultsJson,
                        )
                    )
                    if (r > 0) imported++ else skipped++
                } catch (_: Exception) {
                    errors++
                }
            }

            for (step in runWorkout.steps) {
                try {
                    val r = stepDao.insertIgnore(
                        RunStepEntity(
                            id = step.id, workoutId = step.workoutId, repeatId = step.repeatId,
                            position = step.position,
                            stepType = runCatching { RunStepType.valueOf(step.stepType) }
                                .getOrDefault(RunStepType.RUNNING),
                            endType = runCatching { RunEndType.valueOf(step.endType) }
                                .getOrDefault(RunEndType.DURATION),
                            endValue = step.endValue,
                            endUnit = runCatching { RunEndUnit.valueOf(step.endUnit) }
                                .getOrDefault(RunEndUnit.SECONDS),
                            note = step.note,
                            targetType = runCatching { RunTargetType.valueOf(step.targetType) }
                                .getOrDefault(RunTargetType.NONE),
                            targetMin = step.targetMin, targetMax = step.targetMax,
                            resultsJson = step.resultsJson,
                        )
                    )
                    if (r > 0) imported++ else skipped++
                } catch (_: Exception) {
                    errors++
                }
            }

            // ── Points GPS (absents dans les exports v2.0 → gpsPoints = emptyList par défaut) ──
            if (runWorkout.gpsPoints.isNotEmpty()) {
                try {
                    gpsDao.insertAll(runWorkout.gpsPoints.map { p ->
                        GpsTrackPointEntity(
                            workoutId = runWorkout.workout.id,
                            pointIndex = p.index,
                            latitude = p.lat,
                            longitude = p.lon,
                            altitudeM = p.alt,
                        )
                    })
                    imported += runWorkout.gpsPoints.size
                } catch (_: Exception) {
                    errors++
                }
            }
        }

        ImportResult(imported = imported, skipped = skipped, errors = errors)
    }
}
