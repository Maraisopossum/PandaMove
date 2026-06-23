package com.pandafit.core.database.export

import com.pandafit.core.database.catalog.EquipmentCategory
import com.pandafit.core.database.catalog.EquipmentRepository
import com.pandafit.core.database.catalog.HalteresConfig
import com.pandafit.core.database.dao.BreathingSessionDao
import com.pandafit.core.database.dao.ExerciseDao
import com.pandafit.core.database.dao.GpsTrackPointDao
import com.pandafit.core.database.dao.InstanceSeanceDao
import com.pandafit.core.database.dao.ObjectifProgressionDao
import com.pandafit.core.database.dao.RunRepeatDao
import com.pandafit.core.database.dao.RunStepDao
import com.pandafit.core.database.dao.SeanceDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.BlocSeanceEntity
import com.pandafit.core.database.entities.BreathingSessionEntity
import com.pandafit.core.database.entities.GpsTrackPointEntity
import com.pandafit.core.database.entities.BlocType
import com.pandafit.core.database.entities.ExerciceSeanceEntity
import com.pandafit.core.database.entities.ExerciseCategory
import com.pandafit.core.database.entities.ExerciseEntity
import com.pandafit.core.database.entities.InstanceSeanceEntity
import com.pandafit.core.database.entities.ObjectifProgressionEntity
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
import com.pandafit.core.database.entities.SystemeProgression
import com.pandafit.core.database.entities.TypeExercice
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject
import javax.inject.Singleton

// Format produit par certains exports antérieurs à la normalisation ISO de DataExportManager
// (LocalDateTime.toString()) — repli pour ne pas perdre createdAt/updatedAt/completedAt à l'import.
private val LEGACY_DATETIME_FORMATTER: DateTimeFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")

private fun parseDateTimeFlexible(raw: String): LocalDateTime? =
    runCatching { LocalDateTime.parse(raw) }.getOrNull()
        ?: runCatching { LocalDateTime.parse(raw, LEGACY_DATETIME_FORMATTER) }.getOrNull()

