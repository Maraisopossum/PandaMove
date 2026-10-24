// Portage de ProgressionEngine.kt (logique pure de la bible de progression, §2.3/§4).
//
// Précision flottante : les charges, pourcentages et RPE sont des Float 32 bits côté Kotlin.
// Chaque valeur Float lue en entrée et chaque opération arithmétique Float (multiplication par
// un pourcentage, addition/soustraction de charges, division Float, arrondi au pas) passent par
// f32 (Math.fround) pour reproduire exactement les résultats Kotlin. Les entiers (reps, durées,
// compteurs) ne sont pas concernés. Les charges renvoyées sont donc des valeurs Float 32 bits
// (ex. 17.69999885559082 et non 17.7) : l'affichage doit les formater.
import type { ExerciceSeance, SerieRealisee, TypeExercice } from '../db/types'
import { f32 } from './inventory'

export type StatutExercice = 'SUCCES' | 'SUCCES_SANS_MARGE' | 'ECHEC' | 'ECHEC_MARQUE' | 'NON_LOGGE'

export interface PropositionProgression {
  statut: StatutExercice
  nouvelleChargeCible: number | null
  nouveauRepsCible: number | null
  nouvelleDureeCible: number | null
  nouveauCompteurEchec: number
  deload: boolean
  // Proposition "ajout de série" (exercices au poids de corps au plafond de reps, bible §4.5 PDC)
  nouveauNombreSeries: number | null
}

/** Cible courante, indépendante de sa source (objectif persisté ou valeur initiale du template). */
export interface CibleExercice {
  chargeKg: number | null
  reps: number | null
  dureeSec: number | null
}

/** Sous-ensemble de ExerciceSeance lu par le moteur (une ligne complète y est assignable). */
export type ExerciceConfig = Pick<
  ExerciceSeance,
  | 'repsType'
  | 'systemeProgression'
  | 'repsMin'
  | 'repsMax'
  | 'incrementKg'
  | 'incrementDureeSec'
  | 'seuilDeload'
  | 'typeExercice'
  | 'incrementPct'
  | 'isBodyweight'
  | 'nombreSeriesPrevues'
>

/** Sous-ensemble de SerieRealisee lu par le moteur (une ligne complète y est assignable). */
export type SerieEvaluee = Pick<SerieRealisee, 'repsRealisees' | 'chargeKg' | 'rpe' | 'notes'>

// Pourcentage cible par défaut de chaque type d'exercice (TypeExercice.pourcentageCibleDefault).
const POURCENTAGE_CIBLE_DEFAUT: Record<TypeExercice, number> = {
  COMPOSE_BAS: f32(0.05),
  COMPOSE_HAUT: f32(0.025),
  ISOLATION: f32(0.02),
  MACHINE: 0,
  PDC: 0,
}

// Écart relatif de reps en-dessous duquel un échec est considéré "léger" (presque réussi) plutôt que "marqué".
const SEUIL_ECART_LEGER = f32(0.15)

// Écart relatif de reps à partir duquel on flague une charge mal calibrée dès le 1er échec (bible §2.3/§2.5).
const SEUIL_ECART_FLAG = f32(0.3)

// RPE moyen à partir duquel on considère qu'il n'y a plus de marge, même en cas de succès (bible §4.5).
const RPE_SANS_MARGE = 9

const POURCENTAGE_DELOAD = f32(0.1)

// Plafond de saut : ne jamais proposer une hausse de charge > 10% en une fois (bible §4.5).
const PLAFOND_SAUT_PCT = f32(0.1)

/** Float? Kotlin : null conservé, sinon arrondi au Float 32 bits. */
const f32OuNull = (v: number | null | undefined): number | null => (v == null ? null : f32(v))

/**
 * true si la proposition doit être présentée à l'utilisateur pour validation (récap Oui/Non/Ajuster)
 * plutôt que persistée silencieusement : tout succès, et toute proposition de deload **quel que soit
 * le statut associé** (piège KNOWN_BUGS : un deload peut accompagner un statut d'échec).
 */
