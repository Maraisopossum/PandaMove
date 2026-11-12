import type { Sortie } from '../../core/db/repos/sorties'

// Charge d'entraînement des sorties de course et de vélo : forme, fatigue et fraîcheur (modèle « performance management »,
// comme le PMC d'intervals.icu ou TrainingPeaks). Calcul entièrement local, fonctions pures.
//
//  - Chaque sortie vaut des points de charge : 100 points = une heure à l'intensité du seuil. La meilleure mesure disponible
//    est utilisée : puissance normalisée (avec FTP), sinon fréquence cardiaque (avec FC max), sinon effort ressenti (RPE),
//    sinon la durée seule (intensité modérée supposée).
//  - Forme (CTL) : moyenne mobile exponentielle de la charge quotidienne sur 42 jours ; fatigue (ATL) : sur 7 jours ;
//    fraîcheur (TSB) : forme de la veille moins fatigue de la veille. Un jour sans sortie compte pour 0.
//
// Ce sont des estimations : elles ne valent pas une mesure en laboratoire, mais suivent bien la tendance d'une semaine à l'autre.

export const CONSTANTE_FORME_JOURS = 42
export const CONSTANTE_FATIGUE_JOURS = 7

export type MethodeCharge = 'puissance' | 'frequence' | 'effort' | 'duree'

export interface ParametresCharge {
  /** Puissance au seuil (W) ; null : la puissance n'est pas utilisée. */
  ftpW: number | null
  /** FC maximale (bpm) ; null : la fréquence cardiaque n'est pas utilisée. */
  fcMax: number | null
  /** FC de repos (bpm). */
  fcRepos: number
}

export const FC_REPOS_PAR_DEFAUT = 55
/** Intensité (rapport à l'allure de seuil) supposée quand une sortie n'a que sa durée. */
const FACTEUR_DUREE_SEULE = 0.65
/** Fraction de la réserve cardiaque au seuil, référence du calcul de charge à la fréquence cardiaque. */
const RESERVE_AU_SEUIL = 0.85

export interface ChargeSortie {
  points: number
  methode: MethodeCharge
}

const borne = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

// TRIMP de Banister (coefficients génériques) d'une durée à une fraction de réserve cardiaque
const trimp = (minutes: number, reserve: number) => minutes * reserve * 0.64 * Math.exp(1.92 * reserve)
const TRIMP_UNE_HEURE_AU_SEUIL = trimp(60, RESERVE_AU_SEUIL)

/** Charge d'une sortie en points, et la mesure utilisée. Une sortie sans durée vaut 0. */
export function chargeSortie(s: Sortie, p: ParametresCharge): ChargeSortie {
  const heures = (s.dureeS ?? 0) / 3600
  if (!(heures > 0)) return { points: 0, methode: 'duree' }
  if (s.puissanceNormW && p.ftpW && p.ftpW > 0) {
    const intensite = s.puissanceNormW / p.ftpW
    return { points: heures * intensite * intensite * 100, methode: 'puissance' }
  }
  if (s.fcMoy && p.fcMax && p.fcMax > p.fcRepos) {
    const reserve = borne((s.fcMoy - p.fcRepos) / (p.fcMax - p.fcRepos), 0, 1)
    return { points: (trimp(heures * 60, reserve) / TRIMP_UNE_HEURE_AU_SEUIL) * 100, methode: 'frequence' }
  }
  if (s.rpe) {
    // RPE 7 (« dur ») ≈ intensité de seuil
    const intensite = s.rpe / 7
    return { points: heures * intensite * intensite * 100, methode: 'effort' }
  }
  return { points: heures * FACTEUR_DUREE_SEULE * FACTEUR_DUREE_SEULE * 100, methode: 'duree' }
}

/**
 * Paramètres déduits des sorties quand l'utilisateur n'en a pas fixé : FC max = la plus haute FC enregistrée ; FTP ≈ 95 % de la
 * meilleure puissance normalisée d'une sortie d'au moins 20 minutes (approximation prudente).
 */
export function estimerParametres(sorties: readonly Sortie[]): ParametresCharge {
  let fcMax = 0
  let np = 0
  for (const s of sorties) {
    fcMax = Math.max(fcMax, s.fcMax ?? 0, s.fcMoy ?? 0)
    if (s.puissanceNormW && (s.dureeS ?? 0) >= 1200) np = Math.max(np, s.puissanceNormW)
  }
  return { ftpW: np > 0 ? Math.round(np * 0.95) : null, fcMax: fcMax > 0 ? fcMax : null, fcRepos: FC_REPOS_PAR_DEFAUT }
}