data class ImportResult(
    val imported: Int = 0,
    val skipped: Int = 0,
    val errors: Int = 0,
    val parseError: String? = null,
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
    private val breathingSessionDao: BreathingSessionDao,
    private val objectifProgressionDao: ObjectifProgressionDao,
    private val equipmentRepository: EquipmentRepository,
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

        // Toujours essayer v3 en premier (couvre les exports sans champ "version"),
        // puis v2 comme fallback si v3 échoue (ancien format avec strengthSessions en liste plate).
        val export: PandaMoveExport = runCatching {
            json.decodeFromString<PandaMoveExport>(jsonContent)
        }.getOrNull() ?: run {
            val v2Result = runCatching { json.decodeFromString<PandaMoveExportV2>(jsonContent) }
            val legacy = v2Result.getOrNull()
                ?: return@withContext ImportResult(
                    errors = 1,
                    parseError = v2Result.exceptionOrNull()?.message,
                )
            legacy.toV3()
        }

        // ── 1. Exercices personnalisés (à importer en premier — les séances y réfèrent) ──
        // Upsert par nom : si un exercice du même nom existe déjà, on met à jour ses champs.
        if (options.customExercises) {
            val existingByName = exerciseDao.observeAll().first().associate { it.name to it }
            for (ex in export.customExercises) {
                try {
                    val entity = ExerciseEntity(
                        name = ex.name, description = ex.description,
                        category = runCatching { ExerciseCategory.valueOf(ex.category) }
                            .getOrDefault(ExerciseCategory.OTHER),
                        muscleGroups = ex.muscleGroups,
                        exerciseType = ex.exerciseType, equipment = ex.equipment,
                        musclePrimary = ex.musclePrimary, isCustom = true,
                    )
                    val existing = existingByName[ex.name]
                    if (existing != null) {
                        exerciseDao.updateExercise(entity.copy(id = existing.id))
                        imported++
                    } else {
                        val r = exerciseDao.insertIgnore(entity.copy(id = ex.id))
                        if (r > 0) imported++ else skipped++
                    }
                } catch (_: Exception) {
                    errors++
                }
            }
        }

        // Maps de résolution exerciceId → utilisées par les sections 2 et 3
        // Les IDs du catalogue diffèrent entre téléphones (auto-increment après migration).
        val allExercises = exerciseDao.observeAll().first()
        val exerciseIdSet = allExercises.map { it.id }.toHashSet()
        val exerciseNameToId = allExercises.associate { it.name to it.id }

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
                            createdAt = parseDateTimeFlexible(template.seance.createdAt) ?: LocalDateTime.now(),
                            updatedAt = parseDateTimeFlexible(template.seance.updatedAt) ?: LocalDateTime.now(),
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
                    val resolvedExerciceId = if (exerciseIdSet.contains(ex.exerciceId)) {
                        ex.exerciceId
                    } else {
                        val fallback = if (ex.exerciceName.isNotBlank()) exerciseNameToId[ex.exerciceName] else null
                        if (fallback == null) { errors++; continue }
                        fallback
                    }
                    try {
                        val r = seanceDao.insertExerciceIgnore(
                            ExerciceSeanceEntity(
                                id = ex.id, seanceId = ex.seanceId, exerciceId = resolvedExerciceId,
                                blocId = ex.blocId, supersetGroupe = ex.supersetGroupe,
                                position = ex.position,
                                nombreSeriesPrevues = ex.nombreSeriesPrevues,
                                repsCibles = ex.repsCibles, chargeCible = ex.chargeCible,
                                tempo = ex.tempo,
                                repsType = runCatching { RepsType.valueOf(ex.repsType) }
                                    .getOrDefault(RepsType.REPS),
                                tempsReposSec = ex.tempsReposSec, consigneCle = ex.consigneCle,
                                equipement = ex.equipement, avertissement = ex.avertissement,
                                isBilateral = ex.isBilateral,
                                progressionActivee = ex.progressionActivee,
                                systemeProgression = ex.systemeProgression?.let {
                                    runCatching { SystemeProgression.valueOf(it) }.getOrNull()
                                },
                                repsMin = ex.repsMin, repsMax = ex.repsMax,
                                incrementKg = ex.incrementKg, incrementDureeSec = ex.incrementDureeSec,
                                seuilDeload = ex.seuilDeload,
                                typeExercice = ex.typeExercice?.let {
                                    runCatching { TypeExercice.valueOf(it) }.getOrNull()
                                },
                                incrementPct = ex.incrementPct,
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
                            completedAt = session.instance.completedAt?.let { parseDateTimeFlexible(it) },
                            durationSeconds = session.instance.durationSeconds,
                            createdAt = parseDateTimeFlexible(session.instance.createdAt) ?: LocalDateTime.now(),
                        )
                    )
                    if (instResult == -1L) { skipped++; continue }
                    imported++
                } catch (_: Exception) {
                    errors++; continue
                }

                for (bloc in session.blocs) {
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
                                instanceSeanceId = bloc.instanceSeanceId,
                            )
                        )
                        if (r > 0) imported++ else skipped++
                    } catch (_: Exception) {
                        errors++
                    }
                }

                for (ex in session.exercices) {
                    val resolvedExerciceId = if (exerciseIdSet.contains(ex.exerciceId)) {
                        ex.exerciceId
                    } else {
                        val fallback = if (ex.exerciceName.isNotBlank()) exerciseNameToId[ex.exerciceName] else null
                        if (fallback == null) { errors++; continue }
                        fallback
                    }
                    try {
                        val r = seanceDao.insertExerciceIgnore(
                            ExerciceSeanceEntity(
                                id = ex.id, seanceId = ex.seanceId, exerciceId = resolvedExerciceId,
                                instanceSeanceId = ex.instanceSeanceId,
                                blocId = ex.blocId, supersetGroupe = ex.supersetGroupe,
                                position = ex.position, nombreSeriesPrevues = ex.nombreSeriesPrevues,
                                repsCibles = ex.repsCibles, chargeCible = ex.chargeCible,
                                tempo = ex.tempo,
                                repsType = runCatching { RepsType.valueOf(ex.repsType) }
                                    .getOrDefault(RepsType.REPS),
                                tempsReposSec = ex.tempsReposSec, consigneCle = ex.consigneCle,
                                equipement = ex.equipement, avertissement = ex.avertissement,
                                isBilateral = ex.isBilateral,
                                progressionActivee = ex.progressionActivee,
                                systemeProgression = ex.systemeProgression?.let {
                                    runCatching { SystemeProgression.valueOf(it) }.getOrNull()
                                },
                                repsMin = ex.repsMin, repsMax = ex.repsMax,
                                incrementKg = ex.incrementKg, incrementDureeSec = ex.incrementDureeSec,
                                seuilDeload = ex.seuilDeload,
                                typeExercice = ex.typeExercice?.let {
                                    runCatching { TypeExercice.valueOf(it) }.getOrNull()
                                },
                                incrementPct = ex.incrementPct,
                            )
                        )
                        if (r > 0) imported++ else skipped++
                    } catch (_: Exception) {
                        errors++
                    }
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
                        createdAt = parseDateTimeFlexible(w.createdAt) ?: LocalDateTime.now(),
                        updatedAt = parseDateTimeFlexible(w.updatedAt) ?: LocalDateTime.now(),
                        // ?: false — corrige les null des exports v2.0
                        isCompleted = w.isCompleted ?: false,
                        completedAt = w.completedAt?.let { parseDateTimeFlexible(it) },
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
                        resultSpeedAvgKmh = w.resultSpeedAvgKmh,
                        resultSpeedMaxKmh = w.resultSpeedMaxKmh,
                        resultCadenceAvgRpm = w.resultCadenceAvgRpm,
                        resultCalories = w.resultCalories,
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

        // ── 6. Templates + sessions randonnée ─────────────────────────────────
        val hikingWorkoutsToImport = mutableListOf<RunWorkoutDto>()
        if (options.hikingTemplates) hikingWorkoutsToImport.addAll(export.hikingTemplates)
        if (options.hikingSessions) {
            hikingWorkoutsToImport.addAll(export.hikingSessions.completed)
            hikingWorkoutsToImport.addAll(export.hikingSessions.planned)
        }

        for (runWorkout in hikingWorkoutsToImport) {
            try {
                val w = runWorkout.workout
                val workoutResult = workoutDao.insertIgnore(
                    WorkoutEntity(
                        id = w.id,
                        workoutType = runCatching { WorkoutType.valueOf(w.workoutType) }
                            .getOrDefault(WorkoutType.HIKING),
                        name = w.name, notes = w.notes, objective = w.objective,
                        scheduledDate = runCatching { LocalDate.parse(w.scheduledDate) }
                            .getOrDefault(LocalDate.now()),
                        createdAt = parseDateTimeFlexible(w.createdAt) ?: LocalDateTime.now(),
                        updatedAt = parseDateTimeFlexible(w.updatedAt) ?: LocalDateTime.now(),
                        isCompleted = w.isCompleted ?: false,
                        completedAt = w.completedAt?.let { parseDateTimeFlexible(it) },
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
                        resultSpeedAvgKmh = w.resultSpeedAvgKmh,
                        resultSpeedMaxKmh = w.resultSpeedMaxKmh,
                        resultCadenceAvgRpm = w.resultCadenceAvgRpm,
                        resultCalories = w.resultCalories,
                    )
                )
                if (workoutResult == -1L) { skipped++; continue }
                imported++
            } catch (_: Exception) {
                errors++; continue
            }

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

        // ── 7. Sessions de respiration ─────────────────────────────────────────
        if (options.breathingSessions) {
            for (s in export.breathingSessions) {
                try {
                    breathingSessionDao.insert(
                        BreathingSessionEntity(
                            id = s.id,
                            methodId = s.methodId,
                            methodName = s.methodName,
                            cyclesCompleted = s.cyclesCompleted,
                            durationSeconds = s.durationSeconds,
                            sessionDate = runCatching { java.time.LocalDate.parse(s.sessionDate) }
                                .getOrDefault(java.time.LocalDate.now()),
                        )
                    )
                    imported++
                } catch (_: Exception) {
                    errors++
                }
            }
        }

        // ── 8. Objectifs de progression (objectif courant par exercice, bible §0.1) ─────
        if (options.objectifsProgression) {
            for (o in export.objectifsProgression) {
                val resolvedExerciceId = if (exerciseIdSet.contains(o.exerciceId)) {
                    o.exerciceId
                } else {
                    val fallback = if (o.exerciceName.isNotBlank()) exerciseNameToId[o.exerciceName] else null
                    if (fallback == null) { errors++; continue }
                    fallback
                }
                try {
                    objectifProgressionDao.upsert(
                        ObjectifProgressionEntity(
                            seanceId = o.seanceId, exerciceId = resolvedExerciceId,
                            chargeCible = o.chargeCible, repsCible = o.repsCible,
                            dureeCibleSec = o.dureeCibleSec, compteurEchec = o.compteurEchec,
                            derniereMaj = o.derniereMaj?.let {
                                runCatching { LocalDate.parse(it) }.getOrNull()
                            },
                        )
                    )
                    imported++
                } catch (_: Exception) {
                    errors++
                }
            }
        }

        // ── 9. Inventaire matériel "Mon matériel" (restauration = écrasement) ───────────
        if (options.equipmentConfig) {
            export.equipmentConfig?.let { config ->
                try {
                    val categories = config.selectedCategories
                        .mapNotNull { name -> EquipmentCategory.entries.find { it.name == name } }
                        .toSet()
                    equipmentRepository.setEquipment(categories)
                    config.pasParCategorie.forEach { (name, pas) ->
                        EquipmentCategory.entries.find { it.name == name }?.let {
                            equipmentRepository.setPas(it, pas)
                        }
                    }
                    equipmentRepository.setHalteresConfig(config.halteres ?: HalteresConfig())
                    config.barre?.let { equipmentRepository.setBarreConfig(it) }
                    config.kettlebell?.let { equipmentRepository.setKettlebellConfig(it) }
                    config.cable?.let { equipmentRepository.setCableConfig(it) }
                    imported++
                } catch (_: Exception) {
                    errors++
                }
            }
        }

        ImportResult(imported = imported, skipped = skipped, errors = errors)
    }
}
