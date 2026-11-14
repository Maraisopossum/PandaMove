import type { ObjectifPlan } from '../../core/db/repos/objectifsPlan'
import type { Plan } from './plan'
import { joursEntre } from './plan'

// Échéances du plan : les jalons inscrits dans les séances de cardio et les objectifs saisis à la main, réunis. Un objectif qui reprend
// un jalon (même séance) ne compte qu'une fois. Fonctions pures.

/** Deux échéances à moins de ce nombre de jours rendent leurs affûtages incompatibles. */
export const SEUIL_CONFLIT_JOURS = 10

export interface Echeance {
  /** `s-<séance>` pour un jalon de séance, `o-<objectif>` pour un objectif saisi : sert d'adresse à la page jalon. */
  cle: string
  nom: string
  date: string
  discipline: 'course' | 'velo' | 'hyrox'
  priorite: 'A' | 'B' | 'C'
  statut: 'prevu' | 'fait' | 'abandonne'
  /** Temps visé en secondes (objectif). */
  cibleS: number | null
  resultatS: number | null
  seanceId: string | null
  objectifId: string | null
  /** Indice de la semaine dans le plan, quand l'échéance en fait partie. */
  semaine: number | null
}

export function construireEcheances(plan: Plan | null, objectifs: readonly ObjectifPlan[]): Echeance[] {
  const parSeance = new Map(objectifs.filter((o) => o.seanceId).map((o) => [o.seanceId as string, o]))
  const liste: Echeance[] = []
  for (const j of plan?.jalons ?? []) {
    const o = parSeance.get(j.seanceId)
    liste.push({
      cle: `s-${j.seanceId}`, nom: o?.nom ?? j.nom, date: o?.date ?? j.date, discipline: o?.discipline ?? j.genre, priorite: o?.priorite ?? 'A',
      statut: o?.statut ?? 'prevu', cibleS: o?.cibleS ?? null, resultatS: o?.resultatS ?? null, seanceId: j.seanceId, objectifId: o?.id ?? null, semaine: j.semaine,
    })
  }
  const dejaReprises = new Set(liste.map((e) => e.seanceId).filter(Boolean))
  for (const o of objectifs) {
    if (o.seanceId && dejaReprises.has(o.seanceId)) continue
    liste.push({
      cle: `o-${o.id}`, nom: o.nom, date: o.date, discipline: o.discipline, priorite: o.priorite, statut: o.statut, cibleS: o.cibleS, resultatS: o.resultatS,
      seanceId: o.seanceId, objectifId: o.id, semaine: null,
    })
  }
  return liste.sort((a, b) => a.date.localeCompare(b.date) || a.cle.localeCompare(b.cle))
}

/** Échéances prévues à moins de SEUIL_CONFLIT_JOURS jours de `date` (hors abandonnées et hors `exclureCle`). */
export function conflitsAvec(date: string, echeances: readonly Echeance[], exclureCle?: string): { echeance: Echeance; jours: number }[] {
  return echeances
    .filter((e) => e.statut !== 'abandonne' && e.cle !== exclureCle)
    .map((e) => ({ echeance: e, jours: Math.abs(joursEntre(e.date, date)) }))
    .filter((x) => x.jours < SEUIL_CONFLIT_JOURS)
    .sort((a, b) => a.jours - b.jours)
}

/** Paires d'échéances prévues trop proches les unes des autres. */
export function conflitsEntreEcheances(echeances: readonly Echeance[]): { a: Echeance; b: Echeance; jours: number }[] {
  const prevues = echeances.filter((e) => e.statut === 'prevu')
  const res: { a: Echeance; b: Echeance; jours: number }[] = []
  for (let i = 0; i < prevues.length; i++)
    for (let j = i + 1; j < prevues.length; j++) {
      const jours = Math.abs(joursEntre(prevues[i].date, prevues[j].date))
      if (jours < SEUIL_CONFLIT_JOURS) res.push({ a: prevues[i], b: prevues[j], jours })
    }
  return res
}

/** « 48:30 » ou « 1:10:00 » en secondes ; null si le texte n'est pas un temps (vide compris). */
export function lireTemps(texte: string): number | null {
  const m = /^\s*(?:(\d{1,3}):)?(\d{1,2}):(\d{2})\s*$/.exec(texte)
  if (!m) return null
  const [h, mn, s] = [Number(m[1] ?? 0), Number(m[2]), Number(m[3])]
  if (mn > 59 && m[1] !== undefined) return null
  if (s > 59) return null
  return h * 3600 + mn * 60 + s
}

/** Secondes en « 48:30 » ou « 1:10:00 ». */
export function formaterTemps(secondes: number): string {
  const h = Math.floor(secondes / 3600)
  const m = Math.floor((secondes % 3600) / 60)
  const s = secondes % 60
  const deux = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${deux(m)}:${deux(s)}` : `${m}:${deux(s)}`
}
