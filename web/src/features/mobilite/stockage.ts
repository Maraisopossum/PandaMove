import { dateIsoLocale } from '../../core/common/dates'
import { DUREES_MIN, EXERCICES, MOMENTS, TOUTES_ZONES, type MomentSeance, type SportId, type ZoneCorps } from './donnees'
import { dureeTotale, type Etape, type PlanSeance } from './generer'

// Stockage local de la mobilité : dernier choix, séance en cours de préparation et historique des séances faites. Tout reste
// sur l'appareil (localStorage / sessionStorage) : aucune table, aucune synchronisation. Toute lecture tolère un stockage absent
// ou corrompu et revient à une valeur par défaut.

const CLE_CHOIX = 'pandamove.mobilite.choix'
const CLE_PLAN = 'pandamove.mobilite.plan'
const CLE_HISTORIQUE = 'pandamove.mobilite.historique'
const HISTORIQUE_MAX = 60

export interface ChoixMobilite {
  minutes: number
  zones: ZoneCorps[]
  moment: MomentSeance
  sport: SportId | null
}

export const CHOIX_PAR_DEFAUT: ChoixMobilite = { minutes: 10, zones: [], moment: 'libre', sport: null }

function lireJson(stockage: Storage | undefined, cle: string): unknown {
  try {
    return JSON.parse(stockage?.getItem(cle) ?? 'null')
  } catch {
    return null
  }
}

function ecrire(stockage: Storage | undefined, cle: string, valeur: unknown): void {
  try {
    stockage?.setItem(cle, JSON.stringify(valeur))
  } catch {
    // stockage plein ou bloqué : le choix n'est simplement pas retenu
  }
}

const local = () => (typeof localStorage === 'undefined' ? undefined : localStorage)
const session = () => (typeof sessionStorage === 'undefined' ? undefined : sessionStorage)

const estMoment = (v: unknown): v is MomentSeance => MOMENTS.some((m) => m.id === v)
const estZone = (v: unknown): v is ZoneCorps => TOUTES_ZONES.includes(v as ZoneCorps)
const estSport = (v: unknown): v is SportId => v === 'course' || v === 'velo' || v === 'renforcement' || v === 'bureau'

export function lireChoix(): ChoixMobilite {
  const v = lireJson(local(), CLE_CHOIX) as Partial<ChoixMobilite> | null
  return {
    minutes: typeof v?.minutes === 'number' && v.minutes >= 1 && v.minutes <= 120 ? Math.round(v.minutes) : CHOIX_PAR_DEFAUT.minutes,
    zones: Array.isArray(v?.zones) ? v.zones.filter(estZone) : [],
    moment: estMoment(v?.moment) ? v.moment : CHOIX_PAR_DEFAUT.moment,
    sport: estSport(v?.sport) ? v.sport : null,
  }
}

export const ecrireChoix = (c: ChoixMobilite) => ecrire(local(), CLE_CHOIX, c)

// Plan : seuls les identifiants d'exercices et leurs durées sont gardés, le catalogue fait le reste (un exercice retiré du
// catalogue entre deux versions est simplement ignoré).
interface PlanStocke {
  minutes: number
  zones: ZoneCorps[]
  moment: MomentSeance
  graine: number
  etapes: { id: string; dureeS: number }[]
}

export const ecrirePlan = (p: PlanSeance) =>
  ecrire(session(), CLE_PLAN, { minutes: p.minutes, zones: p.zones, moment: p.moment, graine: p.graine, etapes: p.etapes.map((x) => ({ id: x.exercice.id, dureeS: x.dureeS })) } satisfies PlanStocke)

export function lirePlan(): PlanSeance | null {
  const v = lireJson(session(), CLE_PLAN) as Partial<PlanStocke> | null
  if (!v || !Array.isArray(v.etapes)) return null
  const etapes: Etape[] = v.etapes.flatMap((x) => {
    const exercice = EXERCICES.find((ex) => ex.id === x?.id)
    return exercice && typeof x.dureeS === 'number' && x.dureeS > 0 ? [{ exercice, dureeS: x.dureeS }] : []
  })
  if (etapes.length === 0) return null
  return {
    minutes: typeof v.minutes === 'number' ? v.minutes : DUREES_MIN[1],
    zones: Array.isArray(v.zones) ? v.zones.filter(estZone) : [],
    moment: estMoment(v.moment) ? v.moment : 'libre',
    graine: typeof v.graine === 'number' ? v.graine : 1,
    etapes,
    dureeTotaleS: dureeTotale(etapes),
  }
}

export interface SeanceFaite {
  /** Jour local (yyyy-MM-dd). */
  date: string
  dureeS: number
  exercices: number
  zones: ZoneCorps[]
  sport: SportId | null
}

export function lireHistorique(): SeanceFaite[] {
  const v = lireJson(local(), CLE_HISTORIQUE)
  if (!Array.isArray(v)) return []
  return v.flatMap((x: Partial<SeanceFaite>) =>
    typeof x?.date === 'string' && typeof x.dureeS === 'number' && typeof x.exercices === 'number'
      ? [{ date: x.date, dureeS: x.dureeS, exercices: x.exercices, zones: Array.isArray(x.zones) ? x.zones.filter(estZone) : [], sport: estSport(x.sport) ? x.sport : null }]
      : [],
  )
}

export function ajouterSeance(s: SeanceFaite): SeanceFaite[] {
  const suite = [s, ...lireHistorique()].slice(0, HISTORIQUE_MAX)
  ecrire(local(), CLE_HISTORIQUE, suite)
  return suite
}

// Séances faites dans les 7 derniers jours (aujourd'hui compris) et total de minutes.
export function bilanSemaine(historique: SeanceFaite[], maintenant: Date): { seances: number; minutes: number } {
  const debut = dateIsoLocale(new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() - 6))
  const recentes = historique.filter((s) => s.date >= debut)
  return { seances: recentes.length, minutes: Math.round(recentes.reduce((t, s) => t + s.dureeS, 0) / 60) }
}
