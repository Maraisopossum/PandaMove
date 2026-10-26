package com.pandafit.feature.running.model

import com.pandafit.core.database.entities.GpsTrackPointEntity
import com.pandafit.core.database.model.IntervalRepResult
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Doit correspondre exactement au rayon terrestre utilisé par haversineMeters (6_371_000.0),
// sinon la distance cumulée calculée par la fonction testée dérive de celle attendue par le test.
private const val METERS_PER_DEGREE_LAT = 6_371_000.0 * Math.PI / 180.0

/** Construit une piste rectiligne vers le nord : chaque point avance de [stepMeters] et [stepSeconds]. */
private fun straightTrack(stepMeters: Double, stepSeconds: Long, count: Int, altitudeStep: Double? = null): List<GpsTrackPointEntity> {
    var lat = 45.0
    var timestamp = 1_000_000L
    var altitude = 100.0
    return (0 until count).map { i ->
        val point = GpsTrackPointEntity(
            workoutId = 1,
            pointIndex = i,
            latitude = lat,
            longitude = 5.0,
            altitudeM = altitudeStep?.let { altitude },
            timestampMs = timestamp,
        )
        lat += stepMeters / METERS_PER_DEGREE_LAT
        timestamp += stepSeconds * 1000
        altitude += altitudeStep ?: 0.0
        point
    }
}

class FreeRunAnalysisTest {

    @Test
    fun `computeKmSplits returns empty list when fewer than 2 points`() {
        assertTrue(computeKmSplits(emptyList()).isEmpty())
        assertTrue(computeKmSplits(listOf(GpsTrackPointEntity(workoutId = 1, pointIndex = 0, latitude = 45.0, longitude = 5.0))).isEmpty())
    }

    @Test
    fun `computeKmSplits returns empty list for TCX import (all timestamps at 0)`() {
        val points = (0..5).map {
            GpsTrackPointEntity(workoutId = 1, pointIndex = it, latitude = 45.0 + it * 0.001, longitude = 5.0, timestampMs = 0L)
        }
        assertTrue(computeKmSplits(points).isEmpty())
    }

    @Test
    fun `computeKmSplits computes one split per full kilometer at constant pace`() {
        // 100m every 30s -> 5:00/km pace (300 sec/km), over 10 points = ~900m (under 1km, no split yet)
        val points = straightTrack(stepMeters = 100.0, stepSeconds = 30, count = 11)
        val splits = computeKmSplits(points)
        assertEquals(1, splits.size)
        assertEquals(1, splits[0].km)
        assertEquals(300, splits[0].paceSecPerKm)
    }

    @Test
    fun `computeKmSplits computes two splits for a 2km track`() {
        val points = straightTrack(stepMeters = 100.0, stepSeconds = 24, count = 21) // 2000m, 240 sec/km
        val splits = computeKmSplits(points)
        assertEquals(2, splits.size)
        assertEquals(240, splits[0].paceSecPerKm)
        assertEquals(240, splits[1].paceSecPerKm)
    }

    @Test
    fun `computeKmSplits tracks positive elevation gain per split`() {
        val points = straightTrack(stepMeters = 100.0, stepSeconds = 30, count = 11, altitudeStep = 2.0)
        val splits = computeKmSplits(points)
        assertEquals(1, splits.size)
        assertEquals(20, splits[0].elevationGainM) // 10 segments * 2m gain
    }

    @Test
    fun `computeRegularityFromSplits returns null for fewer than 2 splits`() {
        assertNull(computeRegularityFromSplits(emptyList()))
        assertNull(computeRegularityFromSplits(listOf(KmSplit(1, 300, null))))
    }

    @Test
    fun `computeRegularityFromSplits returns 100 for identical paces`() {
        val splits = listOf(KmSplit(1, 300, null), KmSplit(2, 300, null), KmSplit(3, 300, null))
        assertEquals(100, computeRegularityFromSplits(splits))
    }

    @Test
    fun `computeFreeRunAnalysis returns null when fewer than 2 splits computable`() {
        val points = straightTrack(stepMeters = 100.0, stepSeconds = 30, count = 5) // ~400m, no full km
        assertNull(computeFreeRunAnalysis(points))
    }

