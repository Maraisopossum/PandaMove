package fr.pandamove.widget

import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** Au-delà de cet âge (côté serveur), les données sont estompées et leur âge affiché. */
val AGE_DONNEES_ANCIENNES: Duration = Duration.ofHours(2)

enum class Statut { NON_RELIE, REVOQUE, EN_ATTENTE, A_JOUR, ANCIEN }

/** Une barre de progression : valeur du jour face à l'objectif (s'il existe). */
data class Barre(val libelle: String, val valeur: Int, val objectif: Int?, val unite: String) {
    val ratio: Float get() = if (objectif == null || objectif <= 0) 0f else (valeur.toFloat() / objectif).coerceIn(0f, 1f)
    val depasse: Boolean get() = objectif != null && objectif > 0 && valeur > objectif
    val texte: String get() = if (objectif != null) "${formaterEntier(valeur)} / ${formaterEntier(objectif)} $unite" else "${formaterEntier(valeur)} $unite"
}

/** Tout ce que le widget affiche, calculé sans Android pour être testé. */
data class Etat(
    val statut: Statut,
    /** Grand nombre central (« 860 », « 340 »), vide si le widget n'affiche pas de données. */
    val grandNombre: String = "",
    /** Légende sous le grand nombre (« kcal restantes », « kcal en trop », « kcal »). */
    val legende: String = "",
    /** Part de l'objectif d'énergie consommée, 0 à 1 (0 sans objectif). */
    val ratio: Float = 0f,
    /** Objectif d'énergie dépassé : l'anneau passe à l'ambre et la légende dit « en trop ». */
    val depasse: Boolean = false,
    val macros: List<Barre> = emptyList(),
    val eau: Barre? = null,
    /** « il y a 3 h », présent seulement pour des données anciennes. */
    val age: String? = null,
    /** Heure (locale) de la dernière lecture réussie du serveur, « 14:32 » : le doute sur la fraîcheur se lève d'un coup d'œil. */
    val misAJour: String? = null,
    /** Message à la place des données (non relié, jeton révoqué, chargement). */
    val message: String? = null,
) {
    val aDesDonnees: Boolean get() = statut == Statut.A_JOUR || statut == Statut.ANCIEN
}

/** Entier à la française : espace insécable (U+00A0) entre les milliers, qui s’affiche partout, y compris dans un widget. */
fun formaterEntier(n: Int): String {
    val signe = if (n < 0) "-" else ""
    val chiffres = Math.abs(n.toLong()).toString()
    val groupes = chiffres.reversed().chunked(3).joinToString(" ").reversed()
    return signe + groupes
}

fun formaterAge(d: Duration): String {
    val minutes = d.toMinutes()
    return when {
        minutes < 1 -> "à l’instant"
        minutes < 60 -> "il y a $minutes min"
        minutes < 48 * 60 -> "il y a ${minutes / 60} h"
        else -> "il y a ${minutes / (24 * 60)} j"
    }
}

private fun arrondi(x: Double?): Int? = x?.let { Math.round(it).toInt() }

fun construireEtat(relie: Boolean, revoque: Boolean, resume: Resume?, maintenant: Instant, aujourdhui: LocalDate, zone: ZoneId = ZoneId.systemDefault()): Etat {
    if (!relie) return Etat(Statut.NON_RELIE, message = "Relier le widget")
    if (revoque) return Etat(Statut.REVOQUE, message = "Jeton révoqué : relier de nouveau")
    if (resume == null) return Etat(Statut.EN_ATTENTE, message = "Chargement…")

    val c = resume.consomme
    val o = resume.objectifs
    val kcal = arrondi(c.kcal) ?: 0
    val objectifKcal = arrondi(o?.kcal)?.takeIf { it > 0 }

    val grandNombre: String
    val legende: String
    var depasse = false
    var ratio = 0f
    if (objectifKcal != null) {
        val restantes = objectifKcal - kcal
        depasse = restantes < 0
        grandNombre = formaterEntier(Math.abs(restantes))
        legende = if (depasse) "kcal en trop" else "kcal restantes"
        ratio = (kcal.toFloat() / objectifKcal).coerceIn(0f, 1f)
    } else {
        grandNombre = formaterEntier(kcal)
        legende = "kcal consommées"
    }

    val genere = try { Instant.parse(resume.genereLe) } catch (_: Exception) { null }
    val ageReel = genere?.let { Duration.between(it, maintenant).coerceAtLeast(Duration.ZERO) }
    // Un résumé d'un autre jour (minuit passé) ou de plus de 2 h n'est pas présenté comme « du jour ».
    val ancien = resume.date != aujourdhui.toString() || ageReel == null || ageReel > AGE_DONNEES_ANCIENNES

    return Etat(
        statut = if (ancien) Statut.ANCIEN else Statut.A_JOUR,
        grandNombre = grandNombre,
        legende = legende,
        ratio = ratio,
        depasse = depasse,
        macros = listOf(
            Barre("Protéines", arrondi(c.proteines) ?: 0, arrondi(o?.proteinesG)?.takeIf { it > 0 }, "g"),
            Barre("Glucides", arrondi(c.glucides) ?: 0, arrondi(o?.glucidesG)?.takeIf { it > 0 }, "g"),
            Barre("Lipides", arrondi(c.lipides) ?: 0, arrondi(o?.lipidesG)?.takeIf { it > 0 }, "g"),
        ),
        eau = Barre("Eau", arrondi(c.eauMl) ?: 0, arrondi(o?.eauMl)?.takeIf { it > 0 }, "ml"),
        misAJour = genere?.let { DateTimeFormatter.ofPattern("HH:mm").withZone(zone).format(it) },
        age = if (ancien) (if (resume.date != aujourdhui.toString()) "données d’un autre jour" else ageReel?.let(::formaterAge)) else null,
    )
}

private fun Duration.coerceAtLeast(min: Duration): Duration = if (this < min) min else this
