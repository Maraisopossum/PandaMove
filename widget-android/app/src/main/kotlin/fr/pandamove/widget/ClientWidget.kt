package fr.pandamove.widget

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate

class ReponseHttp(val statut: Int, val corps: String, val retryApresS: Int? = null)

/** Transport HTTP injectable : la vraie implémentation utilise HttpURLConnection (aucune bibliothèque réseau ajoutée), les tests un faux. */
fun interface Transport {
    @Throws(IOException::class)
    fun envoyer(methode: String, url: String, entetes: Map<String, String>, corps: String?): ReponseHttp
}

class TransportHttp : Transport {
    override fun envoyer(methode: String, url: String, entetes: Map<String, String>, corps: String?): ReponseHttp {
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.requestMethod = methode
            c.connectTimeout = 10_000
            c.readTimeout = 15_000
            c.instanceFollowRedirects = false
            entetes.forEach { (k, v) -> c.setRequestProperty(k, v) }
            if (corps != null) {
                c.doOutput = true
                c.outputStream.use { it.write(corps.toByteArray(Charsets.UTF_8)) }
            }
            val statut = c.responseCode
            val flux = if (statut in 200..299) c.inputStream else c.errorStream
            val texte = flux?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
            return ReponseHttp(statut, texte, c.getHeaderField("Retry-After")?.trim()?.toIntOrNull())
        } finally {
            c.disconnect()
        }
    }
}

/** Ce qui peut mal tourner, vu du widget. */
sealed interface ErreurWidget {
    /** Jeton inconnu ou mal formé. */
    data object JetonInvalide : ErreurWidget
    /** Jeton révoqué dans le Profil : le widget efface son cache et propose de relier. */
    data object JetonRevoque : ErreurWidget
    /** Le jeton n'a pas l'option « eau ». */
    data object EcritureRefusee : ErreurWidget
    /** 5 000 ml atteints pour ce jour. */
    data object PlafondEau : ErreurWidget
    /** Une lecture toutes les 20 s au plus par jeton. */
    data class TropVite(val retryApresS: Int) : ErreurWidget
    data object Reseau : ErreurWidget
    data class Serveur(val statut: Int) : ErreurWidget
    data object ReponseIllisible : ErreurWidget
    /** Contrat plus récent que cette application. */
    data object VersionInconnue : ErreurWidget
    data object DateInvalide : ErreurWidget
    data object AdresseInvalide : ErreurWidget
}

sealed interface Resultat<out T> {
    data class Succes<T>(val valeur: T) : Resultat<T>
    data class Echec(val erreur: ErreurWidget) : Resultat<Nothing>
}

/** L'adresse de la fonction doit être en https (le jeton voyage dans un en-tête) et n'avoir ni identifiants ni fragment. */
fun adresseValide(adresse: String): Boolean {
    val u = try { java.net.URI(adresse.trim()) } catch (_: Exception) { return false }
    return u.scheme == "https" && !u.host.isNullOrBlank() && u.userInfo == null && u.fragment == null && u.query == null
}

class ClientWidget(adresse: String, private val jeton: String, private val transport: Transport = TransportHttp()) {
    private val base = adresse.trim().trimEnd('/')

    private fun entetes(extra: Map<String, String> = emptyMap()) = mapOf("Authorization" to "Bearer $jeton", "Accept" to "application/json") + extra

    private fun erreurDe(r: ReponseHttp): ErreurWidget {
        val code = lireCodeErreur(r.corps)
        return when {
            r.statut == 401 && code == "jeton_revoque" -> ErreurWidget.JetonRevoque
            r.statut == 401 -> ErreurWidget.JetonInvalide
            r.statut == 403 -> ErreurWidget.EcritureRefusee
            r.statut == 422 && code == "plafond_eau" -> ErreurWidget.PlafondEau
            r.statut == 429 -> ErreurWidget.TropVite(r.retryApresS ?: 20)
            r.statut == 400 && code == "date_invalide" -> ErreurWidget.DateInvalide
            else -> ErreurWidget.Serveur(r.statut)
        }
    }

    private inline fun <T> appeler(methode: String, url: String, corps: String?, lire: (ReponseHttp) -> Resultat<T>): Resultat<T> {
        if (!adresseValide(base)) return Resultat.Echec(ErreurWidget.AdresseInvalide)
        val r = try {
            transport.envoyer(methode, url, entetes(if (corps != null) mapOf("Content-Type" to "application/json") else emptyMap()), corps)
        } catch (_: IOException) {
            return Resultat.Echec(ErreurWidget.Reseau)
        }
        return if (r.statut in 200..299) lire(r) else Resultat.Echec(erreurDe(r))
    }

    /** Totaux du jour (hier, aujourd'hui ou demain seulement : règle du serveur). */
    fun lireResume(date: LocalDate): Resultat<Resume> = appeler("GET", "$base?date=$date", null) { r ->
        val resume = decoderResume(r.corps)
        when {
            resume == null -> Resultat.Echec(ErreurWidget.ReponseIllisible)
            resume.v > VERSION_CONTRAT -> Resultat.Echec(ErreurWidget.VersionInconnue)
            else -> Resultat.Succes(resume)
        }
    }

    /** Ajoute de l'eau. `cle` rend l'appel idempotent : la renvoyer telle quelle en cas de nouvel essai. Rend le total d'eau du jour (ml). */
    fun ajouterEau(date: LocalDate, ml: Int, cle: String): Resultat<Int> =
        appeler("POST", base, """{"date":"$date","ml":$ml,"cle":"$cle"}""") { r ->
            lireEauAjoutee(r.corps)?.let { Resultat.Succes(Math.round(it).toInt()) } ?: Resultat.Echec(ErreurWidget.ReponseIllisible)
        }
}

/** Clé d'appel : 16 caractères [A-Za-z0-9] (le serveur accepte 8 à 64 caractères A-Z a-z 0-9 _ -). */
fun nouvelleCle(aleatoire: java.util.Random = java.security.SecureRandom()): String {
    val alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    return buildString { repeat(16) { append(alphabet[aleatoire.nextInt(alphabet.length)]) } }
}
