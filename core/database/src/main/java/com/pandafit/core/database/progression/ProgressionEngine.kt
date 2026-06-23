package com.pandafit.core.database.progression

import com.pandafit.core.database.entities.ExerciceSeanceEntity
import com.pandafit.core.database.entities.RepsType
import com.pandafit.core.database.entities.SerieRealiseeEntity
import com.pandafit.core.database.entities.SystemeProgression
import com.pandafit.core.database.entities.TypeExercice

/** Logique pure de la bible de progression (support/prog/bible-progression.md, §2.3). */
enum class StatutExercice { SUCCES, SUCCES_SANS_MARGE, ECHEC, ECHEC_MARQUE, NON_LOGGE }

data class PropositionProgression(
    val statut: StatutExercice,
    val nouvelleChargeCible: Float?,
    val nouveauRepsCible: Int?,
    val nouvelleDureeCible: Int?,
    val nouveauCompteurEchec: Int,
    val deload: Boolean,
)

/** Cible courante, indépendante de sa source (objectif persisté ou valeur initiale du template). */
data class CibleExercice(
    val chargeKg: Float?,
    val reps: Int?,
    val dureeSec: Int?,
)

// Écart relatif de reps en-dessous duquel un échec est considéré "léger" (presque réussi) plutôt que "marqué".
private const val SEUIL_ECART_LEGER = 0.15f

// Écart relatif de reps à partir duquel on flague une charge mal calibrée dès le 1er échec (bible §2.3/§2.5).
private const val SEUIL_ECART_FLAG = 0.30f

// RPE moyen à partir duquel on considère qu'il n'y a plus de marge, même en cas de succès (bible §4.5).
private const val RPE_SANS_MARGE = 9f

private const val POURCENTAGE_DELOAD = 0.10f

// Plafond de saut : ne jamais proposer une hausse de charge > 10% en une fois (bible §4.5).
private const val PLAFOND_SAUT_PCT = 0.10f

fun evaluerExercice(
    config: ExerciceSeanceEntity,
    cible: CibleExercice,
    compteurEchecActuel: Int,
    seriesRealisees: List<SerieRealiseeEntity>,
    isBilateral: Boolean,
    pasMateriel: Float? = null,
    chargesAtteignables: List<Float>? = null,
): PropositionProgression {
    if (seriesRealisees.isEmpty()) {
        return PropositionProgression(
            statut = StatutExercice.NON_LOGGE,
            nouvelleChargeCible = cible.chargeKg,
            nouveauRepsCible = cible.reps,
            nouvelleDureeCible = cible.dureeSec,
            nouveauCompteurEchec = compteurEchecActuel,
            deload = false,
        )
    }

    val resultat = if (isBilateral) {
        val cote1 = seriesRealisees.filter { it.notes.contains("G", ignoreCase = true) }
        val cote2 = seriesRealisees.filter { it.notes.contains("D", ignoreCase = true) }
        val evalCote1 = evaluerSeries(config, cible, cote1)
        val evalCote2 = evaluerSeries(config, cible, cote2)
        piorerResultat(evalCote1, evalCote2)
    } else {
        evaluerSeries(config, cible, seriesRealisees)
    }

    return appliquerCompteurEtDeload(config, cible, resultat, compteurEchecActuel, pasMateriel, chargesAtteignables)
}

private data class ResultatBrut(val statut: StatutExercice, val rpeMoyen: Float?)

private fun piorerResultat(a: ResultatBrut, b: ResultatBrut): ResultatBrut {
    fun rang(s: StatutExercice) = when (s) {
        StatutExercice.ECHEC_MARQUE -> 3
        StatutExercice.ECHEC -> 2
        StatutExercice.SUCCES_SANS_MARGE -> 1
        StatutExercice.SUCCES -> 0
        StatutExercice.NON_LOGGE -> 0
    }
    return if (rang(a.statut) >= rang(b.statut)) a else b
}

