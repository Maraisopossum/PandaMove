package com.pandafit.core.database.tcx

import com.pandafit.core.database.entities.WorkoutType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.xml.sax.Attributes
import org.xml.sax.helpers.DefaultHandler
import java.io.InputStream
import javax.xml.parsers.SAXParserFactory

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Parse un fichier TCX Garmin depuis un [InputStream].
 * Retourne la première activité trouvée (Garmin n'en exporte qu'une par fichier).
 * Lance [TcxParseException] si le fichier est invalide ou ne contient aucune activité.
 */
suspend fun parseTcx(stream: InputStream): TcxParsedActivity = withContext(Dispatchers.IO) {
    val handler = TcxSaxHandler()
    SAXParserFactory.newInstance().newSAXParser().parse(stream, handler)
    handler.buildResult()
}

class TcxParseException(message: String) : Exception(message)

// ── SAX handler ───────────────────────────────────────────────────────────────

private class TcxSaxHandler : DefaultHandler() {

    // ── Current element path (lightweight stack) ──────────────────────────────
    private val path = ArrayDeque<String>()
    private val text = StringBuilder()

    // ── Activity-level ─────────────────────────────────────────────────────────
    private var sport: String = "Running"
    private var activityId: String = ""

    // ── Current lap accumulator ───────────────────────────────────────────────
    private val laps = mutableListOf<TcxLap>()
    private var lapDurationSec = 0.0
    private var lapDistanceM = 0.0
    private var lapCalories = 0
    private var lapAvgHr: Int? = null
    private var lapMaxHr: Int? = null
    private var lapMaxSpeedMs: Double? = null
    private var lapCadence: Int? = null
    private var inLapAvgHr = false
    private var inLapMaxHr = false

    // ── Trackpoint accumulator ────────────────────────────────────────────────
    private val trackPoints = mutableListOf<TcxRawPoint>()
    private var tpLat: Double? = null
    private var tpLon: Double? = null
    private var tpAlt: Double? = null
    private var inTpHr = false
    private var inPosition = false

    // ── Aggregated HR/speed/cadence across laps ───────────────────────────────
    private var totalAvgHrSum = 0.0
    private var lapCountWithHr = 0
    private var globalMaxHr: Int? = null
    private var globalMaxSpeedMs: Double? = null
    private var totalCadenceSum = 0
    private var lapCountWithCadence = 0

    // ── Global totals from Lap elements ──────────────────────────────────────
    private var totalDistanceM = 0.0
    private var totalDurationSec = 0.0
    private var totalCalories = 0

    // ── SAX events ────────────────────────────────────────────────────────────

    override fun startElement(uri: String?, localName: String?, qName: String?, atts: Attributes?) {
        val tag = (qName ?: localName ?: return).substringAfterLast(':')
        path.addLast(tag)
        text.clear()

        when {
            tag == "Activity" -> {
                sport = atts?.getValue("Sport") ?: "Running"
            }
            tag == "Lap" -> {
                // Reset lap accumulators
                lapDurationSec = 0.0
                lapDistanceM = 0.0
                lapCalories = 0
                lapAvgHr = null
                lapMaxHr = null
                lapMaxSpeedMs = null
                lapCadence = null
                inLapAvgHr = false
                inLapMaxHr = false
            }
            tag == "Trackpoint" -> {
                tpLat = null; tpLon = null; tpAlt = null
                inTpHr = false
            }
            tag == "Position" -> inPosition = true
            // Disambiguate HR containers: AverageHeartRateBpm vs MaximumHeartRateBpm in Lap context
            tag == "AverageHeartRateBpm" && inLap() -> inLapAvgHr = true
            tag == "MaximumHeartRateBpm" && inLap() -> inLapMaxHr = true
            tag == "HeartRateBpm" && inTrackpoint() -> inTpHr = true
        }
    }

    override fun characters(ch: CharArray?, start: Int, length: Int) {
        ch?.let { text.append(String(it, start, length)) }
    }

