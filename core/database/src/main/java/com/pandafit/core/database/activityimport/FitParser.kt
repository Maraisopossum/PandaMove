package com.pandafit.core.database.activityimport

import com.garmin.fit.Decode
import com.garmin.fit.LapMesg
import com.garmin.fit.LapMesgListener
import com.garmin.fit.MesgBroadcaster
import com.garmin.fit.RecordMesg
import com.garmin.fit.RecordMesgListener
import com.garmin.fit.SessionMesg
import com.garmin.fit.SessionMesgListener
import com.garmin.fit.Sport
import com.pandafit.core.database.entities.WorkoutType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Parse un fichier FIT (SDK officiel Garmin, format ouvert aussi utilisé par
 * Suunto/Polar/Wahoo) à partir de ses octets bruts (et non d'un [InputStream] unique,
 * car [Decode.checkIntegrity] et [MesgBroadcaster.run] doivent chacun relire le flux
 * depuis le début).
 * Utilise le premier SessionMesg trouvé pour les totaux, les LapMesg pour les splits,
 * les RecordMesg pour le tracé GPS.
 * Lance [ActivityParseException] si le fichier est invalide ou ne contient aucune session.
 */
suspend fun parseFit(bytes: ByteArray): ParsedActivity = withContext(Dispatchers.IO) {
    val decode = Decode()
    if (!decode.checkFileIntegrity(bytes.inputStream())) {
        throw ActivityParseException("Fichier FIT invalide ou corrompu.")
    }

    val listener = FitListener()
    val broadcaster = MesgBroadcaster(decode)
    broadcaster.addListener(listener as SessionMesgListener)
    broadcaster.addListener(listener as LapMesgListener)
    broadcaster.addListener(listener as RecordMesgListener)
    broadcaster.run(bytes.inputStream())

    listener.buildResult()
}

// ── Listener ──────────────────────────────────────────────────────────────────

private class FitListener : SessionMesgListener, LapMesgListener, RecordMesgListener {

    private var session: SessionMesg? = null
    private val laps = mutableListOf<LapMesg>()
    private val records = mutableListOf<RecordMesg>()

    override fun onMesg(mesg: SessionMesg) {
        if (session == null) session = mesg
    }

    override fun onMesg(mesg: LapMesg) {
        laps.add(mesg)
    }

    override fun onMesg(mesg: RecordMesg) {
        records.add(mesg)
    }

    fun buildResult(): ParsedActivity {
        val s = session ?: throw ActivityParseException("Aucune session trouvée dans le fichier FIT.")

        val workoutType = when (s.sport) {
            Sport.CYCLING, Sport.E_BIKING -> WorkoutType.CYCLING
            Sport.HIKING, Sport.WALKING, Sport.MOUNTAINEERING -> WorkoutType.HIKING
            else -> WorkoutType.RUNNING
        }

        val avgCadence = if (workoutType == WorkoutType.RUNNING) {
            s.avgRunningCadence?.let { it.toInt() * 2 } ?: s.avgCadence?.toInt()
        } else {
            s.avgCadence?.toInt()
        }

        val trackPoints = records.mapNotNull { r ->
            val lat = r.positionLat?.let { semicirclesToDegrees(it) } ?: return@mapNotNull null
            val lon = r.positionLong?.let { semicirclesToDegrees(it) } ?: return@mapNotNull null
            ParsedTrackPoint(
                latitude    = lat,
                longitude   = lon,
                altitudeM   = (r.enhancedAltitude ?: r.altitude)?.toDouble(),
                timestampMs = r.timestamp?.date?.time,
                speedMs     = (r.enhancedSpeed ?: r.speed)?.toDouble(),
            )
        }

        val parsedLaps = laps.map { lap ->
            ParsedLap(
                durationSec   = (lap.totalElapsedTime ?: 0f).toDouble(),
                distanceM     = (lap.totalDistance ?: 0f).toDouble(),
                avgHrBpm      = lap.avgHeartRate?.toInt(),
                maxHrBpm      = lap.maxHeartRate?.toInt(),
                calories      = lap.totalCalories ?: 0,
                maxSpeedMs    = lap.maxSpeed?.toDouble(),
                avgCadenceRpm = lap.avgCadence?.toInt(),
            )
        }

        return ParsedActivity(
            sourceFormat   = ActivityFileFormat.FIT,
            sportRaw       = s.sport?.name ?: "RUNNING",
            workoutType    = workoutType,
            startTime      = (s.startTime?.date ?: s.timestamp?.date)?.toInstant()?.toString() ?: "",
            totalDistanceM = (s.totalDistance ?: 0f).toDouble(),
            totalDurationSec = (s.totalElapsedTime ?: 0f).toDouble(),
            totalCalories  = s.totalCalories ?: 0,
            avgHrBpm       = s.avgHeartRate?.toInt(),
            maxHrBpm       = s.maxHeartRate?.toInt(),
            maxSpeedMs     = s.maxSpeed?.toDouble(),
            avgCadenceRpm  = avgCadence,
            elevationGainM = s.totalAscent,
            laps           = parsedLaps,
            rawTrackPoints = trackPoints,
        )
    }
}

/** Convertit des semicircles (unité FIT pour lat/lon) en degrés décimaux. */
private fun semicirclesToDegrees(semicircles: Int): Double = semicircles * (180.0 / 2147483648.0)
