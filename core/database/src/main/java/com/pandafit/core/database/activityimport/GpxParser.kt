package com.pandafit.core.database.activityimport

import com.pandafit.core.database.entities.WorkoutType
import com.pandafit.core.database.util.evaluateElevationSample
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.xml.sax.Attributes
import org.xml.sax.helpers.DefaultHandler
import java.io.InputStream
import javax.xml.parsers.SAXParserFactory
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Parse un fichier GPX depuis un [InputStream].
 * Contrairement au TCX, le GPX ne fournit pas de totaux ni de laps natifs : distance/durée/
 * dénivelé sont recalculés depuis les trackpoints. HR/cadence proviennent de l'extension Garmin
 * `gpxtpx:TrackPointExtension` si présente, sinon restent `null`.
 * Lance [ActivityParseException] si le fichier est invalide ou ne contient aucun trackpoint.
 */
suspend fun parseGpx(stream: InputStream): ParsedActivity = withContext(Dispatchers.IO) {
    val handler = GpxSaxHandler()
    SAXParserFactory.newInstance().newSAXParser().parse(stream, handler)
    handler.buildResult()
}

// ── SAX handler ───────────────────────────────────────────────────────────────

private class GpxSaxHandler : DefaultHandler() {

    private val path = ArrayDeque<String>()
    private val text = StringBuilder()

    private var trackName: String? = null
    private var trackType: String? = null

    private val trackPoints = mutableListOf<ParsedTrackPoint>()
    private var tpLat: Double? = null
    private var tpLon: Double? = null
    private var tpAlt: Double? = null
    private var tpTimeMs: Long? = null
    private var tpHr: Int? = null
    private var tpCad: Int? = null

    private val hrSamples = mutableListOf<Int>()
    private val cadSamples = mutableListOf<Int>()

    override fun startElement(uri: String?, localName: String?, qName: String?, atts: Attributes?) {
        val tag = (qName ?: localName ?: return).substringAfterLast(':')
        path.addLast(tag)
        text.clear()

        if (tag == "trkpt") {
            tpLat = atts?.getValue("lat")?.toDoubleOrNull()
            tpLon = atts?.getValue("lon")?.toDoubleOrNull()
            tpAlt = null; tpTimeMs = null; tpHr = null; tpCad = null
        }
    }

    override fun characters(ch: CharArray?, start: Int, length: Int) {
        ch?.let { text.append(String(it, start, length)) }
    }

    override fun endElement(uri: String?, localName: String?, qName: String?) {
        val tag = (qName ?: localName ?: return).substringAfterLast(':')
        val value = text.toString().trim()

        when {
            tag == "name" && inTrk() && !inTrkpt() -> trackName = value.ifBlank { null }
            tag == "type" && inTrk() && !inTrkpt() -> trackType = value.ifBlank { null }
            tag == "ele" && inTrkpt() -> tpAlt = value.toDoubleOrNull()
            tag == "time" && inTrkpt() -> tpTimeMs = parseIsoInstantMs(value)
            // Extension Garmin gpxtpx:hr / gpxtpx:cad (le préfixe est déjà retiré par substringAfterLast)
            tag == "hr" && inTrkpt() -> tpHr = value.toIntOrNull()
            tag == "cad" && inTrkpt() -> tpCad = value.toIntOrNull()
            tag == "trkpt" -> commitTrackpoint()
        }

        path.removeLastOrNull()
        text.clear()
    }

    private fun commitTrackpoint() {
        val lat = tpLat ?: return
        val lon = tpLon ?: return
        trackPoints.add(ParsedTrackPoint(lat, lon, tpAlt, tpTimeMs, speedMs = null))
        tpHr?.let { hrSamples.add(it) }
        tpCad?.let { cadSamples.add(it) }
    }

    private fun inTrk() = path.contains("trk")
    private fun inTrkpt() = path.contains("trkpt")