private fun evaluerSeries(
    config: ExerciceSeanceEntity,
    cible: CibleExercice,
    series: List<SerieRealiseeEntity>,
): ResultatBrut {
    if (series.isEmpty()) return ResultatBrut(StatutExercice.NON_LOGGE, null)

    val estDuree = config.repsType == RepsType.DURATION
    val total = series.size

    fun serieReussie(s: SerieRealiseeEntity): Boolean {
        if (estDuree) {
            val dureeCible = cible.dureeSec ?: return true
            return (s.repsRealisees ?: 0) >= dureeCible
        }
        val repsCible = cible.reps ?: return true
        val repsOk = (s.repsRealisees ?: 0) >= repsCible
        val chargeOk = cible.chargeKg == null || (s.chargeKg ?: 0f) >= cible.chargeKg
        return repsOk && chargeOk
    }

    fun ecartRelatif(s: SerieRealiseeEntity): Float {
        return if (estDuree) {
            val dureeCible = cible.dureeSec ?: return 0f
            if (dureeCible == 0) 0f else ((dureeCible - (s.repsRealisees ?: 0)).coerceAtLeast(0)).toFloat() / dureeCible
        } else {
            val repsCible = cible.reps ?: return 0f
            if (repsCible == 0) 0f else ((repsCible - (s.repsRealisees ?: 0)).coerceAtLeast(0)).toFloat() / repsCible
        }
    }

    val reussies = series.count { serieReussie(it) }
    val rpeMoyen = series.mapNotNull { it.rpe }.takeIf { it.isNotEmpty() }?.average()?.toFloat()

    val statut = when {
        reussies == total -> {
            if (rpeMoyen != null && rpeMoyen >= RPE_SANS_MARGE) StatutExercice.SUCCES_SANS_MARGE else StatutExercice.SUCCES
        }
        reussies >= total - 1 && series.filterNot { serieReussie(it) }.maxOfOrNull(::ecartRelatif).let { it == null || it < SEUIL_ECART_LEGER } -> {
            StatutExercice.ECHEC
        }
        else -> {
            val ecartMax = series.filterNot { serieReussie(it) }.maxOfOrNull(::ecartRelatif) ?: 0f
            if (ecartMax >= SEUIL_ECART_FLAG) StatutExercice.ECHEC_MARQUE else StatutExercice.ECHEC
        }
    }
    return ResultatBrut(statut, rpeMoyen)
}

private fun appliquerCompteurEtDeload(
    config: ExerciceSeanceEntity,
    cible: CibleExercice,
    resultat: ResultatBrut,
    compteurEchecActuel: Int,
    pasMateriel: Float? = null,
    chargesAtteignables: List<Float>? = null,
): PropositionProgression {
    return when (resultat.statut) {
        StatutExercice.NON_LOGGE -> PropositionProgression(
            statut = StatutExercice.NON_LOGGE,
            nouvelleChargeCible = cible.chargeKg,
            nouveauRepsCible = cible.reps,
            nouvelleDureeCible = cible.dureeSec,
            nouveauCompteurEchec = compteurEchecActuel,
            deload = false,
        )

        StatutExercice.SUCCES -> proposerMontee(config, cible, compteurEchecActuel = 0, pasMateriel = pasMateriel, chargesAtteignables = chargesAtteignables)

        StatutExercice.SUCCES_SANS_MARGE -> PropositionProgression(
            statut = StatutExercice.SUCCES_SANS_MARGE,
            nouvelleChargeCible = cible.chargeKg,
            nouveauRepsCible = cible.reps,
            nouvelleDureeCible = cible.dureeSec,
            nouveauCompteurEchec = 0,
            deload = false,
        )

        StatutExercice.ECHEC, StatutExercice.ECHEC_MARQUE -> {
            val nouveauCompteur = compteurEchecActuel + 1
            val deload = nouveauCompteur >= config.seuilDeload || resultat.statut == StatutExercice.ECHEC_MARQUE
            if (deload) {
                proposerDeload(config, cible)
            } else {
                PropositionProgression(
                    statut = resultat.statut,
                    nouvelleChargeCible = cible.chargeKg,
                    nouveauRepsCible = cible.reps,
                    nouvelleDureeCible = cible.dureeSec,
                    nouveauCompteurEchec = nouveauCompteur,
                    deload = false,
                )
            }
        }
    }
}

