package com.pandafit.core.database.activityimport

import com.pandafit.core.database.entities.WorkoutType
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream

private const val SAMPLE_GPX = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Strava" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Course du matin</name>
    <type>running</type>
    <trkseg>
      <trkpt lat="48.8566" lon="2.3522">
        <ele>35.0</ele>
        <time>2026-07-10T08:00:00Z</time>
      </trkpt>
      <trkpt lat="48.8576" lon="2.3522">
        <ele>40.0</ele>
        <time>2026-07-10T08:01:00Z</time>
      </trkpt>
      <trkpt lat="48.8586" lon="2.3522">
        <ele>36.0</ele>
        <time>2026-07-10T08:02:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>"""

class GpxParserTest {

    @Test
    fun `parse un GPX simple et derive distance duree denivele`() = runBlocking {
        val activity = parseGpx(ByteArrayInputStream(SAMPLE_GPX.toByteArray(Charsets.UTF_8)))

        assertEquals(ActivityFileFormat.GPX, activity.sourceFormat)
        assertEquals(WorkoutType.RUNNING, activity.workoutType)
        assertTrue("distance dérivée attendue > 0", activity.totalDistanceM > 0.0)
        assertEquals(120.0, activity.totalDurationSec, 0.01)
        assertEquals(0, activity.totalCalories)
        assertTrue(activity.laps.isEmpty())
        assertEquals(3, activity.rawTrackPoints.size)
        // HR/cadence absents de ce GPX minimal (pas d'extension gpxtpx)
        assertNull(activity.avgHrBpm)
    }

    @Test
    fun `mappe les libelles composes Garmin Connect vers le bon WorkoutType`() = runBlocking {
        suspend fun typeOf(gpxType: String) = parseGpx(
            ByteArrayInputStream(
                SAMPLE_GPX.replace("<type>running</type>", "<type>$gpxType</type>").toByteArray(Charsets.UTF_8)
            )
        ).workoutType

        assertEquals(WorkoutType.CYCLING, typeOf("road_biking"))
        assertEquals(WorkoutType.CYCLING, typeOf("mountain_biking"))
        assertEquals(WorkoutType.HIKING, typeOf("hiking"))
        assertEquals(WorkoutType.HIKING, typeOf("walking"))
        assertEquals(WorkoutType.RUNNING, typeOf("trail_running"))
    }

    @Test(expected = ActivityParseException::class)
    fun `leve une exception si aucun trackpoint`() = runBlocking {
        val xml = """<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1"><trk><name>Vide</name></trk></gpx>"""
        parseGpx(ByteArrayInputStream(xml.toByteArray(Charsets.UTF_8)))
        Unit
    }

    @Test
    fun `parse un vrai fichier GPX Garmin Connect avec extension gpxtpx hr cad`() = runBlocking {
        val bytes = checkNotNull(javaClass.classLoader?.getResourceAsStream("samples/sample.gpx")) {
            "Fixture samples/sample.gpx introuvable"
        }.use { it.readBytes() }

        val activity = parseGpx(ByteArrayInputStream(bytes))

        assertEquals(ActivityFileFormat.GPX, activity.sourceFormat)
        assertEquals(WorkoutType.RUNNING, activity.workoutType)
        // Même activité que la fixture FIT (Perros-Guirec, ~49 min) — distance/durée dérivées du
        // GPX sont très proches des totaux natifs FIT (7936 m / 2960 s), à la tolérance de calcul près.
        assertEquals(7912.0, activity.totalDistanceM, 50.0)
        assertEquals(2960.0, activity.totalDurationSec, 5.0)
        assertEquals(168, activity.avgHrBpm)
        assertEquals(190, activity.maxHrBpm)
        // Cadence gpxtpx:cad doublée pour la course à pied (cohérent avec TCX/FIT) → doit matcher le FIT
        assertEquals(164, activity.avgCadenceRpm)
        assertTrue("points GPS attendus", activity.rawTrackPoints.size > 100)
    }
}
