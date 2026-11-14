import { parseTimestamp } from '../../core/common/parseTimestamp'
import type { SeanceRespirationDatee } from '../../core/db/repos/respiration'
import { ajouterJours } from '../endurance/calculCharge'
import { lundiDe } from '../home/semaine'
import { serieJours } from '../mobilite/regularite'
import { bornesPeriode, bornesPeriodePrecedente, type PeriodeId } from '../stats/periode'

// Régularité et statistiques de la respiration : fonctions pures sur les séances déjà lues (jours locaux yyyy-MM-dd).
// Une séance compte par sa durée de respiration (pauses exclues), enregistrée à la fin de la séance.

type Seance = Pick<SeanceRespirationDatee, 'date' | 'dureeSec' | 'methodeId' | 'methodeNom' | 'creeLe'>

const minutes = (secondes: number) => secondes / 60

/** Jours de suite avec séance, jusqu'à aujourd'hui (ou hier si aujourd'hui n'est pas encore fait). Même règle que la mobilité. */
export const serieDeJours = serieJours

/** Secondes de respiration par jour. */
export function dureeParJour(seances: readonly Seance[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of seances) m.set(s.date, (m.get(s.date) ?? 0) + s.dureeSec)
  return m
}

// ── Régularité de la semaine ─────────────────────────────────────────────────────────────────────────────────

export type EtatJourRespiration = 'atteint' | 'partiel' | 'vide' | 'aujourdhui' | 'avenir'

export interface JourRespiration {
  dateIso: string
  lettre: string
  /** Minutes de respiration ce jour-là (arrondies). */
  minutes: number
  etat: EtatJourRespiration
}

export interface BilanSemaineRespiration {
  jours: JourRespiration[]
  secondes: number
  seances: number
  /** Même point de la semaine précédente (lundi à ce même jour d'avant) : l'écart ne compare pas trois jours à sept. */
  secondesPrecedentes: number
  seancesPrecedentes: number
  /** Jours de la semaine, jusqu'à aujourd'hui, où l'objectif quotidien est atteint. */
  joursAtteints: number
}

const LETTRES = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export function bilanSemaine(seances: readonly Seance[], aujourdhuiIso: string, objectifMin: number): BilanSemaineRespiration {
  const debut = lundiDe(aujourdhuiIso)
  const parJour = dureeParJour(seances)
  const jours: JourRespiration[] = LETTRES.map((lettre, i) => {
    const dateIso = ajouterJours(debut, i)
    const sec = parJour.get(dateIso) ?? 0
    const etat: EtatJourRespiration =
      dateIso > aujourdhuiIso ? 'avenir' : sec >= objectifMin * 60 ? 'atteint' : sec > 0 ? 'partiel' : dateIso === aujourdhuiIso ? 'aujourdhui' : 'vide'
    return { dateIso, lettre, minutes: Math.round(minutes(sec)), etat }
  })
  const dans = (de: string, a: string) => seances.filter((s) => s.date >= de && s.date <= a)
  const courantes = dans(debut, aujourdhuiIso)
  const precedentes = dans(ajouterJours(debut, -7), ajouterJours(aujourdhuiIso, -7))
  return {
    jours,
    secondes: courantes.reduce((t, s) => t + s.dureeSec, 0),
    seances: courantes.length,
    secondesPrecedentes: precedentes.reduce((t, s) => t + s.dureeSec, 0),
    seancesPrecedentes: precedentes.length,
    joursAtteints: jours.filter((j) => j.etat === 'atteint').length,
  }
}

// ── Usage des méthodes ──────────────────────────────────────────────────────────────────────────────────────

/** Nombre de séances par méthode sur les 30 derniers jours (aujourd'hui compris). */
export function usage30Jours(seances: readonly Seance[], aujourdhuiIso: string): Map<string, number> {
  const debut = ajouterJours(aujourdhuiIso, -29)
  const m = new Map<string, number>()
  for (const s of seances) if (s.date >= debut && s.date <= aujourdhuiIso) m.set(s.methodeId, (m.get(s.methodeId) ?? 0) + 1)
  return m
}

/** Méthode la plus pratiquée sur 30 jours (au moins 3 séances, pour parler de « préférée »), la plus récente à égalité de nombre. */
export function methodePreferee(seances: readonly Seance[], aujourdhuiIso: string): { methodeId: string; nombre: number } | null {
  const usage = usage30Jours(seances, aujourdhuiIso)
  let meilleur: { methodeId: string; nombre: number; derniere: string } | null = null
  for (const [methodeId, nombre] of usage) {
    const derniere = seances.filter((s) => s.methodeId === methodeId).reduce((d, s) => (s.date > d ? s.date : d), '')
    if (meilleur === null || nombre > meilleur.nombre || (nombre === meilleur.nombre && derniere > meilleur.derniere)) meilleur = { methodeId, nombre, derniere }
  }
  return meilleur && meilleur.nombre >= 3 ? { methodeId: meilleur.methodeId, nombre: meilleur.nombre } : null
}

