package fr.pandamove.widget

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Contrat v1 de la fonction `widget-nutrition` (web/supabase/functions/widget-nutrition/README.md). Aucun nom d'aliment n'y figure. */
const val VERSION_CONTRAT = 1

@Serializable
data class Objectifs(
    val kcal: Double? = null,
    val proteinesG: Double? = null,
    val glucidesG: Double? = null,
    val lipidesG: Double? = null,
    val eauMl: Double? = null,
)

@Serializable
data class Consomme(
    val kcal: Double = 0.0,
    val proteines: Double = 0.0,
    val glucides: Double = 0.0,
    val lipides: Double = 0.0,
    val eauMl: Double = 0.0,
)

@Serializable
data class Resume(
    val v: Int,
    /** Jour du résumé, AAAA-MM-JJ. */
    val date: String,
    /** Instant de génération côté serveur (ISO UTC) : sert à l'âge affiché. */
    val genereLe: String,
    val objectifs: Objectifs? = null,
    val consomme: Consomme = Consomme(),
    val repas: Map<String, Double> = emptyMap(),
)

@Serializable
private data class CorpsErreur(val erreur: String? = null, val code: String? = null)

@Serializable
private data class CorpsEau(val ajoute: Boolean = false, val eauMl: Double = 0.0)

private val json = Json { ignoreUnknownKeys = true; isLenient = false }

fun decoderResume(texte: String): Resume? = try { json.decodeFromString<Resume>(texte) } catch (_: Exception) { null }

fun encoderResume(r: Resume): String = json.encodeToString(Resume.serializer(), r)

fun lireCodeErreur(texte: String): String? = try { json.decodeFromString<CorpsErreur>(texte).code } catch (_: Exception) { null }

/** Total d'eau du jour (ml) rendu par le serveur après un ajout, ou null si la réponse est illisible. */
fun lireEauAjoutee(texte: String): Double? = try { json.decodeFromString<CorpsEau>(texte).eauMl } catch (_: Exception) { null }
