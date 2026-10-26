package com.pandafit.feature.running.model

import com.pandafit.core.database.model.IntervalRepResult
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class IntervalEffortAnalysisTest {

    // ── parsePaceSecPerKm ─────────────────────────────────────────────────────

    @Test
    fun `parsePaceSecPerKm handles TCX format with slash suffix`() {
        assertEquals(231, parsePaceSecPerKm("3:51/km"))
    }

    @Test
    fun `parsePaceSecPerKm handles native format without suffix`() {
        assertEquals(231, parsePaceSecPerKm("3:51"))
    }

    @Test
    fun `parsePaceSecPerKm returns null for blank or malformed input`() {
        assertNull(parsePaceSecPerKm(""))
        assertNull(parsePaceSecPerKm("abc"))
    }

    // ── classifyPace — cible 3:45–3:55 (225–235 sec) ─────────────────────────

    @Test
    fun `classifyPace returns IN_TARGET within range`() {
        assertEquals(EffortClassification.IN_TARGET, classifyPace(230, 225, 235)) // 3:50
    }

    @Test
    fun `classifyPace returns FASTER_THAN_TARGET below range`() {
        assertEquals(EffortClassification.FASTER_THAN_TARGET, classifyPace(216, 225, 235)) // 3:36
    }

    @Test
    fun `classifyPace returns SLOWER_THAN_TARGET above range`() {
        assertEquals(EffortClassification.SLOWER_THAN_TARGET, classifyPace(242, 225, 235)) // 4:02
    }

    @Test
    fun `classifyPace boundaries are inclusive`() {
        assertEquals(EffortClassification.IN_TARGET, classifyPace(225, 225, 235))
        assertEquals(EffortClassification.IN_TARGET, classifyPace(235, 225, 235))
    }

    // ── extractWorkEfforts ────────────────────────────────────────────────────

    @Test
    fun `extractWorkEfforts returns all reps as-is for native execution (reps size matches repeatCount)`() {
        val reps = listOf(
            IntervalRepResult(repNumber = 1, actualIntensity = "3:50"),
            IntervalRepResult(repNumber = 2, actualIntensity = "3:48"),
        )
        val result = extractWorkEfforts(reps, repeatCount = 2, targetMinSec = 225, targetMaxSec = 235)
        assertEquals(2, result.size)
    }

    @Test
    fun `extractWorkEfforts filters out warmup, recovery and cooldown laps from TCX raw splits`() {
        // Simule "VMA 8x200" importé TCX : échauffement, 8x(effort+récup), retour au calme = 18 laps,
        // pour un bloc dont le template annonce repeatCount=8.
        val reps = buildList {
            add(IntervalRepResult(repNumber = 1, actualIntensity = "5:45/km")) // échauffement
            repeat(8) { i ->
                add(IntervalRepResult(repNumber = size + 1, actualIntensity = "3:5${i % 5}/km")) // effort
                add(IntervalRepResult(repNumber = size + 1, actualIntensity = "6:3${i % 5}/km")) // récup
            }
            add(IntervalRepResult(repNumber = size + 1, actualIntensity = "6:11/km")) // retour au calme
        }
        val result = extractWorkEfforts(reps, repeatCount = 8, targetMinSec = 225, targetMaxSec = 235)
        assertEquals(8, result.size)
        result.forEach { (_, pace) -> assert(pace < 300) { "pace $pace should be a fast effort lap" } }
    }

    @Test
    fun `extractWorkEfforts returns empty when no rep has a parsable pace`() {
        val reps = listOf(IntervalRepResult(repNumber = 1, actualIntensity = ""))
        val result = extractWorkEfforts(reps, repeatCount = 1, targetMinSec = 225, targetMaxSec = 235)
        assert(result.isEmpty())
    }

    // ── computeRegularityPercent ──────────────────────────────────────────────

    @Test
    fun `computeRegularityPercent returns null for fewer than 2 values`() {
        assertNull(computeRegularityPercent(emptyList()))
        assertNull(computeRegularityPercent(listOf(230)))
    }

    @Test
    fun `computeRegularityPercent returns 100 for perfectly identical paces`() {
        assertEquals(100, computeRegularityPercent(listOf(230, 230, 230)))
    }

    @Test
    fun `computeRegularityPercent decreases with more variance`() {
        val tight = computeRegularityPercent(listOf(230, 231, 229))!!
        val loose = computeRegularityPercent(listOf(200, 260, 220))!!
        assert(tight > loose) { "tight=$tight should be more regular than loose=$loose" }
    }

    @Test
    fun `computeRegularityPercent stays within 0 to 100 bounds`() {
        val result = computeRegularityPercent(listOf(100, 500, 50, 900))!!
        assert(result in 0..100)
    }
}