export function requiresValidation(proposition: PropositionProgression): boolean {
  return (
    proposition.statut === 'SUCCES' ||
    proposition.statut === 'SUCCES_SANS_MARGE' ||
    proposition.statut === 'NON_LOGGE' ||
    proposition.deload
  )
}

function maintien(statut: StatutExercice, cible: CibleExercice, compteur: number): PropositionProgression {
  return {
    statut,
    nouvelleChargeCible: f32OuNull(cible.chargeKg),
    nouveauRepsCible: cible.reps,
    nouvelleDureeCible: cible.dureeSec,
    nouveauCompteurEchec: compteur,
    deload: false,
    nouveauNombreSeries: null,
  }
}

export function evaluerExercice(
  config: ExerciceConfig,
  cible: CibleExercice,
  compteurEchecActuel: number,
  seriesRealisees: SerieEvaluee[],
  isBilateral: boolean,
  pasMateriel?: number | null,
  chargesAtteignables?: number[] | null,
): PropositionProgression {
  if (seriesRealisees.length === 0) return maintien('NON_LOGGE', cible, compteurEchecActuel)

  let resultat: ResultatBrut
  if (isBilateral) {
    // Côtés repérés par "G"/"D" dans les notes (insensible à la casse, comme contains(ignoreCase)).
    const cote1 = seriesRealisees.filter((s) => s.notes.toUpperCase().includes('G'))
    const cote2 = seriesRealisees.filter((s) => s.notes.toUpperCase().includes('D'))
    resultat = piorerResultat(evaluerSeries(config, cible, cote1), evaluerSeries(config, cible, cote2))
  } else {
    resultat = evaluerSeries(config, cible, seriesRealisees)
  }

  return appliquerCompteurEtDeload(config, cible, resultat, compteurEchecActuel, pasMateriel, chargesAtteignables)
}

// valeurAtteinte : plus petite valeur (reps ou durée) réellement loguée parmi les séries évaluées —
// permet de détecter un dépassement du haut de plage dès cette séance (bible §2.2).
interface ResultatBrut {
  statut: StatutExercice
  rpeMoyen: number | null
  valeurAtteinte: number | null
}

const RANG_SEVERITE: Record<StatutExercice, number> = {
  ECHEC_MARQUE: 3,
  ECHEC: 2,
  SUCCES_SANS_MARGE: 1,
  SUCCES: 0,
  NON_LOGGE: 0,
}

// Pire des deux côtés ; à sévérité égale, le premier (côté G) est retenu, comme en Kotlin.
function piorerResultat(a: ResultatBrut, b: ResultatBrut): ResultatBrut {
  return RANG_SEVERITE[a.statut] >= RANG_SEVERITE[b.statut] ? a : b
}

/** Une série isolée atteint-elle la cible (reps/durée @ charge) ? Bible §2.2. */
export function serieReussie(config: ExerciceConfig, cible: CibleExercice, serie: SerieEvaluee): boolean {
  if (config.repsType === 'DURATION') {
    // Exercice en durée : la charge n'est jamais comparée.
    if (cible.dureeSec == null) return true
    return (serie.repsRealisees ?? 0) >= cible.dureeSec
  }
  if (cible.reps == null) return true
  const repsOk = (serie.repsRealisees ?? 0) >= cible.reps
  const chargeOk = cible.chargeKg == null || f32(serie.chargeKg ?? 0) >= f32(cible.chargeKg)
  return repsOk && chargeOk
}

