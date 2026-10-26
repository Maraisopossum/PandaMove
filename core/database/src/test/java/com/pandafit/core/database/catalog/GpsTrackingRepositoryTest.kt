package com.pandafit.core.database.catalog

import com.pandafit.core.database.dao.GpsTrackPointDao
import com.pandafit.core.database.entities.GpsTrackPointEntity
import com.pandafit.core.database.entities.WorkoutType
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Dao factice : addPoint() n'exerce que insertOne(), le reste n'a pas besoin d'implémentation réelle. */
private class FakeGpsTrackPointDao : GpsTrackPointDao {
    override suspend fun insertAll(points: List<GpsTrackPointEntity>) = Unit
    override suspend fun insertOne(point: GpsTrackPointEntity): Long = 0L
    override suspend fun getByWorkout(workoutId: Long): List<GpsTrackPointEntity> = emptyList()
    override suspend fun getByWorkoutIds(workoutIds: List<Long>): List<GpsTrackPointEntity> = emptyList()
    override suspend fun getAll(): List<GpsTrackPointEntity> = emptyList()
    override suspend fun getAllByWorkoutType(type: WorkoutType): List<GpsTrackPointEntity> = emptyList()
    override fun observeByWorkout(workoutId: Long): Flow<List<GpsTrackPointEntity>> =
        throw NotImplementedError("non utilisé par ces tests")
    override suspend fun deleteByWorkout(workoutId: Long) = Unit
}

/** ~11 m au nord à cette latitude — largement au-dessus du seuil anti-drift (0.6 m/s à 1 Hz). */
private const val LAT_STEP = 0.0001

class GpsTrackingRepositoryTest {

    private fun repository() = GpsTrackingRepository(FakeGpsTrackPointDao())

    @Test
    fun `pause manuelle puis reprise ne cree pas de saut de distance`() = runBlocking {
        val repo = repository()
        repo.startTracking(wId = 1L)

        // Deux points de déplacement réel avant la pause.
        repo.addPoint(lat = 48.0000, lng = 2.0000, altM = 0.0, speedMps = 2f, accuracyM = 5f, timestampMs = 1_000L)
        repo.addPoint(lat = 48.0000 + LAT_STEP, lng = 2.0000, altM = 0.0, speedMps = 2f, accuracyM = 5f, timestampMs = 2_000L)
        val distanceAvantPause = repo.state.value.distanceM
        assertTrue("la distance doit avoir progressé avant la pause", distanceAvantPause > 0.0)

        repo.pauseTracking()

        // Fix reçu pendant la pause (dérive GPS ou léger déplacement) : ne doit rien changer à la distance.
        repo.addPoint(lat = 48.0000 + 5 * LAT_STEP, lng = 2.0005, altM = 0.0, speedMps = 2f, accuracyM = 5f, timestampMs = 3_000L)
        assertEquals(distanceAvantPause, repo.state.value.distanceM, 0.0001)
        assertTrue("le suivi doit rester en pause tant que resumeTracking() n'a pas été appelé", repo.state.value.isPaused)

        repo.resumeTracking()

        // 1er fix après la reprise : doit seulement ré-ancrer la position, sans ajouter de distance
        // (sinon le "saut" de dérive accumulée pendant la pause serait compté d'un coup).
        repo.addPoint(lat = 48.0000 + 8 * LAT_STEP, lng = 2.0008, altM = 0.0, speedMps = 2f, accuracyM = 5f, timestampMs = 4_000L)
        assertEquals(
            "le 1er fix post-reprise ne doit pas créer de saut de distance",
            distanceAvantPause,
            repo.state.value.distanceM,
            0.0001,
        )
        assertTrue(repo.state.value.isPaused.not())

        // 2e fix après la reprise : la distance doit recommencer à progresser normalement,
        // depuis la position ré-ancrée (pas depuis le point d'avant la pause).
        repo.addPoint(lat = 48.0000 + 9 * LAT_STEP, lng = 2.0009, altM = 0.0, speedMps = 2f, accuracyM = 5f, timestampMs = 5_000L)
        assertTrue(
            "la distance doit progresser à nouveau au 2e fix après reprise",
            repo.state.value.distanceM > distanceAvantPause,
        )
    }

    @Test
    fun `reprise automatique anti-drift ne cree pas non plus de saut de distance`() = runBlocking {
        val repo = repository()
        repo.startTracking(wId = 1L)

        repo.addPoint(lat = 48.0000, lng = 2.0000, altM = 0.0, speedMps = 2f, accuracyM = 5f, timestampMs = 1_000L)
        repo.addPoint(lat = 48.0000 + LAT_STEP, lng = 2.0000, altM = 0.0, speedMps = 2f, accuracyM = 5f, timestampMs = 2_000L)
        val distanceAvantArret = repo.state.value.distanceM

        // 3 échantillons sous le seuil de vitesse déclenchent l'auto-pause (feu rouge, arrêt...).
        repo.addPoint(lat = 48.0000 + LAT_STEP, lng = 2.0000, altM = 0.0, speedMps = 0f, accuracyM = 5f, timestampMs = 3_000L)
        repo.addPoint(lat = 48.0000 + LAT_STEP, lng = 2.0000, altM = 0.0, speedMps = 0f, accuracyM = 5f, timestampMs = 4_000L)
        repo.addPoint(lat = 48.0000 + LAT_STEP, lng = 2.0000, altM = 0.0, speedMps = 0f, accuracyM = 5f, timestampMs = 5_000L)
        assertTrue(repo.state.value.isPaused)

        // Un fix de dérive pendant l'auto-pause ne doit toujours rien changer à la distance.
        repo.addPoint(lat = 48.0000 + 4 * LAT_STEP, lng = 2.0004, altM = 0.0, speedMps = 0f, accuracyM = 5f, timestampMs = 6_000L)
        assertEquals(distanceAvantArret, repo.state.value.distanceM, 0.0001)

        // La vitesse repasse au-dessus du seuil : reprise auto — ce 1er fix ne doit pas non plus
        // créer de saut malgré la dérive accumulée pendant l'arrêt.
        repo.addPoint(lat = 48.0000 + 6 * LAT_STEP, lng = 2.0006, altM = 0.0, speedMps = 2f, accuracyM = 5f, timestampMs = 7_000L)
        assertEquals(distanceAvantArret, repo.state.value.distanceM, 0.0001)
        assertTrue(repo.state.value.isPaused.not())
    }
}