/** Réglages de l'utilisateur (champs absents = valeur estimée). */
export interface ReglagesCharge {
  ftpW?: number
  fcMax?: number
  fcRepos?: number
}

/** Paramètres effectifs : réglage de l'utilisateur s'il est valide, sinon estimation. */
export function parametresEffectifs(sorties: readonly Sortie[], reglages: ReglagesCharge): ParametresCharge {
  const estimes = estimerParametres(sorties)
  const valide = (v: number | undefined, min: number, max: number) => (typeof v === 'number' && v >= min && v <= max ? Math.round(v) : null)
  return {
    ftpW: valide(reglages.ftpW, 50, 600) ?? estimes.ftpW,
    fcMax: valide(reglages.fcMax, 120, 230) ?? estimes.fcMax,
    fcRepos: valide(reglages.fcRepos, 30, 100) ?? estimes.fcRepos,
  }
}

export interface JourCharge {
  date: string
  /** Charge du jour, en points. */
  charge: number
  /** Forme (CTL), fin de journée. */
  forme: number
  /** Fatigue (ATL), fin de journée. */
  fatigue: number
  /** Fraîcheur (TSB) : forme de la veille moins fatigue de la veille. */
  fraicheur: number
}

const MS_PAR_JOUR = 86_400_000
const versUtc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
const depuisUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** Date ISO `n` jours après `iso` (calendrier, sans effet de l'heure d'été). */
export const ajouterJours = (iso: string, n: number) => depuisUtc(versUtc(iso) + n * MS_PAR_JOUR)

/** Garde-fou : une sortie très ancienne ne doit pas allonger le calcul sans fin. */
const JOURS_MAX = 3 * 366

/**
 * Série quotidienne de la première sortie à `finIso` (au plus ~3 ans). Les sorties postérieures à `finIso` sont ignorées.
 * Sans sortie : liste vide.
 */
export function calculerSerieCharge(sorties: readonly Sortie[], p: ParametresCharge, finIso: string): JourCharge[] {
  const parJour = new Map<string, number>()
  for (const s of sorties) {
    if (s.date > finIso) continue
    parJour.set(s.date, (parJour.get(s.date) ?? 0) + chargeSortie(s, p).points)
  }
  if (parJour.size === 0) return []
  const premier = [...parJour.keys()].sort()[0]
  const debut = versUtc(premier) < versUtc(finIso) - JOURS_MAX * MS_PAR_JOUR ? ajouterJours(finIso, -JOURS_MAX) : premier
  const serie: JourCharge[] = []
  let forme = 0
  let fatigue = 0
  for (let d = debut; d <= finIso; d = ajouterJours(d, 1)) {
    const charge = parJour.get(d) ?? 0
    const fraicheur = forme - fatigue
    forme += (charge - forme) / CONSTANTE_FORME_JOURS
    fatigue += (charge - fatigue) / CONSTANTE_FATIGUE_JOURS
    serie.push({ date: d, charge, forme, fatigue, fraicheur })
  }
  return serie
}

export interface EtatForme {
  libelle: string
  aide: string
}

/** Lecture de la fraîcheur (TSB), selon les repères usuels du modèle. */
export function etatForme(fraicheur: number): EtatForme {
  if (fraicheur < -30) return { libelle: 'Très fatigué', aide: 'Charge très élevée : risque de surcharge, prévoyez de la récupération.' }
  if (fraicheur < -10) return { libelle: 'Charge productive', aide: 'Vous accumulez de la forme : fatigue normale d’un bloc d’entraînement.' }
  if (fraicheur <= 5) return { libelle: 'Équilibre', aide: 'Charge et récupération sont proches : état stable.' }
  if (fraicheur <= 25) return { libelle: 'Frais', aide: 'Bonne fraîcheur : un bon moment pour une séance dure ou une course.' }
  return { libelle: 'Désentraîné', aide: 'Très frais : la forme baisse faute de charge.' }
}

/** Mesure utilisée par chaque sortie, pour dire d'où viennent les chiffres. */
export function repartitionMethodes(sorties: readonly Sortie[], p: ParametresCharge): Record<MethodeCharge, number> {
  const r: Record<MethodeCharge, number> = { puissance: 0, frequence: 0, effort: 0, duree: 0 }
  for (const s of sorties) if ((s.dureeS ?? 0) > 0) r[chargeSortie(s, p).methode]++
  return r
}
