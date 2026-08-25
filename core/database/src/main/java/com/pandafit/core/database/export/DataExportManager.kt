package com.pandafit.core.database.export

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.pandafit.core.database.catalog.EquipmentRepository
import com.pandafit.core.database.dao.BreathingSessionDao
import com.pandafit.core.database.dao.ExerciseDao
import com.pandafit.core.database.dao.GpsTrackPointDao
import com.pandafit.core.database.dao.InstanceSeanceDao
import com.pandafit.core.database.dao.ObjectifProgressionDao
import com.pandafit.core.database.dao.RunRepeatDao
import com.pandafit.core.database.dao.RunStepDao
import com.pandafit.core.database.dao.SeanceDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.WorkoutType
import dagger.hilt.android.qualifiers.ApplicationContext
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
    @ApplicationContext private val context: Context,
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
    private val json = Json { prettyPrint = true; ignoreUnknownKeys = true; encodeDefaults = true }

    /**
     * Génère un fichier JSON v3.0 dans le cacheDir et le retourne.
     * [options] permet de ne sélectionner qu'une partie des données.
     * Par défaut, toutes les données sont exportées.
     */
    suspend fun export(options: ExportOptions = ExportOptions.ALL): File = withContext(Dispatchers.IO) {
        // Nettoyage des précédents exports pour ne pas saturer le cacheDir
        context.cacheDir
            .listFiles { f -> f.name.startsWith("pandamove_export_") && f.extension == "json" }
            ?.forEach { it.delete() }

        // ── 1. Templates renforcement ──────────────────────────────────────────
        val exerciseNameMap: Map<Long, String> = exerciseDao.observeAll().first()
            .associateBy({ it.id }, { it.name })

        val strengthTemplates = if (options.strengthTemplates) {
            seanceDao.observeAll().first().mapNotNull { seance ->
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
                    blocs = full.blocs
                        .filter { it.instanceSeanceId == null }
                        .map { b ->
                        BlocDto(
                            id = b.id, seanceId = b.seanceId, nom = b.nom,
                            type = b.type.name, position = b.position, dureeMin = b.dureeMin,
                            description = b.description,
                            tempsReposInterSec = b.tempsReposInterSec,
                            tempsReposFinRoundSec = b.tempsReposFinRoundSec,
                        )
                    },
                    exercices = full.exercices
                        .filter { it.exerciceSeance.instanceSeanceId == null }
                        .map { ex ->
                        val e = ex.exerciceSeance
                        ExerciceDto(
                            id = e.id, seanceId = e.seanceId, exerciceId = e.exerciceId,
                            exerciceName = exerciseNameMap[e.exerciceId] ?: "",
                            blocId = e.blocId, supersetGroupe = e.supersetGroupe,
                            position = e.position, nombreSeriesPrevues = e.nombreSeriesPrevues,
                            repsCibles = e.repsCibles, chargeCible = e.chargeCible,
                            tempo = e.tempo, repsType = e.repsType.name,
                            tempsReposSec = e.tempsReposSec, consigneCle = e.consigneCle,
                            equipement = e.equipement, avertissement = e.avertissement,
                            isBilateral = e.isBilateral,
                            progressionActivee = e.progressionActivee,
                            systemeProgression = e.systemeProgression?.name,
                            repsMin = e.repsMin, repsMax = e.repsMax,
                            incrementKg = e.incrementKg, incrementDureeSec = e.incrementDureeSec,
                            seuilDeload = e.seuilDeload,
                            typeExercice = e.typeExercice?.name, incrementPct = e.incrementPct,
                        )
                    },
                )
            }
        } else emptyList()

        // ── 2. Sessions renforcement (complètes + planifiées) ──────────────────
        val allInstances = instanceSeanceDao.observeAll().first()

        val completedStrengthSessions = mutableListOf<StrengthSessionDto>()
        val plannedStrengthSessions = mutableListOf<StrengthSessionDto>()

        for (inst in allInstances) {
            val include = (inst.isCompleted && options.strengthCompleted) ||
                    (!inst.isCompleted && options.strengthPlanned)
            if (!include) continue

            val withSeries = instanceSeanceDao.getWithSeries(inst.id) ?: continue
            val instanceBlocs = seanceDao.getBlocsForInstance(inst.id)
            val instanceExercices = seanceDao.getExercicesForInstance(inst.id)
            val dto = StrengthSessionDto(
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
                blocs = instanceBlocs.map { b ->
                    BlocDto(
                        id = b.id, seanceId = b.seanceId, nom = b.nom,
                        type = b.type.name, position = b.position, dureeMin = b.dureeMin,
                        description = b.description,
                        tempsReposInterSec = b.tempsReposInterSec,
                        tempsReposFinRoundSec = b.tempsReposFinRoundSec,
                        instanceSeanceId = b.instanceSeanceId,
                    )
                },
                exercices = instanceExercices.map { ex ->
                    val e = ex.exerciceSeance
                    ExerciceDto(
                        id = e.id, seanceId = e.seanceId, exerciceId = e.exerciceId,
                        exerciceName = ex.exercise.name,
                        instanceSeanceId = e.instanceSeanceId,
                        blocId = e.blocId, supersetGroupe = e.supersetGroupe,
                        position = e.position, nombreSeriesPrevues = e.nombreSeriesPrevues,
                        repsCibles = e.repsCibles, chargeCible = e.chargeCible,
                        tempo = e.tempo, repsType = e.repsType.name,
                        tempsReposSec = e.tempsReposSec, consigneCle = e.consigneCle,
                        equipement = e.equipement, avertissement = e.avertissement,
                        isBilateral = e.isBilateral,
                        progressionActivee = e.progressionActivee,
                        systemeProgression = e.systemeProgression?.name,
                        repsMin = e.repsMin, repsMax = e.repsMax,
                        incrementKg = e.incrementKg, incrementDureeSec = e.incrementDureeSec,
                        seuilDeload = e.seuilDeload,
                        typeExercice = e.typeExercice?.name, incrementPct = e.incrementPct,
                    )
                },
            )
            if (inst.isCompleted) completedStrengthSessions.add(dto)
            else plannedStrengthSessions.add(dto)
        }

        val strengthSessions = StrengthSessionsDto(
            completed = completedStrengthSessions,
            planned = plannedStrengthSessions,
        )

        // ── 3. Workouts running / vélo / randonnée ────────────────────────────
        val allWorkouts = workoutDao.observeAll().first()
            .filter { it.workoutType == WorkoutType.RUNNING || it.workoutType == WorkoutType.CYCLING || it.workoutType == WorkoutType.HIKING }

        suspend fun buildRunWorkoutDto(w: com.pandafit.core.database.entities.WorkoutEntity): RunWorkoutDto {
            val repeats = repeatDao.getByWorkout(w.id)
            val steps = stepDao.getByWorkout(w.id)
            val gps = gpsDao.getByWorkout(w.id).sortedBy { it.pointIndex }.map { p ->
                GpsPointDto(index = p.pointIndex, lat = p.latitude, lon = p.longitude, alt = p.altitudeM)
            }
            return RunWorkoutDto(
                workout = WorkoutDto(
                    id = w.id, workoutType = w.workoutType.name, name = w.name,
                    notes = w.notes, objective = w.objective,
                    scheduledDate = w.scheduledDate.toString(),
                    createdAt = w.createdAt.toString(), updatedAt = w.updatedAt.toString(),
                    // Entité non-nullable → toujours true/false, jamais null en v3.0
                    isCompleted = w.isCompleted,
                    completedAt = w.completedAt?.toString(),
                    durationMinutes = w.durationMinutes, tags = w.tags,
                    colorHex = w.colorHex,
                    isTemplate = w.isTemplate,
                    cycleLabel = w.cycleLabel,
                    resultDistanceKm = w.resultDistanceKm,
                    resultDurationSec = w.resultDurationSec,
                    resultPaceAvgMinPerKm = w.resultPaceAvgMinPerKm,
                    resultHrAvg = w.resultHrAvg, resultHrMax = w.resultHrMax,
                    resultRpe = w.resultRpe, resultNotes = w.resultNotes,
                    resultElevationM = w.resultElevationM,
                    withStroller = w.withStroller,
                    resultSpeedAvgKmh = w.resultSpeedAvgKmh,
                    resultSpeedMaxKmh = w.resultSpeedMaxKmh,
                    resultCadenceAvgRpm = w.resultCadenceAvgRpm,
                    resultCalories = w.resultCalories,
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
                gpsPoints = gps,
            )
        }

        val runningWorkouts = allWorkouts.filter { it.workoutType == WorkoutType.RUNNING }
        val cyclingWorkouts = allWorkouts.filter { it.workoutType == WorkoutType.CYCLING }
        val hikingWorkouts  = allWorkouts.filter { it.workoutType == WorkoutType.HIKING }

        val runTemplates = if (options.runningTemplates)
            runningWorkouts.filter { it.isTemplate }.map { buildRunWorkoutDto(it) }
        else emptyList()

        val runSessions = RunSessionsDto(
            completed = if (options.runningCompleted)
                runningWorkouts.filter { !it.isTemplate && it.isCompleted }.map { buildRunWorkoutDto(it) }
            else emptyList(),
            planned = if (options.runningPlanned)
                runningWorkouts.filter { !it.isTemplate && !it.isCompleted }.map { buildRunWorkoutDto(it) }
            else emptyList(),
        )

        val cyclingTemplates = if (options.cyclingTemplates)
            cyclingWorkouts.filter { it.isTemplate }.map { buildRunWorkoutDto(it) }
        else emptyList()

        val cyclingSessions = RunSessionsDto(
            completed = if (options.cyclingCompleted)
                cyclingWorkouts.filter { !it.isTemplate && it.isCompleted }.map { buildRunWorkoutDto(it) }
            else emptyList(),
            planned = if (options.cyclingPlanned)
                cyclingWorkouts.filter { !it.isTemplate && !it.isCompleted }.map { buildRunWorkoutDto(it) }
            else emptyList(),
        )

        val hikingTemplates = if (options.hikingTemplates)
            hikingWorkouts.filter { it.isTemplate }.map { buildRunWorkoutDto(it) }
        else emptyList()

        val hikingSessions = RunSessionsDto(
            completed = if (options.hikingCompleted)
                hikingWorkouts.filter { !it.isTemplate && it.isCompleted }.map { buildRunWorkoutDto(it) }
            else emptyList(),
            planned = if (options.hikingPlanned)
                hikingWorkouts.filter { !it.isTemplate && !it.isCompleted }.map { buildRunWorkoutDto(it) }
            else emptyList(),
        )

        // ── 4. Sessions de respiration ─────────────────────────────────────────
        val breathingSessions = if (options.breathingSessions) {
            breathingSessionDao.observeAll().first().map { s ->
                BreathingSessionDto(
                    id = s.id,
                    methodId = s.methodId,
                    methodName = s.methodName,
                    cyclesCompleted = s.cyclesCompleted,
                    durationSeconds = s.durationSeconds,
                    sessionDate = s.sessionDate.toString(),
                )
            }
        } else emptyList()

        // ── 5. Exercices personnalisés (isCustom = true) ───────────────────────
        val customExercises = if (options.customExercises) {
            exerciseDao.observeAll().first()
                .filter { it.isCustom }
                .map { e ->
                    CustomExerciseDto(
                        id = e.id, name = e.name, description = e.description,
                        category = e.category.name, muscleGroups = e.muscleGroups,
                        exerciseType = e.exerciseType, equipment = e.equipment,
                        musclePrimary = e.musclePrimary,
                    )
                }
        } else emptyList()

        // ── 6. Objectifs de progression (objectif courant par exercice, bible §0.1) ─────
        val objectifsProgression = if (options.objectifsProgression) {
            objectifProgressionDao.observeAll().first().map { o ->
                ObjectifProgressionDto(
                    id = o.id, seanceId = o.seanceId, exerciceId = o.exerciceId,
                    exerciceName = exerciseNameMap[o.exerciceId] ?: "",
                    chargeCible = o.chargeCible, repsCible = o.repsCible,
                    dureeCibleSec = o.dureeCibleSec, compteurEchec = o.compteurEchec,
                    derniereMaj = o.derniereMaj?.toString(),
                )
            }
        } else emptyList()

        // ── 7. Inventaire matériel "Mon matériel" ───────────────────────────────
        val equipmentConfig = if (options.equipmentConfig) {
            val selected = equipmentRepository.selectedEquipment.first()
            val pas = equipmentRepository.pasParCategorie.first()
            val inventaire = equipmentRepository.inventaire.first()
            EquipmentConfigDto(
                selectedCategories = selected.map { it.name },
                pasParCategorie = pas.mapKeys { it.key.name },
                halteres = inventaire.halteres,
                barre = inventaire.barre,
                kettlebell = inventaire.kettlebell,
                cable = inventaire.cable,
            )
        } else null

        // ── Assemblage ────────────────────────────────────────────────────────
        val export = PandaMoveExport(
            version = "3.2",
            exportDate = LocalDateTime.now().toString(),
            strengthTemplates = strengthTemplates,
            strengthSessions = strengthSessions,
            runTemplates = runTemplates,
            runSessions = runSessions,
            cyclingTemplates = cyclingTemplates,
            cyclingSessions = cyclingSessions,
            hikingTemplates = hikingTemplates,
            hikingSessions = hikingSessions,
            breathingSessions = breathingSessions,
            customExercises = customExercises,
            objectifsProgression = objectifsProgression,
            equipmentConfig = equipmentConfig,
        )

        val jsonStr = json.encodeToString(export)
        val fileName = "pandamove_export_${LocalDate.now()}.json"
        val file = File(context.cacheDir, fileName)
        try {
            file.writeText(jsonStr, Charsets.UTF_8)
        } catch (e: Exception) {
            file.delete()
            throw e
        }
        file
    }

    fun buildShareIntent(file: File, mimeType: String = "application/json"): Intent {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, "PandaMove — Export de mes données")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        return Intent.createChooser(send, "Partager l'export PandaMove")
    }

    private fun String.escapeCsv(): String =
        if (contains(';') || contains('"') || contains('\n')) "\"${replace("\"", "\"\"")}\"" else this

    /**
     * Export en masse du catalogue d'exercices (JSON) — indépendant du gros export v3.x,
     * réutilisé par le menu ⋮ de l'écran Catalogue d'exercices.
     */
    suspend fun exportExercisesToJson(): File = withContext(Dispatchers.IO) {
        context.cacheDir
            .listFiles { f -> f.name.startsWith("pandamove_exercises_") && f.extension == "json" }
            ?.forEach { it.delete() }

        val dto = ExerciseCatalogExportDto(
            exportDate = LocalDateTime.now().toString(),
            exercises = exerciseDao.observeAll().first().map { e ->
                CustomExerciseDto(
                    id = e.id, name = e.name, description = e.description,
                    category = e.category.name, muscleGroups = e.muscleGroups,
                    exerciseType = e.exerciseType, equipment = e.equipment,
                    musclePrimary = e.musclePrimary,
                )
            },
        )
        val fileName = "pandamove_exercises_${LocalDate.now()}.json"
        val file = File(context.cacheDir, fileName)
        try {
            file.writeText(json.encodeToString(dto), Charsets.UTF_8)
        } catch (e: Exception) {
            file.delete()
            throw e
        }
        file
    }

    /** Export en masse du catalogue d'exercices (CSV ';'). */
    suspend fun exportExercisesToCsv(): File = withContext(Dispatchers.IO) {
        context.cacheDir
            .listFiles { f -> f.name.startsWith("pandamove_exercises_") && f.extension == "csv" }
            ?.forEach { it.delete() }

        val sb = StringBuilder()
        sb.appendLine("name;category;muscleGroups;equipment;exerciseType;isBodyweight")
        for (e in exerciseDao.observeAll().first()) {
            sb.appendLine(
                "${e.name.escapeCsv()};${e.category.name};${e.muscleGroups.joinToString(",").escapeCsv()};" +
                    "${e.equipment.joinToString(",").escapeCsv()};${e.exerciseType};${e.isBodyweight}",
            )
        }

        val fileName = "pandamove_exercises_${LocalDate.now()}.csv"
        val file = File(context.cacheDir, fileName)
        try {
            file.writeText(sb.toString(), Charsets.UTF_8)
        } catch (e: Exception) {
            file.delete()
            throw e
        }
        file
    }

    /**
     * Export standalone de "Mon matériel" (JSON) — indépendant du gros export v3.x, réutilisé par
     * le bouton d'export de EquipmentScreen. Alimente notamment support/seance-builder.html, qui a
     * besoin de l'inventaire réel pour calculer les charges composables hors de l'app.
     */
    suspend fun exportEquipmentToJson(): File = withContext(Dispatchers.IO) {
        context.cacheDir
            .listFiles { f -> f.name.startsWith("pandamove_equipment_") && f.extension == "json" }
            ?.forEach { it.delete() }

        val selected = equipmentRepository.selectedEquipment.first()
        val pas = equipmentRepository.pasParCategorie.first()
        val inventaire = equipmentRepository.inventaire.first()
        val dto = EquipmentConfigExportDto(
            exportDate = LocalDateTime.now().toString(),
            config = EquipmentConfigDto(
                selectedCategories = selected.map { it.name },
                pasParCategorie = pas.mapKeys { it.key.name },
                halteres = inventaire.halteres,
                barre = inventaire.barre,
                kettlebell = inventaire.kettlebell,
                cable = inventaire.cable,
            ),
        )
        val fileName = "pandamove_equipment_${LocalDate.now()}.json"
        val file = File(context.cacheDir, fileName)
        try {
            file.writeText(json.encodeToString(dto), Charsets.UTF_8)
        } catch (e: Exception) {
            file.delete()
            throw e
        }
        file
    }
}