    override fun endElement(uri: String?, localName: String?, qName: String?) {
        val tag = (qName ?: localName ?: return).substringAfterLast(':')
        val value = text.toString().trim()

        when {
            // ── Activity Id ──────────────────────────────────────────────────
            tag == "Id" && inActivity() && !inLap() -> activityId = value

            // ── Lap fields ──────────────────────────────────────────────────
            tag == "TotalTimeSeconds" && inLap() -> lapDurationSec = value.toDoubleOrNull() ?: 0.0
            tag == "DistanceMeters" && inLap() && !inTrackpoint() -> lapDistanceM = value.toDoubleOrNull() ?: 0.0
            tag == "Calories" && inLap() -> lapCalories = value.toIntOrNull() ?: 0
            tag == "AverageHeartRateBpm" && inLap() -> inLapAvgHr = false
            tag == "MaximumHeartRateBpm" && inLap() -> inLapMaxHr = false
            tag == "Value" && inLap() && !inTrackpoint() -> {
                val v = value.toIntOrNull()
                when {
                    inLapAvgHr -> lapAvgHr = v
                    inLapMaxHr -> lapMaxHr = v
                }
            }

            // ── Lap fields (vitesse max + cadence) ──────────────────────────
            tag == "MaximumSpeed" && inLap() -> lapMaxSpeedMs = value.toDoubleOrNull()
            // Garmin cycling: <Cadence> au niveau Lap = cadence moy en rpm
            tag == "Cadence" && inLap() && !inTrackpoint() -> lapCadence = value.toIntOrNull()
            // Garmin extensions: AvgRunCadence (strides/min → ×2 pour PPM) ou AvgBikeCadence (RPM)
            tag == "AvgRunCadence" && inLap() ->
                if (lapCadence == null) lapCadence = value.toIntOrNull()?.let { it * 2 }
            tag == "AvgBikeCadence" && inLap() ->
                if (lapCadence == null) lapCadence = value.toIntOrNull()

            // ── Lap end: commit ──────────────────────────────────────────────
            tag == "Lap" -> commitLap()

            // ── Trackpoint fields ────────────────────────────────────────────
            tag == "LatitudeDegrees" -> tpLat = value.toDoubleOrNull()
            tag == "LongitudeDegrees" -> tpLon = value.toDoubleOrNull()
            tag == "AltitudeMeters" && inTrackpoint() -> tpAlt = value.toDoubleOrNull()
            tag == "Position" -> inPosition = false
            tag == "HeartRateBpm" && inTrackpoint() -> inTpHr = false
            // HeartRateBpm Value inside trackpoint — we don't store it per-point, ignore

            // ── Trackpoint end: commit ────────────────────────────────────────
            tag == "Trackpoint" -> commitTrackpoint()
        }

        path.removeLastOrNull()
        text.clear()
    }

    // ── Commit helpers ─────────────────────────────────────────────────────────

    private fun commitLap() {
        laps.add(TcxLap(lapDurationSec, lapDistanceM, lapAvgHr, lapMaxHr, lapCalories, lapMaxSpeedMs, lapCadence))
        totalDurationSec += lapDurationSec
        totalDistanceM += lapDistanceM
        totalCalories += lapCalories
        lapAvgHr?.let { totalAvgHrSum += it; lapCountWithHr++ }
        lapMaxHr?.let { if (globalMaxHr == null || it > globalMaxHr!!) globalMaxHr = it }
        lapMaxSpeedMs?.let { if (globalMaxSpeedMs == null || it > globalMaxSpeedMs!!) globalMaxSpeedMs = it }
        lapCadence?.let { totalCadenceSum += it; lapCountWithCadence++ }
    }

    private fun commitTrackpoint() {
        val lat = tpLat ?: return
        val lon = tpLon ?: return
        trackPoints.add(TcxRawPoint(lat, lon, tpAlt))
    }

    // ── Path helpers ──────────────────────────────────────────────────────────

    private fun inActivity() = path.contains("Activity")
    private fun inLap() = path.contains("Lap")
    private fun inTrackpoint() = path.contains("Trackpoint")

    // ── Build result ──────────────────────────────────────────────────────────

    fun buildResult(): TcxParsedActivity {
        if (laps.isEmpty()) throw TcxParseException("Aucune activité trouvée dans le fichier TCX.")

        val workoutType = when (sport.lowercase()) {
            "biking", "cycling" -> WorkoutType.CYCLING
            else                -> WorkoutType.RUNNING
        }

        // Global avg HR: prefer per-lap average if available, otherwise null
        val avgHr = if (lapCountWithHr > 0) (totalAvgHrSum / lapCountWithHr).toInt() else null

        // Elevation gain from trackpoints
        val elevationGain = computeElevationGain(trackPoints)

        val avgCadence = if (lapCountWithCadence > 0) (totalCadenceSum / lapCountWithCadence) else null

        return TcxParsedActivity(
            sportRaw       = sport,
            workoutType    = workoutType,
            startTime      = activityId,
            totalDistanceM = totalDistanceM,
            totalDurationSec = totalDurationSec,
            totalCalories  = totalCalories,
            avgHrBpm       = avgHr,
            maxHrBpm       = globalMaxHr,
            maxSpeedMs     = globalMaxSpeedMs,
            avgCadenceRpm  = avgCadence,
            elevationGainM = elevationGain,
            laps           = laps.toList(),
            rawTrackPoints = trackPoints.toList(),
        )
    }
}

// ── Elevation gain ────────────────────────────────────────────────────────────

private fun computeElevationGain(points: List<TcxRawPoint>): Int? {
    val altitudes = points.mapNotNull { it.altitudeM }
    if (altitudes.size < 2) return null
    var gain = 0.0
    for (i in 1 until altitudes.size) {
        val diff = altitudes[i] - altitudes[i - 1]
        if (diff > 0.0) gain += diff
    }
    return gain.toInt().takeIf { it >= 0 }
}
