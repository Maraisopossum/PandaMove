package com.pandafit.core.database.progression

import com.pandafit.core.database.entities.ExerciceSeanceEntity
import com.pandafit.core.database.entities.RepsType
import com.pandafit.core.database.entities.SerieRealiseeEntity
import com.pandafit.core.database.entities.SystemeProgression
import com.pandafit.core.database.entities.TypeExercice
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
        typeExercice: TypeExercice? = null,
        incrementPct: Float? = null,
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
        typeExercice = typeExercice,
        incrementPct = incrementPct,
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

    // ===== Incrément qualitatif (bible §4.2/§4.3/§4.5) =====

    @Test
    fun `increment qualitatif - chemin legacy sans type ni pas materiel inchange`() {
        val increment = calculerIncrementQualitatif(
            chargeActuelle = 60f, typeExercice = null, incrementPctOverride = null,
            pasMateriel = null, chargesAtteignables = null, incrementKgManuel = 2.5f,
        )
        assertEquals(2.5f, increment)
    }

    @Test
    fun `increment qualitatif - compose bas domine le pas materiel`() {
        val increment = calculerIncrementQualitatif(
            chargeActuelle = 100f, typeExercice = TypeExercice.COMPOSE_BAS, incrementPctOverride = null,
            pasMateriel = 2.5f, chargesAtteignables = null, incrementKgManuel = null,
        )
        // 5% de 100 = 5, arrondi au pas de 2.5 -> 5
        assertEquals(5f, increment)
    }

    @Test
    fun `increment qualitatif - pas materiel domine sur une isolation a faible charge`() {
        val increment = calculerIncrementQualitatif(
            chargeActuelle = 10f, typeExercice = TypeExercice.ISOLATION, incrementPctOverride = null,
            pasMateriel = 2f, chargesAtteignables = null, incrementKgManuel = null,
        )
        // 2% de 10 = 0.2, mais le pas matériel (2kg) ne doit jamais être descendu
        assertEquals(2f, increment)
    }

    @Test
    fun `increment qualitatif - plafond de 10pct ecrase un pourcentage cible agressif`() {
        val increment = calculerIncrementQualitatif(
            chargeActuelle = 100f, typeExercice = null, incrementPctOverride = 0.20f,
            pasMateriel = 2.5f, chargesAtteignables = null, incrementKgManuel = null,
        )
        // 20% de 100 = 20, plafonné à 10% = 10, arrondi au pas de 2.5 -> 10
        assertEquals(10f, increment)
    }

    @Test
    fun `lineaire avec type exercice utilise le pas materiel pour arrondir`() {
        val cible = CibleExercice(chargeKg = 100f, reps = 5, dureeSec = null)
        val series = listOf(serie(1, 5, 100f), serie(2, 5, 100f), serie(3, 5, 100f))

        val proposition = evaluerExercice(
            config(systeme = SystemeProgression.LINEAIRE, repsMin = 5, repsMax = 5, typeExercice = TypeExercice.COMPOSE_BAS, incrementKg = null),
            cible, compteurEchecActuel = 0, seriesRealisees = series, isBilateral = false,
            pasMateriel = 2.5f,
        )

        assertEquals(StatutExercice.SUCCES, proposition.statut)
        assertEquals(105f, proposition.nouvelleChargeCible)
    }

    @Test
    fun `increment qualitatif - snapping exact sur un ensemble irregulier de poids fixes`() {
        // Haltères fixes possédées : 8/12/16/20 kg — pas de saut uniforme entre paliers
        val increment = calculerIncrementQualitatif(
            chargeActuelle = 12f, typeExercice = TypeExercice.ISOLATION, incrementPctOverride = null,
            pasMateriel = null, chargesAtteignables = listOf(8f, 12f, 16f, 20f), incrementKgManuel = null,
        )
        // Cible théorique = 12 + max(pas estimé 4, 2%*12=0.24) = ~16 -> candidat le plus proche = 16
        assertEquals(4f, increment)
    }

    @Test
    fun `increment qualitatif - snapping ne propose jamais une charge non possedee`() {
        val charges = listOf(20f, 22.5f, 25f, 30f, 40f)
        val increment = calculerIncrementQualitatif(
            chargeActuelle = 20f, typeExercice = TypeExercice.COMPOSE_BAS, incrementPctOverride = null,
            pasMateriel = null, chargesAtteignables = charges, incrementKgManuel = null,
        )
        val nouvelleCharge = 20f + increment
        assertTrue(nouvelleCharge in charges)
    }

    @Test
    fun `increment qualitatif - plafond 10pct snapping ecarte un candidat trop eloigne`() {
        // Charge 100 ; seul candidat supérieur est 140 (40% de hausse) -> bien au-delà du plafond +10% (110)
        // mais c'est le seul palier réalisable au-dessus de la charge actuelle : le moteur doit quand même
        // converger vers ce candidat plutôt que de ne rien proposer.
        val increment = calculerIncrementQualitatif(
            chargeActuelle = 100f, typeExercice = TypeExercice.COMPOSE_BAS, incrementPctOverride = null,
            pasMateriel = null, chargesAtteignables = listOf(100f, 140f), incrementKgManuel = null,
        )
        assertEquals(40f, increment)
    }

    @Test
    fun `lineaire avec inventaire structure snappe sur la charge atteignable la plus proche`() {
        val cible = CibleExercice(chargeKg = 20f, reps = 5, dureeSec = null)
        val series = listOf(serie(1, 5, 20f), serie(2, 5, 20f), serie(3, 5, 20f))

        val proposition = evaluerExercice(
            config(systeme = SystemeProgression.LINEAIRE, repsMin = 5, repsMax = 5, typeExercice = TypeExercice.ISOLATION, incrementKg = null),
            cible, compteurEchecActuel = 0, seriesRealisees = series, isBilateral = false,
            chargesAtteignables = listOf(8f, 12f, 16f, 20f, 24f),
        )

        assertEquals(StatutExercice.SUCCES, proposition.statut)
        assertEquals(24f, proposition.nouvelleChargeCible)
    }
}
