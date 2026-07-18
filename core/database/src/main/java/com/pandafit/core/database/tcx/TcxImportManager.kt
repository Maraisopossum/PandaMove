package com.pandafit.core.database.tcx

import com.pandafit.core.database.dao.GpsTrackPointDao
import com.pandafit.core.database.dao.RunRepeatDao
import com.pandafit.core.database.dao.RunStepDao
import com.pandafit.core.database.dao.WorkoutDao
import com.pandafit.core.database.entities.GpsTrackPointEntity
import com.pandafit.core.database.entities.RunEndType
import com.pandafit.core.database.entities.RunEndUnit
import com.pandafit.core.database.entities.RunRepeatEntity
import com.pandafit.core.database.entities.RunStepEntity
import com.pandafit.core.database.entities.RunStepType
import com.pandafit.core.database.entities.RunTargetType
import com.pandafit.core.database.entities.WorkoutEntity
import com.pandafit.core.database.entities.WorkoutSource
import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.core.database.model.IntervalRepResult
import dagger.hilt.android.scopes.ViewModelScoped
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.InputStream
import java.time.LocalDate
import java.time.LocalDateTime
import kotlin.math.round
import java.time.ZonedDateTime
import java.time.format.DateTimeParseException
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Résultat d'un import TCX.
 * [workoutId] est l'ID du workout créé ou mis à jour.
 */
data class TcxImportResult(
    val workoutId: Long,
    val workoutType: WorkoutType,
    val lapsImported: Int,
    val gpsPointsImported: Int,
    /** true = nouveau workout créé, false = workout existant mis à jour */
    val isNewWorkout: Boolean,
)

