import { lundiDe } from '../calendar/chargeCalendrier'
import { ajouterJours } from '../calendar/grille'

// Plan de préparation Hyrox : généré à la demande à partir de réglages (durée, séances par semaine, affûtage, semaines allégées). Aucun
// nombre de semaines imposé. Les réglages sont gardés dans `repartition_json` de l'objectif, à côté de la répartition des temps ;
// le plan lui-même n'est jamais enregistré, il se recalcule.

export type PhaseHyrox = 'base' | 'construction' | 'specifique' | 'affutage'
export type TypeSeanceHyrox = 'course' | 'stations' | 'mixte' | 'simulation'

export const LIBELLE_PHASE_HYROX: Record<PhaseHyrox, string> = { base: 'Base', construction: 'Construction', specifique: 'Spécifique', affutage: 'Affûtage' }
export const LIBELLE_TYPE_HYROX: Record<TypeSeanceHyrox, string> = { course: 'Course', stations: 'Stations', mixte: 'Mixte', simulation: 'Simulation' }

export const SEMAINES_MIN = 2
export const SEMAINES_MAX = 52
export const SEANCES_MIN = 2
export const SEANCES_MAX = 6
export const AFFUTAGE_MAX = 3

export interface ReglagesPlanHyrox {
  /** Lundi de la première semaine (yyyy-MM-dd) ; ignoré quand `finSurCourse` est actif et qu'une date de course existe. */
  debut: string | null
  semaines: number
  seancesParSemaine: number
  /** Semaines d'affûtage avant la fin du plan (0 à 3). */
  affutageSemaines: number
  /** Une semaine allégée toutes les N semaines (3 ou 4) ; 0 = jamais. */
  allegeeToutesLes: 0 | 3 | 4
  /** Inclure des simulations chronométrées dans la phase spécifique. */
  simulations: boolean
  /** Placer la fin du plan sur la semaine de la course quand une date est fixée. */
  finSurCourse: boolean
}

export const REGLAGES_PLAN_HYROX_DEFAUT: ReglagesPlanHyrox = {
  debut: null, semaines: 12, seancesParSemaine: 4, affutageSemaines: 1, allegeeToutesLes: 4, simulations: true, finSurCourse: true,
}