function evaluerSeries(config: ExerciceConfig, cible: CibleExercice, series: SerieEvaluee[]): ResultatBrut {
  if (series.length === 0) return { statut: 'NON_LOGGE', rpeMoyen: null, valeurAtteinte: null }

  const reference = config.repsType === 'DURATION' ? cible.dureeSec : cible.reps
  // Écart relatif (Float) entre la cible et la valeur réalisée, nul si pas de cible.
  const ecartRelatif = (s: SerieEvaluee): number => {
    if (reference == null || reference === 0) return 0
    return f32(Math.max(reference - (s.repsRealisees ?? 0), 0) / reference)
  }

  const total = series.length
  const echouees = series.filter((s) => !serieReussie(config, cible, s))
  const reussies = total - echouees.length
  // average() Kotlin : somme en Double des Float, puis toFloat().
  const rpes = series.flatMap((s) => (s.rpe == null ? [] : [f32(s.rpe)]))
  const rpeMoyen = rpes.length > 0 ? f32(rpes.reduce((acc, r) => acc + r, 0) / rpes.length) : null
  // Pire valeur réalisée parmi les séries de travail : garantit que TOUTES dépassent le seuil détecté.
  const valeurAtteinte = Math.min(...series.map((s) => s.repsRealisees ?? 0))
  const ecartMax = echouees.length > 0 ? Math.max(...echouees.map(ecartRelatif)) : null

  let statut: StatutExercice
  if (reussies === total) {
    statut = rpeMoyen != null && rpeMoyen >= RPE_SANS_MARGE ? 'SUCCES_SANS_MARGE' : 'SUCCES'
  } else if (reussies >= total - 1 && (ecartMax == null || ecartMax < SEUIL_ECART_LEGER)) {
    statut = 'ECHEC'
  } else {
    statut = (ecartMax ?? 0) >= SEUIL_ECART_FLAG ? 'ECHEC_MARQUE' : 'ECHEC'
  }
  return { statut, rpeMoyen, valeurAtteinte }
}

function appliquerCompteurEtDeload(
  config: ExerciceConfig,
  cible: CibleExercice,
  resultat: ResultatBrut,
  compteurEchecActuel: number,
  pasMateriel?: number | null,
  chargesAtteignables?: number[] | null,
): PropositionProgression {
  switch (resultat.statut) {
    case 'NON_LOGGE':
      return maintien('NON_LOGGE', cible, compteurEchecActuel)
    case 'SUCCES':
      return proposerMontee(config, cible, 0, pasMateriel, chargesAtteignables, resultat.valeurAtteinte)
    case 'SUCCES_SANS_MARGE':
      return maintien('SUCCES_SANS_MARGE', cible, 0)
    case 'ECHEC':
    case 'ECHEC_MARQUE': {
      const nouveauCompteur = compteurEchecActuel + 1
      const deload = nouveauCompteur >= config.seuilDeload || resultat.statut === 'ECHEC_MARQUE'
      return deload ? proposerDeload(config, cible) : maintien(resultat.statut, cible, nouveauCompteur)
    }
  }
}

/**
 * Que proposerait-on en cas de succès complet ? Fonction pure — utilisée à la clôture (statut déjà
 * SUCCES) et par le bandeau de progression live (sans `repsReellementAtteintes`).
 * `systemeProgression` absent ou inconnu : double progression (branche `DOUBLE, null` Kotlin).
 */
export function proposerMontee(
  config: ExerciceConfig,
  cible: CibleExercice,
  compteurEchecActuel: number,
  pasMateriel?: number | null,
  chargesAtteignables?: number[] | null,
  repsReellementAtteintes?: number | null,
): PropositionProgression {
  const base = maintien('SUCCES', cible, compteurEchecActuel)
  const nouvelleCharge = (): number => {
    const charge = f32(cible.chargeKg ?? 0)
    const increment = calculerIncrementQualitatif(
      charge,
      config.typeExercice,
      config.incrementPct,
      pasMateriel ?? null,
      chargesAtteignables ?? null,
      config.incrementKg,
    )
    return f32(charge + increment)
  }

  switch (config.systemeProgression) {
    case 'TEMPORELLE':
      return { ...base, nouvelleDureeCible: (cible.dureeSec ?? 0) + config.incrementDureeSec }
    case 'LINEAIRE':
      return { ...base, nouvelleChargeCible: nouvelleCharge() }
    default: {
      const { repsMax, repsMin } = config
      // Cas dépassement (bible §2.2) : si les reps réellement loguées atteignent déjà le haut de plage,
      // on saute directement au palier de charge, même si la cible affichée n'était pas au plafond.
      const repsReference = repsReellementAtteintes ?? cible.reps
      if (repsMax != null && repsMin != null && (repsReference ?? repsMax) >= repsMax) {
        if (config.isBodyweight) {
          return { ...base, nouveauRepsCible: repsMin, nouveauNombreSeries: config.nombreSeriesPrevues + 1 }
        }
        return { ...base, nouvelleChargeCible: nouvelleCharge(), nouveauRepsCible: repsMin }
      }
      return { ...base, nouveauRepsCible: (cible.reps ?? repsMin ?? 0) + 1 }
    }
  }
}