@Singleton
class TcxImportManager @Inject constructor(
    private val workoutDao: WorkoutDao,
    private val repeatDao: RunRepeatDao,
    private val stepDao: RunStepDao,
    private val gpsDao: GpsTrackPointDao,
) {
    private val json = Json { ignoreUnknownKeys = true }

    // ── 1. Parse only (no DB write) ───────────────────────────────────────────

    /**
     * Parse le fichier TCX et retourne les données brutes.
     * Aucune écriture en base. Appeler depuis le ViewModel pour afficher
     * un aperçu avant confirmation.
     */
    suspend fun parse(stream: InputStream): TcxParsedActivity = parseTcx(stream)

    // ── 2a. Import as a brand-new free session ────────────────────────────────

    /**
     * Crée un nouveau workout (séance libre) à partir d'une activité TCX.
     *
     * @param activity   Activité parsée.
     * @param date       Date à assigner (par défaut : extraite du TCX, sinon aujourd'hui).
     * @param type       Type de sport — permet à l'utilisateur de corriger si mal détecté.
     * @param name       Nom du workout.
     */
    suspend fun importAsNew(
        activity: TcxParsedActivity,
        date: LocalDate = activity.startTimeAsDate(),
        type: WorkoutType = activity.workoutType,
        name: String = activity.defaultName(),
        withStroller: Boolean = false,
    ): TcxImportResult = withContext(Dispatchers.IO) {

        val now = LocalDateTime.now()
        val completedAt = activity.startTimeAsDateTime() ?: now

        val distKm = round(activity.totalDistanceM / 1000.0 * 100) / 100.0
        val durSec = activity.totalDurationSec.toInt()
        val isSpeedBased = type == WorkoutType.CYCLING || type == WorkoutType.HIKING

        val workoutId = workoutDao.insert(
            WorkoutEntity(
                workoutType           = type,
                name                  = name,
                scheduledDate         = date,
                isCompleted           = true,
                completedAt           = completedAt,
                createdAt             = now,
                updatedAt             = now,
                resultDistanceKm      = distKm,
                resultDurationSec     = durSec,
                resultPaceAvgMinPerKm = if (!isSpeedBased) activity.avgPaceMinPerKm() else null,
                resultHrAvg           = activity.avgHrBpm,
                resultHrMax           = activity.maxHrBpm,
                resultElevationM      = activity.elevationGainM,
                resultSpeedAvgKmh     = if (isSpeedBased) activity.avgSpeedKmh() else null,
                resultSpeedMaxKmh     = if (type == WorkoutType.CYCLING) activity.maxSpeedMs?.let { it * 3.6 } else null,
                resultCadenceAvgRpm   = activity.avgCadenceRpm,
                resultCalories        = activity.totalCalories.takeIf { it > 0 },
                withStroller          = withStroller,
                source                = WorkoutSource.TCX_IMPORT,
            )
        )

        val gpsCount = insertGpsTrack(workoutId, activity.rawTrackPoints)
        val lapsCount = insertLapSplits(workoutId, activity.laps, type == WorkoutType.CYCLING)

        TcxImportResult(workoutId, type, lapsCount, gpsCount, isNewWorkout = true)
    }

    // ── 2b. Import into an existing planned session ───────────────────────────

    /**
     * Remplit les résultats d'un workout existant (séance programmée) depuis un TCX.
     * Les résultats globaux et les splits sont écrasés.
     * Le tracé GPS est ajouté (le précédent est supprimé d'abord).
     *
     * @param type  Si non null, permet de forcer le type (ex : correction running/cycling).
     */
    suspend fun importIntoExisting(
        activity: TcxParsedActivity,
        workoutId: Long,
        type: WorkoutType? = null,
        withStroller: Boolean = false,
    ): TcxImportResult = withContext(Dispatchers.IO) {

        val completedAt = activity.startTimeAsDateTime() ?: LocalDateTime.now()

        // Déterminer le type de la séance pour choisir le bon schéma de résultats
        val existingWorkout = workoutDao.getById(workoutId)
        val effectiveType = type ?: existingWorkout?.workoutType
        val isCycling = effectiveType == WorkoutType.CYCLING
        val isSpeedBased = isCycling || effectiveType == WorkoutType.HIKING
        val distKm = round(activity.totalDistanceM / 1000.0 * 100) / 100.0
        val durSec = activity.totalDurationSec.toInt()

        if (isCycling) {
            workoutDao.saveCyclingResults(
                id          = workoutId,
                distKm      = distKm,
                durSec      = durSec,
                speedAvg    = activity.avgSpeedKmh(),
                speedMax    = activity.maxSpeedMs?.let { it * 3.6 },
                hr          = activity.avgHrBpm,
                hrMax       = activity.maxHrBpm,
                cadence     = activity.avgCadenceRpm,
                elevationM  = activity.elevationGainM,
                calories    = activity.totalCalories.takeIf { it > 0 },
                rpe         = null,
                notes       = "",
                completedAt = completedAt.toString(),
            )
        } else {
            workoutDao.saveResults(
                id          = workoutId,
                distKm      = distKm,
                durSec      = durSec,
                pace        = if (!isSpeedBased) activity.avgPaceMinPerKm() else null,
                hr          = activity.avgHrBpm,
                hrMax       = activity.maxHrBpm,
                rpe         = null,
                notes       = "",
                elevationM  = activity.elevationGainM,
                cadence     = activity.avgCadenceRpm,
                calories    = activity.totalCalories.takeIf { it > 0 },
                completedAt = completedAt.toString(),
            )
        }

        // Delete old GPS track and insert new one
        gpsDao.deleteByWorkout(workoutId)
        val gpsCount = insertGpsTrack(workoutId, activity.rawTrackPoints)

        // Inject lap splits into the first repeat found (or create one if none)
        val lapsCount = insertOrUpdateLapSplits(workoutId, activity.laps, isCycling)

        // Mise à jour withStroller sur l'entité après saveResults
        workoutDao.getById(workoutId)?.let { existing ->
            workoutDao.update(existing.copy(withStroller = withStroller, updatedAt = LocalDateTime.now(), source = WorkoutSource.TCX_IMPORT))
        }

        TcxImportResult(workoutId, effectiveType ?: WorkoutType.RUNNING, lapsCount, gpsCount, isNewWorkout = false)
    }

    // ── GPS track insertion with Douglas-Peucker ──────────────────────────────

    private suspend fun insertGpsTrack(workoutId: Long, rawPoints: List<TcxRawPoint>): Int {
        if (rawPoints.isEmpty()) return 0
        val simplified = douglasPeucker(rawPoints, epsilonDegrees = 0.000045) // ~5 m
        val entities = simplified.mapIndexed { idx, p ->
            GpsTrackPointEntity(
                workoutId   = workoutId,
                pointIndex  = idx,
                latitude    = p.latitude,
                longitude   = p.longitude,
                altitudeM   = p.altitudeM,
                timestampMs = p.timestampMs ?: 0L,
                speedMps    = p.speedMs?.toFloat(),
            )
        }
        gpsDao.insertAll(entities)
        return entities.size
    }

    // ── Lap splits as a RunRepeatEntity with IntervalRepResults ───────────────

    private suspend fun insertLapSplits(workoutId: Long, laps: List<TcxLap>, isCycling: Boolean = false): Int {
        if (laps.isEmpty()) return 0
        val results = laps.mapIndexed { i, lap -> lap.toIntervalRepResult(i, isCycling) }
        val repeatId = repeatDao.insert(
            RunRepeatEntity(
                workoutId   = workoutId,
                position    = 0,
                repeatCount = laps.size,
                resultsJson = json.encodeToString(results),
                // Splits kilométriques auto-lap de la montre, pas un fractionné construit dans l'app
                isAutoLap   = true,
            )
        )
        // Create one RunStepEntity per lap so the UI can display it as structured steps
        val stepType = if (isCycling) RunStepType.OTHER else RunStepType.RUNNING
        stepDao.insertAll(laps.mapIndexed { i, lap ->
            RunStepEntity(
                workoutId  = workoutId,
                repeatId   = repeatId,
                position   = i,
                stepType   = stepType,
                endType    = RunEndType.DISTANCE,
                endValue   = lap.distanceM.toInt().coerceAtLeast(1),
                endUnit    = RunEndUnit.METERS,
                targetType = RunTargetType.NONE,
            )
        })
        return laps.size
    }

    /**
     * Pour une séance programmée : met à jour le premier repeat trouvé avec les splits TCX.
     * Si aucun repeat n'existe, en crée un.
     */
    private suspend fun insertOrUpdateLapSplits(workoutId: Long, laps: List<TcxLap>, isCycling: Boolean = false): Int {
        if (laps.isEmpty()) return 0
        val results = laps.mapIndexed { i, lap -> lap.toIntervalRepResult(i, isCycling) }
        val existingRepeats = repeatDao.getByWorkout(workoutId)
        if (existingRepeats.isNotEmpty()) {
            val rep = existingRepeats.first()
            repeatDao.update(rep.copy(resultsJson = json.encodeToString(results)))
        } else {
            insertLapSplits(workoutId, laps, isCycling)
        }
        return laps.size
    }
}