const entier = (v: unknown, defaut: number, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : defaut

/** Réglages lus dans le JSON de l'objectif (champ `plan`), avec valeurs par défaut et bornes. */
export function lireReglagesPlanHyrox(json: string | null | undefined): ReglagesPlanHyrox {
  const d = REGLAGES_PLAN_HYROX_DEFAUT
  try {
    const brut = json ? (JSON.parse(json) as { plan?: Record<string, unknown> }).plan : undefined
    if (!brut || typeof brut !== 'object') return { ...d }
    const debut = typeof brut.debut === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(brut.debut) ? brut.debut : null
    return {
      debut,
      semaines: entier(brut.semaines, d.semaines, SEMAINES_MIN, SEMAINES_MAX),
      seancesParSemaine: entier(brut.seancesParSemaine, d.seancesParSemaine, SEANCES_MIN, SEANCES_MAX),
      affutageSemaines: entier(brut.affutageSemaines, d.affutageSemaines, 0, AFFUTAGE_MAX),
      allegeeToutesLes: brut.allegeeToutesLes === 3 || brut.allegeeToutesLes === 4 ? brut.allegeeToutesLes : brut.allegeeToutesLes === 0 ? 0 : d.allegeeToutesLes,
      simulations: typeof brut.simulations === 'boolean' ? brut.simulations : d.simulations,
      finSurCourse: typeof brut.finSurCourse === 'boolean' ? brut.finSurCourse : d.finSurCourse,
    }
  } catch {
    return { ...d }
  }
}

/** Ajoute (ou remplace) les réglages du plan dans le JSON de l'objectif, sans toucher aux autres champs (répartition des temps). */
export function ecrireReglagesPlanHyrox(json: string | null | undefined, r: ReglagesPlanHyrox): string {
  let base: Record<string, unknown> = {}
  try {
    const v = json ? (JSON.parse(json) as unknown) : null
    if (v && typeof v === 'object' && !Array.isArray(v)) base = v as Record<string, unknown>
  } catch {
    base = {}
  }
  return JSON.stringify({ ...base, plan: r })
}

export interface SeanceHyrox {
  /** yyyy-MM-dd */
  date: string
  type: TypeSeanceHyrox
  titre: string
  detail: string
  dureeMin: number
}

export interface SemaineHyrox {
  rang: number
  debut: string
  phase: PhaseHyrox
  allegee: boolean
  seances: SeanceHyrox[]
}

// Jours de la semaine (0 = lundi) selon le nombre de séances : on espace les séances et on garde au moins un jour de repos.
const JOURS: Record<number, number[]> = { 2: [1, 5], 3: [1, 3, 5], 4: [0, 2, 4, 6], 5: [0, 1, 3, 4, 6], 6: [0, 1, 2, 4, 5, 6] }

// Séances d'une semaine par phase, dans l'ordre des créneaux ; la dernière est la séance « longue » ou spécifique de la semaine.
const MODELES: Record<PhaseHyrox, TypeSeanceHyrox[]> = {
  base: ['course', 'stations', 'course', 'stations', 'course', 'stations'],
  construction: ['course', 'stations', 'mixte', 'course', 'stations', 'mixte'],
  specifique: ['course', 'stations', 'mixte', 'course', 'stations', 'simulation'],
  affutage: ['course', 'mixte', 'stations', 'course', 'mixte', 'stations'],
}

const DUREE_DE_BASE: Record<PhaseHyrox, Record<TypeSeanceHyrox, number>> = {
  base: { course: 45, stations: 45, mixte: 50, simulation: 60 },
  construction: { course: 55, stations: 50, mixte: 60, simulation: 70 },
  specifique: { course: 55, stations: 50, mixte: 65, simulation: 75 },
  affutage: { course: 35, stations: 30, mixte: 35, simulation: 40 },
}

const TITRE: Record<TypeSeanceHyrox, Record<PhaseHyrox, string>> = {
  course: { base: 'Footing facile', construction: 'Course et fractionné', specifique: 'Allure de course Hyrox', affutage: 'Footing de décrassage' },
  stations: { base: 'Force-endurance : stations', construction: 'Stations sous charge', specifique: 'Stations à l’allure de course', affutage: 'Stations légères, geste propre' },
  mixte: { base: 'Mixte 1 km + station', construction: '4 × (1 km + station)', specifique: '6 × (1 km + station) enchaînés', affutage: '3 × (1 km + station) souple' },
  simulation: { base: 'Simulation partielle', construction: 'Simulation partielle', specifique: 'Simulation chronométrée', affutage: 'Simulation courte' },
}

const DETAIL: Record<TypeSeanceHyrox, string> = {
  course: 'Allure confortable, respiration facile, sans forcer.',
  stations: 'Deux ou trois stations en séries : charge de votre catégorie, technique d’abord, puis vitesse.',
  mixte: 'Un kilomètre de course puis une station, enchaînés avec peu de repos : c’est la forme de la course.',
  simulation: 'À chronométrer dans « Simulation » : partielle (4 × 1 km + 4 stations) ou complète selon votre forme.',
}

/** Répartition des semaines entre les phases : affûtage à la fin, le reste en base (35 %), construction (40 %) et spécifique (25 %). */
export function repartirPhases(semaines: number, affutage: number): PhaseHyrox[] {
  const aff = Math.min(affutage, Math.max(0, semaines - 1))
  const reste = semaines - aff
  let base = Math.round(reste * 0.35)
  let spec = Math.round(reste * 0.25)
  if (reste >= 3) {
    base = Math.max(1, base)
    spec = Math.max(1, spec)
  }
  // Une préparation très courte saute la base puis la construction plutôt que de les réduire à une demi-semaine
  if (reste < 3) {
    base = 0
    spec = reste
  }
  const construction = Math.max(0, reste - base - spec)
  return [...Array<PhaseHyrox>(base).fill('base'), ...Array<PhaseHyrox>(construction).fill('construction'), ...Array<PhaseHyrox>(spec).fill('specifique'), ...Array<PhaseHyrox>(aff).fill('affutage')]
}

/** Lundi de départ du plan : la semaine de la course est la dernière quand `finSurCourse` est actif et qu'une date existe. */
export function debutDuPlan(r: ReglagesPlanHyrox, dateCourse: string | null, aujourdhui: string): string {
  if (r.finSurCourse && dateCourse) return ajouterJours(lundiDe(dateCourse), -7 * (r.semaines - 1))
  return lundiDe(r.debut ?? aujourdhui)
}

/** Génère le plan. Aucune écriture : le résultat se recalcule à chaque réglage. */
export function genererPlanHyrox(r: ReglagesPlanHyrox, dateCourse: string | null, aujourdhui: string): SemaineHyrox[] {
  const debut = debutDuPlan(r, dateCourse, aujourdhui)
  const phases = repartirPhases(r.semaines, r.affutageSemaines)
  const jours = JOURS[r.seancesParSemaine] ?? JOURS[4]
  return phases.map((phase, i) => {
    const allegee = r.allegeeToutesLes > 0 && phase !== 'affutage' && (i + 1) % r.allegeeToutesLes === 0
    const derniere = i === phases.length - 1
    const nb = derniere && phase === 'affutage' ? Math.max(SEANCES_MIN, r.seancesParSemaine - 1) : r.seancesParSemaine
    const creneaux = jours.slice(0, nb)
    const modele = MODELES[phase]
    const seances = creneaux.map<SeanceHyrox>((jour, k) => {
      let type = modele[Math.min(k, modele.length - 1)]
      // Dernier créneau : la simulation n'apparaît qu'une semaine sur deux, et jamais si elle est coupée ou en semaine allégée
      if (type === 'simulation' && (!r.simulations || allegee || i % 2 === 1)) type = 'mixte'
      // La dernière semaine d'affûtage reste très légère : pas de simulation, pas de séance mixte longue
      if (derniere && phase === 'affutage' && type === 'mixte') type = 'course'
      const facteur = allegee ? 0.7 : 1
      return {
        date: ajouterJours(debut, 7 * i + jour), type, titre: TITRE[type][phase], detail: DETAIL[type],
        dureeMin: Math.round((DUREE_DE_BASE[phase][type] * facteur) / 5) * 5,
      }
    })
    return { rang: i + 1, debut: ajouterJours(debut, 7 * i), phase, allegee, seances }
  })
}

export const dureeSemaine = (s: SemaineHyrox) => s.seances.reduce((t, x) => t + x.dureeMin, 0)