// ── Statistiques d'une période ───────────────────────────────────────────────────────────────────────────────

export type Moment = 'matin' | 'midi' | 'soir' | 'nuit'

/** Matin de 5 h à 11 h, midi de 11 h à 14 h, soir de 14 h à 21 h, nuit de 21 h à 5 h (heure locale de l'appareil). */
export function momentDe(creeLe: string): Moment | null {
  const ms = parseTimestamp(creeLe)
  if (ms === null) return null
  const h = new Date(ms).getHours()
  return h >= 5 && h < 11 ? 'matin' : h >= 11 && h < 14 ? 'midi' : h >= 14 && h < 21 ? 'soir' : 'nuit'
}

export interface StatsRespiration {
  secondes: number
  nombre: number
  /** Jours distincts avec au moins une séance. */
  jours: number
  moyenneSec: number
  /** Plus longue suite de jours consécutifs avec séance, dans la période. */
  plusLongueSerie: number
  /** Même durée juste avant (secondes) ; null pour « Tout ». */
  secondesPrecedentes: number | null
  methodes: { methodeId: string; nom: string; nombre: number; secondes: number }[]
  moments: Record<Moment, number>
}

function plusLongueSerie(jours: readonly string[]): number {
  const tries = [...new Set(jours)].sort()
  let meilleure = 0
  let courante = 0
  tries.forEach((j, i) => {
    courante = i > 0 && ajouterJours(tries[i - 1], 1) === j ? courante + 1 : 1
    meilleure = Math.max(meilleure, courante)
  })
  return meilleure
}

export function statsPeriode(seances: readonly Seance[], periode: PeriodeId, maintenant: Date): StatsRespiration {
  const { from, to } = bornesPeriode(periode, maintenant)
  const dans = seances.filter((s) => s.date >= from && s.date <= to)
  const precedente = bornesPeriodePrecedente(periode, maintenant)
  const secondes = dans.reduce((t, s) => t + s.dureeSec, 0)
  const parMethode = new Map<string, { nom: string; nombre: number; secondes: number; derniere: string }>()
  for (const s of dans) {
    const e = parMethode.get(s.methodeId) ?? { nom: s.methodeNom, nombre: 0, secondes: 0, derniere: '' }
    e.nombre++
    e.secondes += s.dureeSec
    // Nom le plus récent (une méthode personnalisée peut avoir été renommée)
    if (s.date >= e.derniere) {
      e.derniere = s.date
      e.nom = s.methodeNom
    }
    parMethode.set(s.methodeId, e)
  }
  const moments: Record<Moment, number> = { matin: 0, midi: 0, soir: 0, nuit: 0 }
  for (const s of dans) {
    const m = momentDe(s.creeLe)
    if (m) moments[m]++
  }
  const jours = new Set(dans.map((s) => s.date))
  return {
    secondes,
    nombre: dans.length,
    jours: jours.size,
    moyenneSec: dans.length > 0 ? secondes / dans.length : 0,
    plusLongueSerie: plusLongueSerie([...jours]),
    secondesPrecedentes: precedente ? seances.filter((s) => s.date >= precedente.from && s.date <= precedente.to).reduce((t, s) => t + s.dureeSec, 0) : null,
    methodes: [...parMethode.entries()]
      .map(([methodeId, e]) => ({ methodeId, nom: e.nom, nombre: e.nombre, secondes: e.secondes }))
      .sort((a, b) => b.secondes - a.secondes || b.nombre - a.nombre || a.nom.localeCompare(b.nom, 'fr')),
    moments,
  }
}

export interface SemaineMinutes {
  /** Lundi de la semaine. */
  debut: string
  secondes: number
  /** Semaine en cours : incomplète. */
  courante: boolean
}

/** Minutes des `n` dernières semaines (lundi au dimanche), la semaine en cours comprise, de la plus ancienne à la plus récente. */
export function minutesParSemaine(seances: readonly Seance[], aujourdhuiIso: string, n = 4): SemaineMinutes[] {
  const lundiCourant = lundiDe(aujourdhuiIso)
  return Array.from({ length: n }, (_, i) => {
    const debut = ajouterJours(lundiCourant, -7 * (n - 1 - i))
    const fin = ajouterJours(debut, 6)
    return { debut, secondes: seances.filter((s) => s.date >= debut && s.date <= fin).reduce((t, s) => t + s.dureeSec, 0), courante: i === n - 1 }
  })
}