// ── Douglas-Peucker ───────────────────────────────────────────────────────────

/**
 * Simplifie une polyligne GPS par l'algorithme de Ramer-Douglas-Peucker.
 * [epsilonDegrees] est la tolérance en degrés décimaux (~0.000045° ≈ 5 m à la latitude de Paris).
 */
internal fun douglasPeucker(points: List<TcxRawPoint>, epsilonDegrees: Double): List<TcxRawPoint> {
    if (points.size <= 2) return points
    val result = BooleanArray(points.size) { false }
    result[0] = true
    result[points.lastIndex] = true
    dpRecurse(points, result, 0, points.lastIndex, epsilonDegrees)
    return points.filterIndexed { i, _ -> result[i] }
}

private fun dpRecurse(
    pts: List<TcxRawPoint>,
    keep: BooleanArray,
    start: Int,
    end: Int,
    eps: Double,
) {
    if (end - start < 2) return
    val s = pts[start]; val e = pts[end]
    var maxDist = 0.0
    var maxIdx = start
    for (i in start + 1 until end) {
        val d = perpendicularDistanceDeg(pts[i], s, e)
        if (d > maxDist) { maxDist = d; maxIdx = i }
    }
    if (maxDist > eps) {
        keep[maxIdx] = true
        dpRecurse(pts, keep, start, maxIdx, eps)
        dpRecurse(pts, keep, maxIdx, end, eps)
    }
}

