import { dateIsoLocale } from '../../core/common/dates'
import { DUREES_MIN, EXERCICES, MOMENTS, TOUS_TYPES, TOUTES_ZONES, type MomentSeance, type SportId, type TypeExercice, type ZoneCorps } from './donnees'
import { dureeTotale, type Etape, type PlanSeance } from './generer'

// Stockage local de la mobilité : dernier choix et séance en cours de préparation, propres à l'appareil (localStorage /
// sessionStorage). L'historique des séances faites est synchronisé (table seances_mobilite, migration 0012) : l'ancien
// historique du navigateur n'est plus que relu, une fois, pour être repris en base (useHistoriqueMobilite), puis effacé.
// Toute lecture tolère un stockage absent ou corrompu et revient à une valeur par défaut.

const CLE_CHOIX = 'pandamove.mobilite.choix'
const CLE_PLAN = 'pandamove.mobilite.plan'
const CLE_HISTORIQUE = 'pandamove.mobilite.historique'

export interface ChoixMobilite {
  minutes: number
  zones: ZoneCorps[]
  moment: MomentSeance
  sport: SportId | null
  /** Types d'exercices admis (au moins un). */
  types: TypeExercice[]
}

export const CHOIX_PAR_DEFAUT: ChoixMobilite = { minutes: 10, zones: [], moment: 'libre', sport: null, types: TOUS_TYPES }

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
const estSport = (v: unknown): v is SportId => v === 'seule' || v === 'course' || v === 'velo' || v === 'renforcement' || v === 'bureau'
const estType = (v: unknown): v is TypeExercice => TOUS_TYPES.includes(v as TypeExercice)

// Choix lu dans un stockage ou une routine : toute valeur inconnue revient à la valeur par défaut, et les types gardent au moins un élément.
export function normaliserChoix(brut: unknown): ChoixMobilite {
  const v = (brut && typeof brut === 'object' ? brut : null) as Partial<ChoixMobilite> | null
  const demandes: unknown[] = Array.isArray(v?.types) ? v.types : []
  const types = TOUS_TYPES.filter((t) => demandes.includes(t))
  return {
    minutes: typeof v?.minutes === 'number' && v.minutes >= 1 && v.minutes <= 120 ? Math.round(v.minutes) : CHOIX_PAR_DEFAUT.minutes,
    zones: Array.isArray(v?.zones) ? v.zones.filter(estZone) : [],
    moment: estMoment(v?.moment) ? v.moment : CHOIX_PAR_DEFAUT.moment,
    sport: estSport(v?.sport) ? v.sport : null,
    types: types.length > 0 ? types : TOUS_TYPES,
  }
}

export const lireChoix = (): ChoixMobilite => normaliserChoix(lireJson(local(), CLE_CHOIX))

// La base n'accepte que les quatre sports d'origine (contrainte de la migration 0012) : « Mobilité seule » s'enregistre sans sport.
export const sportEnregistre = (sport: SportId | null): Exclude<SportId, 'seule'> | null => (sport === 'seule' ? null : sport)

export const ecrireChoix = (c: ChoixMobilite) => ecrire(local(), CLE_CHOIX, c)

// Plan : seuls les identifiants d'exercices et leurs durées sont gardés, le catalogue fait le reste (un exercice retiré du
// catalogue entre deux versions est simplement ignoré).
interface PlanStocke {
  minutes: number
  zones: ZoneCorps[]
  moment: MomentSeance
  types?: TypeExercice[]
  graine: number
  etapes: { id: string; dureeS: number }[]
}

export const ecrirePlan = (p: PlanSeance) =>
  ecrire(session(), CLE_PLAN, { minutes: p.minutes, zones: p.zones, moment: p.moment, types: p.types, graine: p.graine, etapes: p.etapes.map((x) => ({ id: x.exercice.id, dureeS: x.dureeS })) } satisfies PlanStocke)

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
    types: Array.isArray(v.types) ? v.types.filter(estType) : undefined,
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

// Après la reprise en base : l'historique du navigateur n'a plus lieu d'être.
export function effacerHistoriqueLocal(): void {
  try {
    local()?.removeItem(CLE_HISTORIQUE)
  } catch {
    // stockage bloqué : la reprise, rejouable sans doublon, sera simplement retentée
  }
}

// Séances faites dans les 7 derniers jours (aujourd'hui compris) et total de minutes.
export function bilanSemaine(historique: SeanceFaite[], maintenant: Date): { seances: number; minutes: number } {
  const debut = dateIsoLocale(new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() - 6))
  const recentes = historique.filter((s) => s.date >= debut)
  return { seances: recentes.length, minutes: Math.round(recentes.reduce((t, s) => t + s.dureeS, 0) / 60) }
}
