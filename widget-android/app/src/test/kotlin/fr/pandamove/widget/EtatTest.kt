package fr.pandamove.widget

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Duration
import java.time.Instant
import java.time.LocalDate

class EtatTest {
    private val aujourdhui = LocalDate.of(2026, 11, 15)
    private val maintenant = Instant.parse("2026-11-15T12:40:00Z")

    private fun resume(kcal: Double = 1240.0, objectifKcal: Double? = 2400.0, date: String = "2026-11-15", genereLe: String = "2026-11-15T12:30:00Z") = Resume(
        v = 1, date = date, genereLe = genereLe,
        objectifs = objectifKcal?.let { Objectifs(kcal = it, proteinesG = 150.0, glucidesG = 280.0, lipidesG = 75.0, eauMl = 2500.0) },
        consomme = Consomme(kcal = kcal, proteines = 98.4, glucides = 148.0, lipides = 41.0, eauMl = 1250.0),
        repas = mapOf("petit_dejeuner" to 281.0),
    )

    @Test fun `entiers a la francaise`() {
        assertEquals("0", formaterEntier(0))
        assertEquals("860", formaterEntier(860))
        assertEquals("1 240", formaterEntier(1240))
        assertEquals("12 345 678", formaterEntier(12345678))
        assertEquals("-1 000", formaterEntier(-1000))
    }

    @Test fun `anciennete en francais`() {
        assertEquals("à l’instant", formaterAge(Duration.ofSeconds(20)))
        assertEquals("il y a 12 min", formaterAge(Duration.ofMinutes(12)))
        assertEquals("il y a 3 h", formaterAge(Duration.ofMinutes(190)))
        assertEquals("il y a 3 j", formaterAge(Duration.ofHours(24 * 3 + 5)))
    }

    @Test fun `non relie puis revoque puis en attente`() {
        assertEquals(Statut.NON_RELIE, construireEtat(false, false, null, maintenant, aujourdhui).statut)
        assertEquals(Statut.NON_RELIE, construireEtat(false, true, resume(), maintenant, aujourdhui).statut)
        val revoque = construireEtat(true, true, resume(), maintenant, aujourdhui)
        assertEquals(Statut.REVOQUE, revoque.statut)
        assertFalse(revoque.aDesDonnees)
        assertEquals(Statut.EN_ATTENTE, construireEtat(true, false, null, maintenant, aujourdhui).statut)
    }

    @Test fun `a jour - energie restante, anneau et barres`() {
        val e = construireEtat(true, false, resume(), maintenant, aujourdhui)
        assertEquals(Statut.A_JOUR, e.statut)
        assertEquals("1 160", e.grandNombre)
        assertEquals("kcal restantes", e.legende)
        assertFalse(e.depasse)
        assertEquals(1240f / 2400f, e.ratio, 0.0001f)
        assertNull(e.age)
        assertEquals(listOf("Protéines", "Glucides", "Lipides"), e.macros.map { it.libelle })
        assertEquals(98, e.macros[0].valeur)
        assertEquals("98 / 150 g", e.macros[0].texte)
        assertEquals("1 250 / 2 500 ml", e.eau!!.texte)
    }

    @Test fun `objectif depasse - ambre et en trop`() {
        val e = construireEtat(true, false, resume(kcal = 2740.0), maintenant, aujourdhui)
        assertTrue(e.depasse)
        assertEquals("340", e.grandNombre)
        assertEquals("kcal en trop", e.legende)
        assertEquals(1f, e.ratio, 0f)
    }

    @Test fun `pile sur l objectif n est pas un depassement`() {
        val e = construireEtat(true, false, resume(kcal = 2400.0), maintenant, aujourdhui)
        assertFalse(e.depasse)
        assertEquals("0", e.grandNombre)
        assertEquals("kcal restantes", e.legende)
    }

    @Test fun `sans objectif - total consomme, anneau vide, barres sans plafond`() {
        val e = construireEtat(true, false, resume(objectifKcal = null), maintenant, aujourdhui)
        assertEquals(Statut.A_JOUR, e.statut)
        assertEquals("1 240", e.grandNombre)
        assertEquals("kcal consommées", e.legende)
        assertEquals(0f, e.ratio, 0f)
        assertNull(e.macros[0].objectif)
        assertEquals("98 g", e.macros[0].texte)
        assertEquals(0f, e.macros[0].ratio, 0f)
    }

    @Test fun `donnees de plus de 2 h - estompees avec leur age`() {
        val e = construireEtat(true, false, resume(genereLe = "2026-11-15T09:40:00Z"), maintenant, aujourdhui)
        assertEquals(Statut.ANCIEN, e.statut)
        assertTrue(e.aDesDonnees)
        assertEquals("il y a 3 h", e.age)
    }

    @Test fun `exactement 2 h reste a jour`() {
        val e = construireEtat(true, false, resume(genereLe = "2026-11-15T10:40:00Z"), maintenant, aujourdhui)
        assertEquals(Statut.A_JOUR, e.statut)
    }

    @Test fun `resume d un autre jour (minuit passe) n est pas presente comme celui du jour`() {
        val e = construireEtat(true, false, resume(date = "2026-11-14", genereLe = "2026-11-15T12:39:00Z"), maintenant, aujourdhui)
        assertEquals(Statut.ANCIEN, e.statut)
        assertEquals("données d’un autre jour", e.age)
    }

    @Test fun `date de generation illisible - ancien, sans plantage`() {
        val e = construireEtat(true, false, resume(genereLe = "pas une date"), maintenant, aujourdhui)
        assertEquals(Statut.ANCIEN, e.statut)
    }

    @Test fun `horloge du telephone en retard sur le serveur - age jamais negatif`() {
        val e = construireEtat(true, false, resume(genereLe = "2026-11-15T12:45:00Z"), maintenant, aujourdhui)
        assertEquals(Statut.A_JOUR, e.statut)
    }

    @Test fun `barre - ratio borne, depassement detecte`() {
        assertEquals(1f, Barre("Eau", 3000, 2500, "ml").ratio, 0f)
        assertTrue(Barre("Eau", 3000, 2500, "ml").depasse)
        assertEquals(0f, Barre("Eau", 100, 0, "ml").ratio, 0f)
        assertFalse(Barre("Eau", 100, 0, "ml").depasse)
        assertNotNull(Barre("Eau", 1, null, "ml").texte)
    }

    @Test fun `messages d eau et conservation de la cle d appel`() {
        assertNull(messagePourEau(Resultat.Succes(1500)))
        assertTrue(messagePourEau(Resultat.Echec(ErreurWidget.EcritureRefusee))!!.contains("Profil"))
        assertTrue(messagePourEau(Resultat.Echec(ErreurWidget.PlafondEau))!!.contains("5 000").not() && messagePourEau(Resultat.Echec(ErreurWidget.PlafondEau))!!.contains("5 000"))
        // La clé est gardée seulement quand on ne sait pas si le serveur a traité l'appel.
        assertTrue(garderLaCle(Resultat.Echec(ErreurWidget.Reseau)))
        assertTrue(garderLaCle(Resultat.Echec(ErreurWidget.Serveur(503))))
        assertTrue(garderLaCle(Resultat.Echec(ErreurWidget.TropVite(20))))
        assertFalse(garderLaCle(Resultat.Succes(1500)))
        assertFalse(garderLaCle(Resultat.Echec(ErreurWidget.PlafondEau)))
        assertFalse(garderLaCle(Resultat.Echec(ErreurWidget.EcritureRefusee)))
        assertFalse(garderLaCle(Resultat.Echec(ErreurWidget.Serveur(400))))
    }
}