/** Distance perpendiculaire point-à-segment en degrés décimaux (approximation plane). */
private fun perpendicularDistanceDeg(p: TcxRawPoint, a: TcxRawPoint, b: TcxRawPoint): Double {
    val dx = b.longitude - a.longitude
    val dy = b.latitude - a.latitude
    val lenSq = dx * dx + dy * dy
    if (lenSq == 0.0) {
        val ex = p.longitude - a.longitude
        val ey = p.latitude - a.latitude
        return Math.sqrt(ex * ex + ey * ey)
    }
    val t = ((p.longitude - a.longitude) * dx + (p.latitude - a.latitude) * dy) / lenSq
    val projX = a.longitude + t * dx
    val projY = a.latitude + t * dy
    val ex = p.longitude - projX
    val ey = p.latitude - projY
    return Math.sqrt(ex * ex + ey * ey)
}

// ── Extension helpers ─────────────────────────────────────────────────────────

private fun TcxParsedActivity.startTimeAsDate(): LocalDate =
    try { ZonedDateTime.parse(startTime).toLocalDate() }
    catch (_: DateTimeParseException) { LocalDate.now() }
    catch (_: Exception) { LocalDate.now() }

private fun TcxParsedActivity.startTimeAsDateTime(): LocalDateTime? =
    try { ZonedDateTime.parse(startTime).toLocalDateTime() }
    catch (_: Exception) { null }

private fun TcxParsedActivity.avgPaceMinPerKm(): Double? {
    if (totalDistanceM < 1.0) return null
    return (totalDurationSec / 60.0) / (totalDistanceM / 1000.0)
}

private fun TcxParsedActivity.avgSpeedKmh(): Double? {
    if (totalDistanceM < 1.0 || totalDurationSec <= 0.0) return null
    val kmh = (totalDistanceM / 1000.0) / (totalDurationSec / 3600.0)
    return (kmh * 10).toLong() / 10.0 // arrondi à 1 décimale
}

fun TcxParsedActivity.defaultName(): String = defaultNameForType(workoutType)

/**
 * Nom par défaut pour un [type] donné — distinct de [workoutType] (le sport détecté du fichier)
 * pour permettre de recalculer le nom quand l'utilisateur corrige le sport dans l'aperçu d'import
 * (cf. [com.pandafit.feature.profile.viewmodel.TcxImportViewModel.updateType]), sans quoi le nom
 * garde l'intitulé de l'ancien sport (ex. "Course du ..." sur une séance reclassée en randonnée).
 */
fun TcxParsedActivity.defaultNameForType(type: WorkoutType): String {
    val date = startTimeAsDate()
    return when (type) {
        WorkoutType.RUNNING -> "Course du $date"
        WorkoutType.CYCLING -> "Vélo du $date"
        WorkoutType.HIKING  -> "Sortie du $date"
        else                -> "Séance du $date"
    }
}

private fun TcxLap.toIntervalRepResult(index: Int, isCycling: Boolean = false): IntervalRepResult {
    val intensity = if (isCycling) {
        if (distanceM > 1.0 && durationSec > 0.0) {
            val speedKmh = (distanceM / 1000.0) / (durationSec / 3600.0)
            "%.1f km/h".format(speedKmh)
        } else ""
    } else {
        val paceMinKm = if (distanceM > 1.0) (durationSec / 60.0) / (distanceM / 1000.0) else null
        if (paceMinKm != null) formatPaceMinKm(paceMinKm) else ""
    }
    return IntervalRepResult(
        repNumber       = index + 1,
        timeStr         = formatDurationSec(durationSec.toInt()),
        actualIntensity = intensity,
        rpeStr          = "",
        done            = true,
        runningDone     = true,
        hrAvg           = avgHrBpm,
        hrMax           = maxHrBpm,
        distanceM       = distanceM,
        durationSec     = durationSec,
    )
}

private fun formatDurationSec(totalSec: Int): String {
    val h = totalSec / 3600
    val m = (totalSec % 3600) / 60
    val s = totalSec % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

private fun formatPaceMinKm(paceMinKm: Double): String {
    val min = paceMinKm.toInt()
    val sec = ((paceMinKm - min) * 60).toInt()
    return "$min:${sec.toString().padStart(2, '0')}/km"
}
