package com.pandafit.core.database.export

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.pandafit.core.database.dao.ExerciseDao
import com.pandafit.core.database.dao.InstanceSeanceDao
import com.pandafit.core.database.dao.RunRepeatDao
import com.pandafit.core.database.dao.RunStepDao
import com.pandafit.core.database.dao.SeanceDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.WorkoutType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.time.LocalDate
import java.time.LocalDateTime
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DataExportManager @Inject constructor(
    private val context: Context,
    private val workoutDao: WorkoutDao,
    private val repeatDao: RunRepeatDao,
    private val stepDao: RunStepDao,
    private val seanceDao: SeanceDao,
    private val instanceSeanceDao: InstanceSeanceDao,
    private val exerciseDao: ExerciseDao,
) {
    private val json = Json { prettyPrint = true; ignoreUnknownKeys = true }

    suspend fun export(): File = withContext(Dispatchers.IO) {
        // ── 1. Séances renforcement (templates) ──
        val seances = seanceDao.observeAll().first()
        val strengthTemplates = seances.mapNotNull { seance ->
            val full = seanceDao.getSeanceFull(seance.id) ?: return@mapNotNull null
            StrengthTemplateDto(
                seance = SeanceDto(
                    id = full.seance.id,
                    nom = full.seance.nom,
                    groupesMusculaires = full.seance.groupesMusculaires,
                    dureeEstimeeMin = full.seance.dureeEstimeeMin,
                    notes = full.seance.notes,
                    seanceCategory = full.seance.seanceCategory.name,
                    createdAt = full.seance.createdAt.toString(),
                    updatedAt = full.seance.updatedAt.toString(),
                ),
                blocs = full.blocs.map { b ->
                    BlocDto(
                        id = b.id, seanceId = b.seanceId, nom = b.nom,
                        type = b.type.name, position = b.position, dureeMin = b.dureeMin,
                        description = b.description,
                        tempsReposInterSec = b.tempsReposInterSec,
                        tempsReposFinRoundSec = b.tempsReposFinRoundSec,
                    )
                },
                exercices = full.exercices.map { ex ->
                    val e = ex.exerciceSeance
                    ExerciceDto(
                        id = e.id, seanceId = e.seanceId, exerciceId = e.exerciceId,
                        blocId = e.blocId, supersetGroupe = e.supersetGroupe,
                        position = e.position, nombreSeriesPrevues = e.nombreSeriesPrevues,
                        repsCibles = e.repsCibles, chargeCible = e.chargeCible,
                        tempo = e.tempo, repsType = e.repsType.name,
                        tempsReposSec = e.tempsReposSec, consigneCle = e.consigneCle,
                        equipement = e.equipement, avertissement = e.avertissement,
                    )
                },
            )
        }

        // ── 2. Sessions réalisées ──
        val allInstances = instanceSeanceDao.observeAll().first()
        val strengthSessions = allInstances.mapNotNull { inst ->
            val withSeries = instanceSeanceDao.getWithSeries(inst.id) ?: return@mapNotNull null
            StrengthSessionDto(
                instance = InstanceDto(
                    id = inst.id, seanceId = inst.seanceId,
                    date = inst.date.toString(), notes = inst.notes,
                    isCompleted = inst.isCompleted,
                    completedAt = inst.completedAt?.toString(),
                    durationSeconds = inst.durationSeconds,
                    createdAt = inst.createdAt.toString(),
                ),
                series = withSeries.series.map { s ->
                    SerieDto(
                        id = s.id, instanceSeanceId = s.instanceSeanceId,
                        exerciceSeanceId = s.exerciceSeanceId,
                        numeroSerie = s.numeroSerie, repsRealisees = s.repsRealisees,
                        chargeKg = s.chargeKg, chargeLabel = s.chargeLabel,
                        rpe = s.rpe, notes = s.notes, isCompleted = s.isCompleted,
                    )
                },
            )
        }

        // ── 3. Workouts running / vélo ──
        val allWorkouts = workoutDao.observeAll().first()
            .filter { it.workoutType == WorkoutType.RUNNING || it.workoutType == WorkoutType.CYCLING }
        val runWorkouts = allWorkouts.map { w ->
            val repeats = repeatDao.getByWorkout(w.id)
            val steps = stepDao.getByWorkout(w.id)
            RunWorkoutDto(
                workout = WorkoutDto(
                    id = w.id, workoutType = w.workoutType.name, name = w.name,
                    notes = w.notes, objective = w.objective,
                    scheduledDate = w.scheduledDate.toString(),
                    createdAt = w.createdAt.toString(), updatedAt = w.updatedAt.toString(),
                    isCompleted = w.isCompleted, completedAt = w.completedAt?.toString(),
                    durationMinutes = w.durationMinutes, tags = w.tags,
                    colorHex = w.colorHex, isTemplate = w.isTemplate,
                    cycleLabel = w.cycleLabel,
                    resultDistanceKm = w.resultDistanceKm,
                    resultDurationSec = w.resultDurationSec,
                    resultPaceAvgMinPerKm = w.resultPaceAvgMinPerKm,
                    resultHrAvg = w.resultHrAvg, resultHrMax = w.resultHrMax,
                    resultRpe = w.resultRpe, resultNotes = w.resultNotes,
                    resultElevationM = w.resultElevationM,
                ),
                repeats = repeats.map { r ->
                    RunRepeatDto(
                        id = r.id, workoutId = r.workoutId,
                        position = r.position, repeatCount = r.repeatCount,
                        resultsJson = r.resultsJson,
                    )
                },
                steps = steps.map { s ->
                    RunStepDto(
                        id = s.id, workoutId = s.workoutId, repeatId = s.repeatId,
                        position = s.position, stepType = s.stepType.name,
                        endType = s.endType.name, endValue = s.endValue,
                        endUnit = s.endUnit.name, note = s.note,
                        targetType = s.targetType.name,
                        targetMin = s.targetMin, targetMax = s.targetMax,
                        resultsJson = s.resultsJson,
                    )
                },
            )
        }

        // ── 4. Exercices custom (isCustom = true) ──
        val customExercises = exerciseDao.observeAll().first()
            .filter { it.isCustom }
            .map { e ->
                CustomExerciseDto(
                    id = e.id, name = e.name, description = e.description,
                    category = e.category.name, muscleGroups = e.muscleGroups,
                    exerciseType = e.exerciseType, equipment = e.equipment,
                    musclePrimary = e.musclePrimary,
                )
            }

        // ── 5. Stats snapshot ──
        val completedInstances = allInstances.count { it.isCompleted }
        val completedRuns = allWorkouts.count { it.isCompleted }
        val totalDist = allWorkouts.filter { it.isCompleted }.sumOf { it.resultDistanceKm ?: 0.0 }
        val stats = StatsSnapshotDto(
            computedAt = LocalDateTime.now().toString(),
            totalStrengthSessions = completedInstances,
            totalRunSessions = completedRuns,
            totalDistanceKm = totalDist,
        )

        val export = PandaMoveExport(
            exportDate = LocalDateTime.now().toString(),
            strengthTemplates = strengthTemplates,
            strengthSessions = strengthSessions,
            runWorkouts = runWorkouts,
            customExercises = customExercises,
            statistics = stats,
        )

        val jsonStr = json.encodeToString(export)
        val fileName = "pandamove_export_${LocalDate.now()}.json"
        val file = File(context.cacheDir, fileName)
        file.writeText(jsonStr, Charsets.UTF_8)
        file
    }

    fun shareFile(file: File) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "application/json"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, "PandaMove — Export de mes données")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        // FLAG_ACTIVITY_NEW_TASK doit être sur l'intent chooser, pas sur l'intent fils
        val chooser = Intent.createChooser(send, "Partager l'export PandaMove").apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(chooser)
    }
}