    fun buildResult(): ParsedActivity {
        if (trackPoints.isEmpty()) throw ActivityParseException("Aucun point GPS trouvé dans le fichier GPX.")

        // Garmin Connect utilise des libellés composés (ex. "road_biking", "mountain_biking",
        // "trail_running") plutôt que des valeurs figées → matching par sous-chaîne, pas égalité stricte.
        val type = trackType?.lowercase() ?: ""
        val workoutType = when {
            type.contains("bik") || type.contains("cycl") -> WorkoutType.CYCLING
            type.contains("hik") || type.contains("walk") || type.contains("mountaineer") -> WorkoutType.HIKING
            else -> WorkoutType.RUNNING
        }

        val totalDistanceM = computeTotalDistance(trackPoints)
        val firstTime = trackPoints.firstNotNullOfOrNull { it.timestampMs }
        val lastTime = trackPoints.lastOrNull { it.timestampMs != null }?.timestampMs
        val totalDurationSec = if (firstTime != null && lastTime != null && lastTime > firstTime) {
            (lastTime - firstTime) / 1000.0
        } else 0.0

        val avgHr = if (hrSamples.isNotEmpty()) hrSamples.average().toInt() else null
        val maxHr = hrSamples.maxOrNull()
        // Extension Garmin gpxtpx:cad : pas/min d'une seule jambe en course à pied (comme TCX
        // AvgRunCadence) → ×2 pour la cadence totale, cohérent avec TCX/FIT. En vélo, déjà en rpm.
        val avgCadence = if (cadSamples.isNotEmpty()) {
            val raw = cadSamples.average().toInt()
            if (workoutType == WorkoutType.RUNNING) raw * 2 else raw
        } else null
        val elevationGain = computeElevationGain(trackPoints)
        val maxSpeedMs = computeMaxSpeed(trackPoints)
        val startTime = firstTime?.let { java.time.Instant.ofEpochMilli(it).toString() } ?: ""

        return ParsedActivity(
            sourceFormat   = ActivityFileFormat.GPX,
            sportRaw       = trackType ?: "Running",
            workoutType    = workoutType,
            startTime      = startTime,
            totalDistanceM = totalDistanceM,
            totalDurationSec = totalDurationSec,
            totalCalories  = 0,
            avgHrBpm       = avgHr,
            maxHrBpm       = maxHr,
            maxSpeedMs     = maxSpeedMs,
            avgCadenceRpm  = avgCadence,
            elevationGainM = elevationGain,
            laps           = emptyList(),
            rawTrackPoints = trackPoints.toList(),
        )
    }
}

// ── Distance / vitesse dérivées ───────────────────────────────────────────────

private fun computeTotalDistance(points: List<ParsedTrackPoint>): Double {
    var total = 0.0
    for (i in 1 until points.size) {
        total += haversineMeters(points[i - 1].latitude, points[i - 1].longitude, points[i].latitude, points[i].longitude)
    }
    return total
}

private fun computeMaxSpeed(points: List<ParsedTrackPoint>): Double? {
    var maxSpeed: Double? = null
    for (i in 1 until points.size) {
        val a = points[i - 1]; val b = points[i]
        val t1 = a.timestampMs ?: continue
        val t2 = b.timestampMs ?: continue
        val dtSec = (t2 - t1) / 1000.0
        if (dtSec <= 0.0) continue
        val distM = haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude)
        val speed = distM / dtSec
        if (maxSpeed == null || speed > maxSpeed!!) maxSpeed = speed
    }
    return maxSpeed
}

private fun haversineMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
    val r = 6371000.0
    val dLat = Math.toRadians(lat2 - lat1)
    val dLon = Math.toRadians(lon2 - lon1)
    val a = sin(dLat / 2) * sin(dLat / 2) +
        cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2) * sin(dLon / 2)
    val c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return r * c
}

/** Même filtre anti-bruit que le tracking live/TCX (voir [evaluateElevationSample]). */
private fun computeElevationGain(points: List<ParsedTrackPoint>): Int? {
    val altitudes = points.mapNotNull { it.altitudeM }
    if (altitudes.size < 2) return null
    var baseline: Double? = null
    var gain = 0
    for (alt in altitudes) {
        val step = evaluateElevationSample(baseline, alt)
        baseline = step.newBaselineM
        gain += step.gainDeltaM
    }
    return gain.takeIf { it >= 0 }
}
