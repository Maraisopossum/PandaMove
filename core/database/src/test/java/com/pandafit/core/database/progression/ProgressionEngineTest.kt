package com.pandafit.core.database.progression

import com.pandafit.core.database.entities.ExerciceSeanceEntity
import com.pandafit.core.database.entities.RepsType
import com.pandafit.core.database.entities.SerieRealiseeEntity
import com.pandafit.core.database.entities.SystemeProgression
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ProgressionEngineTest {

    private fun config(
        systeme: SystemeProgression = SystemeProgression.DOUBLE,
        repsMin: Int? = 8,
        repsMax: Int? = 12,
        incrementKg: Float? = 2.5f,
        incrementDureeSec: Int = 5,
        seuilDeload: Int = 3,
        repsType: RepsType = RepsType.REPS,
    ) = ExerciceSeanceEntity(
        seanceId = 1,
        exerciceId = 1,
        progressionActivee = true,
        systemeProgression = systeme,
        repsMin = repsMin,
        repsMax = repsMax,
        incrementKg = incrementKg,
        incrementDureeSec = incrementDureeSec,
        seuilDeload = seuilDeload,
        repsType = repsType,
    )

    private fun serie(numero: Int, reps: Int?, charge: Float? = null, rpe: Float? = null, cote: String = "") =
        SerieRealiseeEntity(
            instanceSeanceId = 1,
            exerciceSeanceId = 1,
            numeroSerie = numero,
            repsRealisees = reps,
            chargeKg = charge,
            rpe = rpe,
            notes = cote,
            isCompleted = true,
        )

    @Test
    fun `double progression - succes sous le haut de plage incremente les reps`() {
        val cible = CibleExercice(chargeKg = 20f, reps = 10, dureeSec = null)
        val series = listOf(serie(1, 11, 20f), serie(2, 11, 20f), serie(3, 11, 20f))

        val proposition = evaluerExercice(config(), cible, compteurEchecActuel = 0, seriesRealisees = series, isBilateral = false)

        assertEquals(StatutExercice.SUCCES, proposition.statut)
        assertEquals(20f, proposition.nouvelleChargeCible)
        assertEquals(11, proposition.nouveauRepsCible)
    }

    @Test
    fun `double progression - succes au haut de plage fait monter la charge et retombe au bas de plage`() {
        val cible = CibleExercice(chargeKg = 20f, reps = 12, dureeSec = null)
        val series = listOf(serie(1, 12, 20f), serie(2, 12, 20f), serie(3, 12, 20f))

        val proposition = evaluerExercice(config(), cible, compteurEchecActuel = 0, seriesRealisees = series, isBilateral = false)

        assertEquals(StatutExercice.SUCCES, proposition.statut)
        assertEquals(22.5f, proposition.nouvelleChargeCible)
        assertEquals(8, proposition.nouveauRepsCible)
    }

    @Test
    fun `lineaire - succes incremente toujours la charge`() {
        val cible = CibleExercice(chargeKg = 60f, reps = 5, dureeSec = null)
        val series = listOf(serie(1, 5, 60f), serie(2, 5, 60f), serie(3, 5, 60f))

        val proposition = evaluerExercice(
            config(systeme = SystemeProgression.LINEAIRE, repsMin = 5, repsMax = 5),
            cible, compteurEchecActuel = 0, seriesRealisees = series, isBilateral = false,
        )

        assertEquals(StatutExercice.SUCCES, proposition.statut)
        assertEquals(62.5f, proposition.nouvelleChargeCible)
        assertEquals(5, proposition.nouveauRepsCible)
    }

    @Test
    fun `temporelle - succes augmente la duree cible`() {
        val cible = CibleExercice(chargeKg = null, reps = null, dureeSec = 25)
        val series = listOf(serie(1, 25), serie(2, 25), serie(3, 26))

        val proposition = evaluerExercice(
            config(systeme = SystemeProgression.TEMPORELLE, repsType = RepsType.DURATION),
            cible, compteurEchecActuel = 0, seriesRealisees = series, isBilateral = false,
        )

        assertEquals(StatutExercice.SUCCES, proposition.statut)
        assertEquals(30, proposition.nouvelleDureeCible)
    }

    @Test
    fun `echec leger maintient la cible sans deload`() {
        val cible = CibleExercice(chargeKg = 50f, reps = 12, dureeSec = null)
        val series = listOf(serie(1, 12, 50f), serie(2, 12, 50f), serie(3, 11, 50f))

        val proposition = evaluerExercice(config(), cible, compteurEchecActuel = 0, seriesRealisees = series, isBilateral = false)

        assertEquals(StatutExercice.ECHEC, proposition.statut)
        assertFalse(proposition.deload)
        assertEquals(50f, proposition.nouvelleChargeCible)
        assertEquals(12, proposition.nouveauRepsCible)
        assertEquals(1, proposition.nouveauCompteurEchec)
    }

    @Test
    fun `echec marque deload immediatement dès le premier echec`() {
        val cible = CibleExercice(chargeKg = 100f, reps = 20, dureeSec = null)
        val series = listOf(serie(1, 12, 100f), serie(2, 12, 100f), serie(3, 12, 100f))

        val proposition = evaluerExercice(
            config(repsMin = 18, repsMax = 22, incrementKg = 5f),
            cible, compteurEchecActuel = 0, seriesRealisees = series, isBilateral = false,
        )

        assertEquals(StatutExercice.ECHEC_MARQUE, proposition.statut)
        assertTrue(proposition.deload)
        assertEquals(0, proposition.nouveauCompteurEchec)
        assertEquals(90f, proposition.nouvelleChargeCible)
        assertEquals(18, proposition.nouveauRepsCible)
    }

    @Test
    fun `compteur echec atteint le seuil de deload apres plusieurs echecs legers`() {
        val cible = CibleExercice(chargeKg = 50f, reps = 12, dureeSec = null)
        val series = listOf(serie(1, 12, 50f), serie(2, 12, 50f), serie(3, 11, 50f))

        val proposition = evaluerExercice(config(seuilDeload = 3), cible, compteurEchecActuel = 2, seriesRealisees = series, isBilateral = false)

        assertEquals(StatutExercice.ECHEC_MARQUE, proposition.statut)
        assertTrue(proposition.deload)
        assertEquals(0, proposition.nouveauCompteurEchec)
    }

    @Test
    fun `garde-fou rpe - succes sans marge maintient la cible`() {
        val cible = CibleExercice(chargeKg = 20f, reps = 12, dureeSec = null)
        val series = listOf(serie(1, 12, 20f, rpe = 9f), serie(2, 12, 20f, rpe = 10f), serie(3, 12, 20f, rpe = 9f))

        val proposition = evaluerExercice(config(), cible, compteurEchecActuel = 0, seriesRealisees = series, isBilateral = false)

        assertEquals(StatutExercice.SUCCES_SANS_MARGE, proposition.statut)
        assertEquals(20f, proposition.nouvelleChargeCible)
        assertEquals(12, proposition.nouveauRepsCible)
    }

    @Test
    fun `exercice non logge ne penalise pas et ne propose rien`() {
        val cible = CibleExercice(chargeKg = 20f, reps = 12, dureeSec = null)

        val proposition = evaluerExercice(config(), cible, compteurEchecActuel = 1, seriesRealisees = emptyList(), isBilateral = false)

        assertEquals(StatutExercice.NON_LOGGE, proposition.statut)
        assertEquals(1, proposition.nouveauCompteurEchec)
        assertEquals(20f, proposition.nouvelleChargeCible)
    }

    @Test
    fun `unilateral - le cote faible determine le statut global`() {
        val cible = CibleExercice(chargeKg = 20f, reps = 12, dureeSec = null)
        val series = listOf(
            serie(1, 12, 20f, cote = "G"), serie(2, 12, 20f, cote = "G"), serie(3, 12, 20f, cote = "G"),
            serie(4, 9, 20f, cote = "D"), serie(5, 9, 20f, cote = "D"), serie(6, 9, 20f, cote = "D"),
        )

        val proposition = evaluerExercice(config(), cible, compteurEchecActuel = 0, seriesRealisees = series, isBilateral = true)

        assertEquals(StatutExercice.ECHEC, proposition.statut)
        assertEquals(1, proposition.nouveauCompteurEchec)
    }
}