/**
 * Incrément qualitatif (bible §4.2/§4.3) : `max(pas_matériel, charge × %cible)`, plafonné à +10 %
 * (§4.5). Avec `chargesAtteignables` non vide : snapping sur la charge réellement composable la plus
 * proche ; sinon pas simple (`pasMateriel`) ou incrément manuel (legacy).
 */
export function calculerIncrementQualitatif(
  chargeActuelle: number,
  typeExercice: TypeExercice | null,
  incrementPctOverride: number | null,
  pasMateriel: number | null,
  chargesAtteignables: number[] | null,
  incrementKgManuel: number | null,
): number {
  const charge = f32(chargeActuelle)
  const pas = f32OuNull(pasMateriel)
  const manuel = f32OuNull(incrementKgManuel)
  const charges = chargesAtteignables?.map(f32) ?? []

  if (typeExercice == null && pas == null && charges.length === 0) return manuel ?? 0

  const pct = f32OuNull(incrementPctOverride) ?? (typeExercice ? POURCENTAGE_CIBLE_DEFAUT[typeExercice] : 0)

  if (charges.length > 0) {
    // Cible sous le plancher réellement composable : la combinatoire matériel ne s'applique pas à ce
    // point de départ (snapper forcerait un saut au plancher matériel) — repli sur l'incrément manuel.
    // reduce plutôt que Math.min(...) : la combinatoire de disques peut produire une longue liste.
    if (charge < charges.reduce((min, c) => Math.min(min, c))) return manuel ?? pas ?? 0
    const candidatsSuperieurs = charges.filter((c) => c > charge).sort((a, b) => a - b)
    const pasEstime = candidatsSuperieurs.length > 0 ? f32(candidatsSuperieurs[0] - charge) : (manuel ?? 0)
    const brut = Math.max(pasEstime, f32(charge * pct))
    const plafondSaut = Math.max(f32(charge * PLAFOND_SAUT_PCT), pasEstime)
    const cibleBrute = f32(charge + Math.min(brut, plafondSaut))
    // minByOrNull : à distance égale, le premier (le plus léger) l'emporte.
    let nouvelleCharge = charge
    let meilleureDistance = Infinity
    for (const c of candidatsSuperieurs) {
      const distance = Math.abs(f32(c - cibleBrute))
      if (distance < meilleureDistance) {
        meilleureDistance = distance
        nouvelleCharge = c
      }
    }
    return f32(nouvelleCharge - charge)
  }

  const pasEffectif = pas ?? manuel
  const brut = Math.max(pasEffectif ?? 0, f32(charge * pct))
  const plafondSaut = Math.max(f32(charge * PLAFOND_SAUT_PCT), pasEffectif ?? 0)
  return arrondirIncrement(Math.min(brut, plafondSaut), pasEffectif)
}

function proposerDeload(config: ExerciceConfig, cible: CibleExercice): PropositionProgression {
  const charge = f32OuNull(cible.chargeKg)
  // Poids de corps / charge externe fixe : pas de -10 % sur la charge, le retour à repsMin suffit.
  const nouvelleCharge =
    config.isBodyweight || charge == null
      ? charge
      : arrondirIncrement(f32(charge * f32(1 - POURCENTAGE_DELOAD)), f32OuNull(config.incrementKg))
  return {
    statut: 'ECHEC_MARQUE',
    nouvelleChargeCible: nouvelleCharge,
    nouveauRepsCible: config.repsMin ?? cible.reps,
    nouvelleDureeCible: cible.dureeSec,
    nouveauCompteurEchec: 0,
    deload: true,
    nouveauNombreSeries: null,
  }
}

// Arrondi au multiple du pas (Math.round Java = arrondi demi vers +∞, comme Math.round JS).
function arrondirIncrement(valeur: number, incrementKg: number | null): number {
  if (incrementKg == null || incrementKg <= 0) return valeur
  const pas = Math.round(f32(valeur / incrementKg))
  return f32(pas * incrementKg)
}
