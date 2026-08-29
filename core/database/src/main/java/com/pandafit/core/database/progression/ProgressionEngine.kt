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
    // Proposition "ajout de série" (exercices au poids de corps au plafond de reps, bible §4.5 PDC)
    val nouveauNombreSeries: Int? = null,
)

/**
 * true si la proposition doit être présentée à l'utilisateur pour validation (récap Oui/Non/Ajuster)
 * plutôt que persistée silencieusement — c'est le cas de tout succès (l'utilisateur peut vouloir
 * ajuster) et de toute proposition de deload, **quel que soit le statut associé**.
 *
 * ⚠ Piège documenté (KNOWN_BUGS.md) : un deload peut accompagner un statut d'échec (ECHEC/ECHEC_MARQUE).
 * Un futur refactor qui court-circuiterait cette fonction (ex. `statut != ECHEC` seul) réintroduirait
 * un deload imposé silencieusement — d'où son isolement en fonction pure directement testable, plutôt
 * que la logique inline dans `InstanceExecuteViewModel.prepareFinish()`.
 */
fun requiresValidation(proposition: PropositionProgression): Boolean =
    proposition.statut == StatutExercice.SUCCES ||
        proposition.statut == StatutExercice.SUCCES_SANS_MARGE ||
        proposition.statut == StatutExercice.NON_LOGGE ||
        proposition.deload

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

// valeurAtteinte : plus petite valeur (reps ou durée) réellement loguée parmi les séries évaluées —
// permet de détecter un dépassement du haut de plage dès cette séance (bible §2.2), même si la cible
// affichée n'était pas encore au plafond.
private data class ResultatBrut(val statut: StatutExercice, val rpeMoyen: Float?, val valeurAtteinte: Int? = null)

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

/** Une série isolée atteint-elle la cible (reps/durée @ charge) ? Bible §2.2 — réutilisée pour
 * l'évaluation à la clôture (evaluerSeries) et pour le tracker live (bandeau de progression). */
fun serieReussie(config: ExerciceSeanceEntity, cible: CibleExercice, serie: SerieRealiseeEntity): Boolean {
    if (config.repsType == RepsType.DURATION) {
        val dureeCible = cible.dureeSec ?: return true
        return (serie.repsRealisees ?: 0) >= dureeCible
    }
    val repsCible = cible.reps ?: return true
    val repsOk = (serie.repsRealisees ?: 0) >= repsCible
    val chargeOk = cible.chargeKg == null || (serie.chargeKg ?: 0f) >= cible.chargeKg
    return repsOk && chargeOk
}

private fun evaluerSeries(
    config: ExerciceSeanceEntity,
    cible: CibleExercice,
    series: List<SerieRealiseeEntity>,
): ResultatBrut {
    if (series.isEmpty()) return ResultatBrut(StatutExercice.NON_LOGGE, null)

    val estDuree = config.repsType == RepsType.DURATION
    val total = series.size

    fun serieReussie(s: SerieRealiseeEntity): Boolean = serieReussie(config, cible, s)

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
    // Pire valeur réalisée parmi les séries de travail : garantit que TOUTES dépassent le seuil détecté.
    val valeurAtteinte = series.minOfOrNull { it.repsRealisees ?: 0 }

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
    return ResultatBrut(statut, rpeMoyen, valeurAtteinte)
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

        StatutExercice.SUCCES -> proposerMontee(
            config, cible, compteurEchecActuel = 0, pasMateriel = pasMateriel, chargesAtteignables = chargesAtteignables,
            repsReellementAtteintes = resultat.valeurAtteinte,
        )

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

/** Que proposerait-on en cas de succès complet ? Fonction pure, sans effet de bord — utilisée par
 * l'arbre de décision à la clôture (statut déjà SUCCES) et en lecture seule par le bandeau de
 * progression live (preview "ce qui se passerait si toutes les séries restantes réussissent"). */
fun proposerMontee(
    config: ExerciceSeanceEntity,
    cible: CibleExercice,
    compteurEchecActuel: Int,
    pasMateriel: Float? = null,
    chargesAtteignables: List<Float>? = null,
    // Plus petite valeur (reps) réellement loguée cette séance, si connue (cf. evaluerExercice).
    // Absente pour le bandeau de progression live (preview "et si tout réussit") qui n'a pas encore
    // de séries réalisées à évaluer : on retombe alors sur la cible affichée.
    repsReellementAtteintes: Int? = null,
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
            // Cas dépassement (bible §2.2) : si les reps réellement loguées atteignent déjà le haut de
            // plage cette séance, on saute directement au palier de charge — même si la cible affichée
            // avant la séance (cible.reps) n'était pas encore au plafond.
            val repsReference = repsReellementAtteintes ?: cible.reps
            if (repsMax != null && repsMin != null && (repsReference ?: repsMax) >= repsMax) {
                if (config.isBodyweight) {
                    PropositionProgression(
                        statut = StatutExercice.SUCCES,
                        nouvelleChargeCible = cible.chargeKg,
                        nouveauRepsCible = repsMin,
                        nouvelleDureeCible = cible.dureeSec,
                        nouveauCompteurEchec = compteurEchecActuel,
                        deload = false,
                        nouveauNombreSeries = config.nombreSeriesPrevues + 1,
                    )
                } else {
                    PropositionProgression(
                        statut = StatutExercice.SUCCES,
                        nouvelleChargeCible = nouvelleCharge(),
                        nouveauRepsCible = repsMin,
                        nouvelleDureeCible = cible.dureeSec,
                        nouveauCompteurEchec = compteurEchecActuel,
                        deload = false,
                    )
                }
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
        // La cible actuelle est sous le plancher réellement composable avec cet inventaire (ex. une
        // barre EZ catégorisée "Barre" générique alors que la barre olympique déclarée pèse déjà plus
        // que la cible) : la combinatoire matériel ne s'applique pas à ce point de départ, qui n'a
        // jamais fait partie de l'ensemble atteignable. Snapper forcerait un saut disproportionné
        // (le plancher matériel, pas un vrai "pas") — on retombe sur l'incrément manuel configuré.
        if (chargeActuelle < chargesAtteignables.min()) {
            return incrementKgManuel ?: pasMateriel ?: 0f
        }
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
    // Poids de corps / charge externe fixe (isBodyweight) : pas de -10% sur la charge, qui n'a pas de
    // sens sur un équipement non modulable (ex. sac lesté fixe) — le retour à repsMin suffit comme deload.
    val nouvelleCharge = if (config.isBodyweight) {
        cible.chargeKg
    } else {
        cible.chargeKg?.let { arrondirIncrement(it * (1 - POURCENTAGE_DELOAD), config.incrementKg) }
    }
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