private fun proposerMontee(
    config: ExerciceSeanceEntity,
    cible: CibleExercice,
    compteurEchecActuel: Int,
    pasMateriel: Float? = null,
    chargesAtteignables: List<Float>? = null,
): PropositionProgression {
    fun nouvelleCharge(): Float {
        val charge = cible.chargeKg ?: 0f
        return charge + calculerIncrementQualitatif(charge, config.typeExercice, config.incrementPct, pasMateriel, chargesAtteignables, config.incrementKg)
    }

    return when (config.systemeProgression) {
        SystemeProgression.TEMPORELLE -> {
            PropositionProgression(
                statut = StatutExercice.SUCCES,
                nouvelleChargeCible = cible.chargeKg,
                nouveauRepsCible = cible.reps,
                nouvelleDureeCible = (cible.dureeSec ?: 0) + config.incrementDureeSec,
                nouveauCompteurEchec = compteurEchecActuel,
                deload = false,
            )
        }
        SystemeProgression.LINEAIRE -> {
            PropositionProgression(
                statut = StatutExercice.SUCCES,
                nouvelleChargeCible = nouvelleCharge(),
                nouveauRepsCible = cible.reps,
                nouvelleDureeCible = cible.dureeSec,
                nouveauCompteurEchec = compteurEchecActuel,
                deload = false,
            )
        }
        SystemeProgression.DOUBLE, null -> {
            val repsMax = config.repsMax
            val repsMin = config.repsMin
            if (repsMax != null && repsMin != null && (cible.reps ?: repsMax) >= repsMax) {
                PropositionProgression(
                    statut = StatutExercice.SUCCES,
                    nouvelleChargeCible = nouvelleCharge(),
                    nouveauRepsCible = repsMin,
                    nouvelleDureeCible = cible.dureeSec,
                    nouveauCompteurEchec = compteurEchecActuel,
                    deload = false,
                )
            } else {
                PropositionProgression(
                    statut = StatutExercice.SUCCES,
                    nouvelleChargeCible = cible.chargeKg,
                    nouveauRepsCible = (cible.reps ?: repsMin ?: 0) + 1,
                    nouvelleDureeCible = cible.dureeSec,
                    nouveauCompteurEchec = compteurEchecActuel,
                    deload = false,
                )
            }
        }
    }
}

/**
 * Incrément qualitatif (bible §4.2/§4.3) : `max(pas_matériel, charge × %cible)`, plafonné à +10%
 * (§4.5). Deux modes :
 * - `chargesAtteignables` non vide (inventaire réel déclaré) : snapping exact sur la charge la plus
 *   proche réellement composable avec ce matériel (`arrondir_a_charge_realisable`, §4.3).
 * - Sinon : pas simple (`pasMateriel`, ex. MACHINE) ou incrément manuel — comportement legacy
 *   inchangé pour ne pas régresser les exercices sans inventaire structuré.
 * Chemin totalement legacy (ni type d'exercice, ni pas, ni charges connues) : incrément manuel brut.
 */
fun calculerIncrementQualitatif(
    chargeActuelle: Float,
    typeExercice: TypeExercice?,
    incrementPctOverride: Float?,
    pasMateriel: Float?,
    chargesAtteignables: List<Float>?,
    incrementKgManuel: Float?,
): Float {
    if (typeExercice == null && pasMateriel == null && chargesAtteignables.isNullOrEmpty()) {
        return incrementKgManuel ?: 0f
    }

    val pct = incrementPctOverride ?: typeExercice?.pourcentageCibleDefault ?: 0f

    if (!chargesAtteignables.isNullOrEmpty()) {
        val candidatsSuperieurs = chargesAtteignables.filter { it > chargeActuelle }.sorted()
        val pasEstime = candidatsSuperieurs.firstOrNull()?.minus(chargeActuelle) ?: (incrementKgManuel ?: 0f)
        val brut = maxOf(pasEstime, chargeActuelle * pct)
        val plafondSaut = (chargeActuelle * PLAFOND_SAUT_PCT).coerceAtLeast(pasEstime)
        val cibleBrute = chargeActuelle + brut.coerceAtMost(plafondSaut)
        val nouvelleCharge = candidatsSuperieurs.minByOrNull { kotlin.math.abs(it - cibleBrute) } ?: chargeActuelle
        return nouvelleCharge - chargeActuelle
    }

    val pasEffectif = pasMateriel ?: incrementKgManuel
    val brut = maxOf(pasEffectif ?: 0f, chargeActuelle * pct)
    val plafondSaut = (chargeActuelle * PLAFOND_SAUT_PCT).coerceAtLeast(pasEffectif ?: 0f)
    return arrondirIncrement(brut.coerceAtMost(plafondSaut), pasEffectif)
}

private fun proposerDeload(config: ExerciceSeanceEntity, cible: CibleExercice): PropositionProgression {
    val nouvelleCharge = cible.chargeKg?.let { arrondirIncrement(it * (1 - POURCENTAGE_DELOAD), config.incrementKg) }
    return PropositionProgression(
        statut = StatutExercice.ECHEC_MARQUE,
        nouvelleChargeCible = nouvelleCharge ?: cible.chargeKg,
        nouveauRepsCible = config.repsMin ?: cible.reps,
        nouvelleDureeCible = cible.dureeSec,
        nouveauCompteurEchec = 0,
        deload = true,
    )
}

private fun arrondirIncrement(valeur: Float, incrementKg: Float?): Float {
    if (incrementKg == null || incrementKg <= 0f) return valeur
    val pas = Math.round(valeur / incrementKg)
    return pas * incrementKg
}
