package fr.pandamove.widget

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException
import java.time.LocalDate

class ClientWidgetTest {
    private val adresse = "https://abc.supabase.co/functions/v1/widget-nutrition"
    private val jeton = "pmw_" + "ab12".repeat(16)
    private val jour = LocalDate.of(2026, 11, 15)

    private class Faux(val reponse: ReponseHttp? = null, val panne: Boolean = false) : Transport {
        var methode = ""; var url = ""; var entetes: Map<String, String> = emptyMap(); var corps: String? = null; var appels = 0
        override fun envoyer(methode: String, url: String, entetes: Map<String, String>, corps: String?): ReponseHttp {
            appels++; this.methode = methode; this.url = url; this.entetes = entetes; this.corps = corps
            if (panne) throw IOException("hors ligne")
            return reponse!!
        }
    }

    private val resumeJson = """{"v":1,"date":"2026-11-15","genereLe":"2026-11-15T12:40:03.000Z",
        "objectifs":{"kcal":2400,"proteinesG":150,"glucidesG":280,"lipidesG":75,"eauMl":2500},
        "consomme":{"kcal":1240,"proteines":98,"glucides":148,"lipides":41,"eauMl":1250},
        "repas":{"petit_dejeuner":281,"dejeuner":960,"collation":0,"diner":0},"inconnu":"ignoré"}"""

    private fun client(f: Faux, a: String = adresse) = ClientWidget(a, jeton, f)

    @Test fun `200 - resume lu, jeton en en-tete, jamais dans l adresse`() {
        val f = Faux(ReponseHttp(200, resumeJson))
        val r = client(f).lireResume(jour)
        assertTrue(r is Resultat.Succes)
        val resume = (r as Resultat.Succes).valeur
        assertEquals(1240.0, resume.consomme.kcal, 0.0)
        assertEquals(2400.0, resume.objectifs!!.kcal!!, 0.0)
        assertEquals("GET", f.methode)
        assertEquals("$adresse?date=2026-11-15", f.url)
        assertEquals("Bearer $jeton", f.entetes["Authorization"])
        assertFalse(f.url.contains(jeton))
    }

    @Test fun `objectifs null accepte`() {
        val f = Faux(ReponseHttp(200, """{"v":1,"date":"2026-11-15","genereLe":"2026-11-15T12:40:03Z","objectifs":null,"consomme":{"kcal":10},"repas":{}}"""))
        val r = client(f).lireResume(jour) as Resultat.Succes
        assertEquals(null, r.valeur.objectifs)
    }

    @Test fun `401 jeton_revoque et jeton inconnu`() {
        assertEquals(Resultat.Echec(ErreurWidget.JetonRevoque), client(Faux(ReponseHttp(401, """{"erreur":"x","code":"jeton_revoque"}"""))).lireResume(jour))
        assertEquals(Resultat.Echec(ErreurWidget.JetonInvalide), client(Faux(ReponseHttp(401, """{"erreur":"x","code":"jeton_invalide"}"""))).lireResume(jour))
        assertEquals(Resultat.Echec(ErreurWidget.JetonInvalide), client(Faux(ReponseHttp(401, "n'importe quoi"))).lireResume(jour))
    }

    @Test fun `429 trop vite avec Retry-After`() {
        assertEquals(Resultat.Echec(ErreurWidget.TropVite(20)), client(Faux(ReponseHttp(429, """{"code":"trop_vite"}""", 20))).lireResume(jour))
        assertEquals(Resultat.Echec(ErreurWidget.TropVite(20)), client(Faux(ReponseHttp(429, ""))).lireResume(jour))
    }

    @Test fun `reseau coupe`() {
        assertEquals(Resultat.Echec(ErreurWidget.Reseau), client(Faux(panne = true)).lireResume(jour))
    }

    @Test fun `500, corps illisible et contrat trop recent`() {
        assertEquals(Resultat.Echec(ErreurWidget.Serveur(500)), client(Faux(ReponseHttp(500, ""))).lireResume(jour))
        assertEquals(Resultat.Echec(ErreurWidget.ReponseIllisible), client(Faux(ReponseHttp(200, "<html>"))).lireResume(jour))
        assertEquals(Resultat.Echec(ErreurWidget.VersionInconnue), client(Faux(ReponseHttp(200, resumeJson.replace("\"v\":1", "\"v\":2")))).lireResume(jour))
    }

    @Test fun `adresse non https refusee sans appel reseau`() {
        val f = Faux(ReponseHttp(200, resumeJson))
        assertEquals(Resultat.Echec(ErreurWidget.AdresseInvalide), client(f, "http://abc.supabase.co/functions/v1/widget-nutrition").lireResume(jour))
        assertEquals(Resultat.Echec(ErreurWidget.AdresseInvalide), client(f, "").lireResume(jour))
        assertEquals(0, f.appels)
        assertTrue(adresseValide(adresse))
        assertFalse(adresseValide("https://utilisateur:mdp@abc.supabase.co/x"))
        assertFalse(adresseValide("https://abc.supabase.co/x?date=1"))
        assertFalse(adresseValide("ftp://abc"))
    }

    @Test fun `eau - POST avec date, quantite et cle - total rendu`() {
        val f = Faux(ReponseHttp(200, """{"v":1,"ajoute":true,"eauMl":1500}"""))
        val r = client(f).ajouterEau(jour, 250, "AbCd1234EfGh5678")
        assertEquals(Resultat.Succes(1500), r)
        assertEquals("POST", f.methode)
        assertEquals(adresse, f.url)
        assertEquals("""{"date":"2026-11-15","ml":250,"cle":"AbCd1234EfGh5678"}""", f.corps)
        assertEquals("application/json", f.entetes["Content-Type"])
    }

    @Test fun `eau - refus d ecriture, plafond, reseau`() {
        assertEquals(Resultat.Echec(ErreurWidget.EcritureRefusee), client(Faux(ReponseHttp(403, """{"code":"ecriture_refusee"}"""))).ajouterEau(jour, 250, "cle12345"))
        assertEquals(Resultat.Echec(ErreurWidget.PlafondEau), client(Faux(ReponseHttp(422, """{"code":"plafond_eau"}"""))).ajouterEau(jour, 250, "cle12345"))
        assertEquals(Resultat.Echec(ErreurWidget.Reseau), client(Faux(panne = true)).ajouterEau(jour, 250, "cle12345"))
        assertEquals(Resultat.Echec(ErreurWidget.ReponseIllisible), client(Faux(ReponseHttp(200, "ok"))).ajouterEau(jour, 250, "cle12345"))
    }

    @Test fun `cle d appel - 16 caracteres acceptes par le serveur, differentes a chaque tirage`() {
        val a = nouvelleCle()
        val b = nouvelleCle()
        assertEquals(16, a.length)
        assertTrue(Regex("[A-Za-z0-9_-]{8,64}").matches(a))
        assertTrue(a != b)
        assertNotNull(a)
    }

    @Test fun `resume ecrit puis relu a l identique (cache hors ligne)`() {
        val r = decoderResume(resumeJson)!!
        assertEquals(r, decoderResume(encoderResume(r)))
    }
}