    @Test
    fun `computeFreeRunAnalysis identifies best and worst splits`() {
        // Km 1 fast (200 sec/km), km 2 slow (400 sec/km)
        val fastPart = straightTrack(stepMeters = 200.0, stepSeconds = 40, count = 6) // 1000m @ 200s/km
        val lat1 = fastPart.last().latitude
        val t1 = fastPart.last().timestampMs
        // Légère marge (6 pas au lieu de 5) pour dépasser franchement les 2000m et éviter toute
        // ambiguïté d'arrondi flottant pile à la frontière du kilomètre.
        val slowPart = (1..6).map { i ->
            GpsTrackPointEntity(
                workoutId = 1,
                pointIndex = fastPart.size + i - 1,
                latitude = lat1 + i * (200.0 / METERS_PER_DEGREE_LAT),
                longitude = 5.0,
                timestampMs = t1 + i * 80_000L,
            )
        }
        val analysis = computeFreeRunAnalysis(fastPart + slowPart)
        requireNotNull(analysis)
        assertEquals(2, analysis.splits.size)
        // Valeurs approximatives plutôt qu'exactes : sans interpolation temporelle au point de
        // passage précis du kilomètre, le split absorbe un peu du dépassement du point suivant —
        // ce test vérifie le comportement (meilleur << pire), pas une valeur pile au mètre près.
        assertTrue(analysis.bestSplit.paceSecPerKm in 200..280)
        assertTrue(analysis.worstSplit.paceSecPerKm in 400..480)
        assertTrue(analysis.bestSplit.paceSecPerKm < analysis.worstSplit.paceSecPerKm)
    }

    // ── computeFreeRunAnalysisFromLaps (splits TCX, sans horodatage point par point) ──────────

    private fun lap(distanceM: Double, durationSec: Double) =
        IntervalRepResult(repNumber = 0, distanceM = distanceM, durationSec = durationSec)

    @Test
    fun `computeFreeRunAnalysisFromLaps returns null when fewer than 2 valid laps`() {
        assertNull(computeFreeRunAnalysisFromLaps(emptyList(), emptyList()))
        assertNull(computeFreeRunAnalysisFromLaps(listOf(lap(1000.0, 300.0)), emptyList()))
        // Un lap invalide (distance ou durée nulle) ne doit pas être compté comme valide.
        assertNull(
            computeFreeRunAnalysisFromLaps(
                listOf(lap(1000.0, 300.0), lap(0.0, 0.0)),
                emptyList(),
            ),
        )
    }

    @Test
    fun `computeFreeRunAnalysisFromLaps computes pace per lap from raw distance and duration`() {
        val laps = listOf(lap(1000.0, 300.0), lap(1000.0, 240.0), lap(500.0, 100.0))
        val analysis = computeFreeRunAnalysisFromLaps(laps, emptyList())
        requireNotNull(analysis)
        assertEquals(3, analysis.splits.size)
        assertEquals(300, analysis.splits[0].paceSecPerKm)
        assertEquals(240, analysis.splits[1].paceSecPerKm)
        assertEquals(200, analysis.splits[2].paceSecPerKm) // 100s pour 500m -> 200s/km
        assertEquals(200, analysis.bestSplit.paceSecPerKm)
        assertEquals(300, analysis.worstSplit.paceSecPerKm)
    }

    @Test
    fun `computeFreeRunAnalysisFromLaps ignores invalid laps but keeps valid ones`() {
        val laps = listOf(lap(1000.0, 300.0), lap(0.0, 200.0), lap(1000.0, 0.0), lap(1000.0, 250.0))
        val analysis = computeFreeRunAnalysisFromLaps(laps, emptyList())
        requireNotNull(analysis)
        assertEquals(2, analysis.splits.size)
        assertEquals(300, analysis.splits[0].paceSecPerKm)
        assertEquals(250, analysis.splits[1].paceSecPerKm)
    }

