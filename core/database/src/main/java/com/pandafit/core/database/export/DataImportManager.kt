package com.pandafit.core.database.export

import com.pandafit.core.database.dao.ExerciseDao
import com.pandafit.core.database.dao.InstanceSeanceDao
import com.pandafit.core.database.dao.RunRepeatDao
import com.pandafit.core.database.dao.RunStepDao
import com.pandafit.core.database.dao.SeanceDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.BlocSeanceEntity
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
import kotlinx.serialization.json.Json
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

@Singleton
class DataImportManager @Inject constructor(
    private val workoutDao: WorkoutDao,
    private val repeatDao: RunRepeatDao,
    private val stepDao: RunStepDao,
    private val seanceDao: SeanceDao,
    private val instanceSeanceDao: InstanceSeanceDao,
    private val exerciseDao: ExerciseDao,
) {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun import(jsonContent: String): ImportResult = withContext(Dispatchers.IO) {
        var imported = 0; var skipped = 0; var errors = 0

        val export = runCatching { json.decodeFromString<PandaMoveExport>(jsonContent) }.getOrNull()
            ?: return@withContext ImportResult(errors = 1)

        // ── 1. Exercices custom (avant exercices séance qui y réfèrent) ──
        for (ex in export.customExercises) {
            try {
                val r = exerciseDao.insertIgnore(
                    ExerciseEntity(
                        id = ex.id,
                        name = ex.name,
                        description = ex.description,
                        category = runCatching { ExerciseCategory.valueOf(ex.category) }.getOrDefault(ExerciseCategory.OTHER),
                        muscleGroups = ex.muscleGroups,
                        exerciseType = ex.exerciseType,
                        equipment = ex.equipment,
                        musclePrimary = ex.musclePrimary,
                        isCustom = true,
                    )
                )
                if (r > 0) imported++ else skipped++
            } catch (_: Exception) {
                errors++
            }
        }

        // ── 2. Séances types (templates strength) ──
        for (template in export.strengthTemplates) {
            try {
                val seanceEntity = SeanceEntity(
                    id = template.seance.id,
                    nom = template.seance.nom,
                    groupesMusculaires = template.seance.groupesMusculaires,
                    dureeEstimeeMin = template.seance.dureeEstimeeMin,
                    notes = template.seance.notes,
                    seanceCategory = runCatching { SeanceCategory.valueOf(template.seance.seanceCategory) }.getOrDefault(SeanceCategory.STRENGTH),
                    createdAt = runCatching { LocalDateTime.parse(template.seance.createdAt) }.getOrDefault(LocalDateTime.now()),
                    updatedAt = runCatching { LocalDateTime.parse(template.seance.updatedAt) }.getOrDefault(LocalDateTime.now()),
                )
                val seanceResult = seanceDao.insertSeanceIgnore(seanceEntity)
                if (seanceResult == -1L) {
                    skipped++; continue
                }
                imported++
            } catch (_: Exception) {
                errors++; continue
            }

            for (bloc in template.blocs) {
                try {
                    val r = seanceDao.insertBlocIgnore(
                        BlocSeanceEntity(
                            id = bloc.id, seanceId = bloc.seanceId, nom = bloc.nom,
                            type = runCatching { BlocType.valueOf(bloc.type) }.getOrDefault(BlocType.ECHAUFFEMENT),
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
                            position = ex.position, nombreSeriesPrevues = ex.nombreSeriesPrevues,
                            repsCibles = ex.repsCibles, chargeCible = ex.chargeCible,
                            tempo = ex.tempo,
                            repsType = runCatching { RepsType.valueOf(ex.repsType) }.getOrDefault(RepsType.REPS),
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

        // ── 3. Instances + séries ──
        for (session in export.strengthSessions) {
            try {
                val instEntity = InstanceSeanceEntity(
                    id = session.instance.id, seanceId = session.instance.seanceId,
                    date = runCatching { LocalDate.parse(session.instance.date) }.getOrDefault(LocalDate.now()),
                    notes = session.instance.notes, isCompleted = session.instance.isCompleted,
                    completedAt = session.instance.completedAt?.let {
                        runCatching { LocalDateTime.parse(it) }.getOrNull()
                    },
                    durationSeconds = session.instance.durationSeconds,
                    createdAt = runCatching { LocalDateTime.parse(session.instance.createdAt) }.getOrDefault(LocalDateTime.now()),
                )
                val instResult = instanceSeanceDao.insertInstanceIgnore(instEntity)
                if (instResult == -1L) {
                    skipped++; continue
                }
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
                            numeroSerie = serie.numeroSerie, repsRealisees = serie.repsRealisees,
                            chargeKg = serie.chargeKg, chargeLabel = serie.chargeLabel,
                            rpe = serie.rpe, notes = serie.notes, isCompleted = serie.isCompleted,
                        )
                    )
                    if (r > 0) imported++ else skipped++
                } catch (_: Exception) {
                    errors++
                }
            }
        }

        // ── 4. Workouts running / vélo + repeats + steps ──
        for (runWorkout in export.runWorkouts) {
            try {
                val w = runWorkout.workout
                val entity = WorkoutEntity(
                    id = w.id,
                    workoutType = runCatching { WorkoutType.valueOf(w.workoutType) }.getOrDefault(WorkoutType.RUNNING),
                    name = w.name, notes = w.notes, objective = w.objective,
                    scheduledDate = runCatching { LocalDate.parse(w.scheduledDate) }.getOrDefault(LocalDate.now()),
                    createdAt = runCatching { LocalDateTime.parse(w.createdAt) }.getOrDefault(LocalDateTime.now()),
                    updatedAt = runCatching { LocalDateTime.parse(w.updatedAt) }.getOrDefault(LocalDateTime.now()),
                    isCompleted = w.isCompleted,
                    completedAt = w.completedAt?.let { runCatching { LocalDateTime.parse(it) }.getOrNull() },
                    durationMinutes = w.durationMinutes, tags = w.tags, colorHex = w.colorHex,
                    isTemplate = w.isTemplate, cycleLabel = w.cycleLabel,
                    resultDistanceKm = w.resultDistanceKm, resultDurationSec = w.resultDurationSec,
                    resultPaceAvgMinPerKm = w.resultPaceAvgMinPerKm,
                    resultHrAvg = w.resultHrAvg, resultHrMax = w.resultHrMax,
                    resultRpe = w.resultRpe, resultNotes = w.resultNotes,
                    resultElevationM = w.resultElevationM,
                )
                val workoutResult = workoutDao.insertIgnore(entity)
                if (workoutResult == -1L) {
                    skipped++; continue
                }
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
                            stepType = runCatching { RunStepType.valueOf(step.stepType) }.getOrDefault(RunStepType.RUNNING),
                            endType = runCatching { RunEndType.valueOf(step.endType) }.getOrDefault(RunEndType.DURATION),
                            endValue = step.endValue,
                            endUnit = runCatching { RunEndUnit.valueOf(step.endUnit) }.getOrDefault(RunEndUnit.SECONDS),
                            note = step.note,
                            targetType = runCatching { RunTargetType.valueOf(step.targetType) }.getOrDefault(RunTargetType.NONE),
                            targetMin = step.targetMin, targetMax = step.targetMax,
                            resultsJson = step.resultsJson,
                        )
                    )
                    if (r > 0) imported++ else skipped++
                } catch (_: Exception) {
                    errors++
                }
            }
        }

        ImportResult(imported = imported, skipped = skipped, errors = errors)
    }
}
