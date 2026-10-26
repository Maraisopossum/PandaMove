package com.pandafit.core.database.activityimport

import com.pandafit.core.database.entities.WorkoutType
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FitParserTest {

    /** Vrai fichier FIT exporté depuis Garmin Connect (activité course à pied Perros-Guirec). */
    private fun sampleBytes(): ByteArray =
        checkNotNull(javaClass.classLoader?.getResourceAsStream("samples/sample.fit")) {
            "Fixture samples/sample.fit introuvable"
        }.use { it.readBytes() }

    @Test
    fun `parse un vrai fichier FIT Garmin Connect`() = runBlocking {
        val activity = parseFit(sampleBytes())

        assertEquals(ActivityFileFormat.FIT, activity.sourceFormat)
        assertEquals(WorkoutType.RUNNING, activity.workoutType)
        // Valeurs réelles de la fixture (activité Perros-Guirec, ~49 min) — tolérance large pour
        // rester robuste si le fichier de test est un jour remplacé par un export différent.
        assertEquals(7936.0, activity.totalDistanceM, 50.0)
        assertEquals(2960.0, activity.totalDurationSec, 5.0)
        assertEquals(171, activity.avgHrBpm)
        assertEquals(190, activity.maxHrBpm)
        assertEquals(166, activity.elevationGainM)
        assertEquals(164, activity.avgCadenceRpm)
        assertEquals(8, activity.laps.size)
        assertTrue("points GPS attendus", activity.rawTrackPoints.isNotEmpty())
        assertTrue("startTime doit etre renseigne", activity.startTime.isNotBlank())

        // Coherence de base des trackpoints (latitude/longitude dans les bornes valides)
        activity.rawTrackPoints.forEach { p ->
            assertTrue(p.latitude in -90.0..90.0)
            assertTrue(p.longitude in -180.0..180.0)
        }
    }

    @Test
    fun `detecte correctement le format FIT depuis les octets du fichier reel`() {
        assertEquals(ActivityFileFormat.FIT, detectActivityFormat(sampleBytes()))
    }
}