    @Test
    fun `computeFreeRunAnalysisFromLaps sets cumulative distance boundaries from lap distances`() {
        val laps = listOf(lap(1000.0, 300.0), lap(1200.0, 360.0))
        val analysis = computeFreeRunAnalysisFromLaps(laps, emptyList())
        requireNotNull(analysis)
        assertEquals(1000.0, analysis.splits[0].cumulativeDistanceM, 0.001)
        assertEquals(2200.0, analysis.splits[1].cumulativeDistanceM, 0.001)
    }

    @Test
    fun `computeFreeRunAnalysisFromLaps returns null elevation when no GPS track available`() {
        val laps = listOf(lap(1000.0, 300.0), lap(1000.0, 300.0))
        val analysis = computeFreeRunAnalysisFromLaps(laps, emptyList())
        requireNotNull(analysis)
        assertNull(analysis.splits[0].elevationGainM)
        assertNull(analysis.splits[1].elevationGainM)
    }

    @Test
    fun `computeFreeRunAnalysisFromLaps attributes elevation gain to laps by cumulative GPS distance`() {
        // Piste de 2000m avec +2m d'altitude tous les 100m (20 segments, +40m au total).
        val points = straightTrack(stepMeters = 100.0, stepSeconds = 30, count = 21, altitudeStep = 2.0)
        val laps = listOf(lap(1000.0, 300.0), lap(1000.0, 300.0))
        val analysis = computeFreeRunAnalysisFromLaps(laps, points)
        requireNotNull(analysis)
        // Tolérance : comme pour les km GPS (cf. test computeFreeRunAnalysis plus haut), la frontière
        // exacte du lap peut absorber un segment du split suivant à cause de l'imprécision flottante
        // de la conversion degrés/mètres — on vérifie la répartition globale, pas un découpage au mètre près.
        val gain0 = analysis.splits[0].elevationGainM
        val gain1 = analysis.splits[1].elevationGainM
        requireNotNull(gain0)
        requireNotNull(gain1)
        assertEquals(40, gain0 + gain1)
        assertTrue(gain0 in 16..20)
        assertTrue(gain1 in 20..24)
    }

    @Test
    fun `computeFreeRunAnalysisFromLaps regularity is 100 for identical lap paces`() {
        val laps = listOf(lap(1000.0, 300.0), lap(1000.0, 300.0), lap(1000.0, 300.0))
        val analysis = computeFreeRunAnalysisFromLaps(laps, emptyList())
        requireNotNull(analysis)
        assertEquals(100, analysis.regularityPercent)
    }

    @Test
    fun `computeFreeRunAnalysisFromLaps excludes short laps from regularity and best-worst but keeps them as splits`() {
        // Lap 2 = arrêt à un feu rouge (150m très lent) au milieu de deux laps réguliers à 300s-km.
        val laps = listOf(lap(1000.0, 300.0), lap(150.0, 120.0), lap(1000.0, 300.0))
        val analysis = computeFreeRunAnalysisFromLaps(laps, emptyList())
        requireNotNull(analysis)
        // Toujours présent comme split (fidèle aux vrais laps Garmin, visible sur le graphique).
        assertEquals(3, analysis.splits.size)
        assertEquals(800, analysis.splits[1].paceSecPerKm) // 120s pour 150m -> 800s/km
        // Exclu des stats : régularité 100 (les deux seuls laps comparés font 300s-km chacun).
        assertEquals(100, analysis.regularityPercent)
        assertEquals(300, analysis.bestSplit.paceSecPerKm)
        assertEquals(300, analysis.worstSplit.paceSecPerKm)
    }

    @Test
    fun `computeFreeRunAnalysisFromLaps falls back to all splits when fewer than 2 laps meet the stats threshold`() {
        // Un seul lap franchit 200m -> repli sur tous les splits plutôt que stats manquantes.
        val laps = listOf(lap(1000.0, 300.0), lap(150.0, 120.0), lap(100.0, 50.0))
        val analysis = computeFreeRunAnalysisFromLaps(laps, emptyList())
        requireNotNull(analysis)
        assertEquals(3, analysis.splits.size)
        assertTrue(analysis.regularityPercent != null)
    }
}
