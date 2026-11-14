import { minutesDeDetail, lundiDe, DUREE_DEFAUT_MIN } from '../calendar/chargeCalendrier'
import { ajouterJours } from '../calendar/grille'
import type { GenreCardio, SeanceCardio } from '../../core/db/repos/seancesCardio'
import { deduirePhases, type ParametresPhases, type Phase } from './phases'
import type { MesureReussite } from './reglagesPlans'

// Plan d'endurance dérivé des séances de cardio déjà planifiées (course et vélo) : aucune table de plus. Les semaines vont du lundi
// de la première séance à la dernière ; les séances facultatives ne comptent ni dans le prévu ni dans le taux.

export interface JalonPlan {
  seanceId: string
  genre: GenreCardio
  nom: string
  date: string
  /** Indice de la semaine du jalon dans le plan. */
  semaine: number
}

export interface SemainePlan {
  /** Rang à partir de 1. */
  rang: number
  debut: string
  phase: Phase
  prevuMin: number
  realiseMin: number
  prevues: number
  faites: number
  jalon: JalonPlan | null
}

export interface Plan {
  semaines: SemainePlan[]
  jalons: JalonPlan[]
}

const dureeMin = (s: SeanceCardio) => minutesDeDetail(s.detail) ?? DUREE_DEFAUT_MIN

/** Jours entiers de `a` à `b` (yyyy-MM-dd) ; négatif si `b` précède `a`. */
export const joursEntre = (a: string, b: string) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8))) / 86_400_000)

/** Construit le plan ; null sans aucune séance. */
export function construirePlan(seances: readonly SeanceCardio[], parametres?: ParametresPhases): Plan | null {
  if (seances.length === 0) return null
  const dates = seances.map((s) => s.date).sort()
  const premier = lundiDe(dates[0])
  const dernier = lundiDe(dates[dates.length - 1])
  const nb = joursEntre(premier, dernier) / 7 + 1
  const debuts = Array.from({ length: nb }, (_, i) => ajouterJours(premier, 7 * i))
  const indice = (date: string) => debuts.indexOf(lundiDe(date))

  const prevu = new Array<number>(nb).fill(0)
  const realise = new Array<number>(nb).fill(0)
  const prevues = new Array<number>(nb).fill(0)
  const faites = new Array<number>(nb).fill(0)
  const jalons: JalonPlan[] = []
  for (const s of seances) {
    const i = indice(s.date)
    if (i < 0) continue
    if (s.jalon) jalons.push({ seanceId: s.id, genre: s.genre, nom: s.jalon, date: s.date, semaine: i })
    if (s.optionnelle) continue
    prevu[i] += dureeMin(s)
    prevues[i] += 1
    if (s.isValidated) {
      realise[i] += dureeMin(s)
      faites[i] += 1
    }
  }
  jalons.sort((a, b) => a.date.localeCompare(b.date))
  const phases = deduirePhases(prevu, jalons.map((j) => j.semaine), parametres)
  const semaines = debuts.map<SemainePlan>((debut, i) => ({
    rang: i + 1, debut, phase: phases[i], prevuMin: prevu[i], realiseMin: realise[i], prevues: prevues[i], faites: faites[i],
    jalon: jalons.find((j) => j.semaine === i) ?? null,
  }))
  return { semaines, jalons }
}

/** Indice de la semaine qui contient `dateIso` ; -1 avant le début du plan, nombre de semaines après la fin. */
export function semaineCourante(plan: Plan, dateIso: string): number {
  const lundi = lundiDe(dateIso)
  if (lundi < plan.semaines[0].debut) return -1
  const i = plan.semaines.findIndex((s) => s.debut === lundi)
  return i < 0 ? plan.semaines.length : i
}

export interface Realisation {
  /** Taux en % (0 à 100+), null sans séance prévue jusque-là. */
  tauxPct: number | null
  faites: number
  prevues: number
  prevuMin: number
  realiseMin: number
}

/** Réalisation cumulée des semaines déjà commencées (jusqu'à la semaine courante comprise), selon la mesure choisie. */
export function realisationJusquA(plan: Plan, indiceCourant: number, mesure: MesureReussite): Realisation {
  const fin = Math.min(indiceCourant, plan.semaines.length - 1)
  const r = { faites: 0, prevues: 0, prevuMin: 0, realiseMin: 0 }
  for (const w of plan.semaines.slice(0, fin + 1)) {
    r.faites += w.faites
    r.prevues += w.prevues
    r.prevuMin += w.prevuMin
    r.realiseMin += w.realiseMin
  }
  const parSeances = r.prevues > 0 ? (r.faites / r.prevues) * 100 : null
  const parDuree = r.prevuMin > 0 ? (r.realiseMin / r.prevuMin) * 100 : null
  const taux = mesure === 'seances' ? parSeances : mesure === 'duree' ? parDuree : parSeances !== null && parDuree !== null ? (parSeances + parDuree) / 2 : null
  return { ...r, tauxPct: taux === null ? null : Math.round(taux) }
}
