import { minutesDeDetail, lundiDe, DUREE_DEFAUT_MIN } from '../calendar/chargeCalendrier'
import { ajouterJours } from '../calendar/grille'
import type { GenreCardio, SeanceCardio } from '../../core/db/repos/seancesCardio'
import type { Sortie } from '../../core/db/repos/sorties'
import { deduirePhases, type ParametresPhases, type Phase } from './phases'
import { REGLAGES_PLANS_DEFAUT, type MesureReussite } from './reglagesPlans'

// Plan d'endurance dérivé des séances de cardio déjà planifiées (course et vélo) et des sorties réalisées : aucune table de plus.
// Les semaines vont du lundi de la première séance à la dernière. Les séances facultatives ne comptent ni dans le prévu ni dans
// le taux. Une séance est « échue » quand son jour est passé ou qu'elle est déjà validée : seules les séances échues entrent
// dans la réalisation (la séance du jour pas encore faite n'est pas « manquée »).

export type EtatSeance = 'faite' | 'autrement' | 'manquee' | 'facultative' | 'aVenir'

export interface JalonPlan {
  seanceId: string
  genre: GenreCardio
  nom: string
  date: string
  /** Indice de la semaine du jalon dans le plan. */
  semaine: number
}

export interface SeancePlan {
  id: string
  genre: GenreCardio
  date: string
  titre: string
  prevuMin: number
  optionnelle: boolean
  jalon: string | null
  etat: EtatSeance
  /** Sortie rattachée à la séance, s'il y en a une. */
  sortieId: string | null
  /** Durée réellement faite (minutes) : celle de la sortie rattachée, sinon la durée prévue d'une séance validée sans sortie. */
  realiseMin: number
}

export interface SemainePlan {
  /** Rang à partir de 1. */
  rang: number
  debut: string
  phase: Phase
  prevuMin: number
  realiseMin: number
  /** Séances prévues (hors facultatives) et séances échues parmi elles. */
  prevues: number
  echues: number
  /** Points des séances échues : faite = 1, faite autrement = part réglée, manquée = 0. */
  points: number
  prevuEchuMin: number
  realiseEchuMin: number
  jalon: JalonPlan | null
  seances: SeancePlan[]
}

export interface Plan {
  semaines: SemainePlan[]
  jalons: JalonPlan[]
}

export interface OptionsPlan {
  parametres?: ParametresPhases
  /** Part de la durée prévue (en %) à atteindre pour qu'une séance compte comme faite. */
  dureeMinPct?: number
  /** Part (en %) comptée pour une séance faite autrement. */
  autrementPct?: number
  /** Jour de référence yyyy-MM-dd (aujourd'hui) ; sans lui, aucune séance n'est manquée. */
  aujourdhui?: string
  /** Compte une sortie manuelle du même sport, du même jour (ou à un jour d'écart), pour la séance prévue. Défaut : non. */
  rattachementAuto?: boolean
}

const dureeMin = (s: SeanceCardio) => minutesDeDetail(s.detail) ?? DUREE_DEFAUT_MIN

/** Jours entiers de `a` à `b` (yyyy-MM-dd) ; négatif si `b` précède `a`. */
export const joursEntre = (a: string, b: string) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8))) / 86_400_000)

/** État d'une séance planifiée d'après sa validation, sa sortie rattachée et le jour de référence. */
export function etatSeance(s: SeanceCardio, sortie: Sortie | null, o: OptionsPlan = {}): EtatSeance {
  const dureeMinPct = o.dureeMinPct ?? REGLAGES_PLANS_DEFAUT.dureeMinPct
  if (s.isValidated) {
    const minutes = sortie?.dureeS ? sortie.dureeS / 60 : null
    if (minutes !== null && minutes < (dureeMin(s) * dureeMinPct) / 100) return 'autrement'
    return 'faite'
  }
  if (s.optionnelle) return 'facultative'
  return o.aujourdhui && s.date < o.aujourdhui ? 'manquee' : 'aVenir'
}

/**
 * Rattachements implicites : une sortie saisie à la main, sans séance, compte pour la séance non faite du même sport du même jour
 * (ou la veille ou le lendemain), une sortie par séance. Sans cela, une séance remplacée par une sortie ajoutée à la main resterait
 * « manquée » et fausserait le taux de réalisation. Rien n'est écrit en base : seul le calcul du plan en tient compte.
 */
export function rattachementsImplicites(seances: readonly SeanceCardio[], sorties: readonly Sortie[]): Map<string, Sortie> {
  const candidates = seances.filter((s) => !s.isValidated)
  const prises = new Set<string>()
  const res = new Map<string, Sortie>()
  const libres = sorties.filter((s) => !s.seanceId).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  for (const sortie of libres) {
    const duree = sortie.dureeS ? sortie.dureeS / 60 : null
    const meilleure = candidates
      .filter((c) => c.genre === sortie.sport && !prises.has(c.id) && Math.abs(joursEntre(c.date, sortie.date)) <= 1)
      .map((c) => ({ c, ecartJours: Math.abs(joursEntre(c.date, sortie.date)), ecartDuree: duree === null ? 0 : Math.abs(dureeMin(c) - duree) }))
      .sort((a, b) => a.ecartJours - b.ecartJours || Number(a.c.optionnelle) - Number(b.c.optionnelle) || a.ecartDuree - b.ecartDuree || a.c.id.localeCompare(b.c.id))[0]
    if (meilleure) {
      prises.add(meilleure.c.id)
      res.set(meilleure.c.id, sortie)
    }
  }
  return res
}

/** Construit le plan ; null sans aucune séance. */
export function construirePlan(seances: readonly SeanceCardio[], sorties: readonly Sortie[] = [], o: OptionsPlan = {}): Plan | null {
  if (seances.length === 0) return null
  const autrementPct = o.autrementPct ?? REGLAGES_PLANS_DEFAUT.autrementPct
  const dates = seances.map((s) => s.date).sort()
  const premier = lundiDe(dates[0])
  const dernier = lundiDe(dates[dates.length - 1])
  const nb = joursEntre(premier, dernier) / 7 + 1
  const debuts = Array.from({ length: nb }, (_, i) => ajouterJours(premier, 7 * i))
  const parSeance = new Map<string, Sortie>()
  for (const so of sorties) if (so.seanceId) parSeance.set(so.seanceId, so)
  const implicites = o.rattachementAuto ? rattachementsImplicites(seances, sorties) : new Map<string, Sortie>()

  const vides = (): SeancePlan[][] => Array.from({ length: nb }, () => [])
  const liste = vides()
  const jalons: JalonPlan[] = []
  for (const s of seances) {
    const i = debuts.indexOf(lundiDe(s.date))
    if (i < 0) continue
    const sortie = parSeance.get(s.id) ?? implicites.get(s.id) ?? null
    const etat = etatSeance(implicites.has(s.id) ? { ...s, isValidated: true } : s, sortie, o)
    const prevu = dureeMin(s)
    const faite = etat === 'faite' || etat === 'autrement'
    liste[i].push({
      id: s.id, genre: s.genre, date: s.date, titre: s.titre, prevuMin: prevu, optionnelle: s.optionnelle, jalon: s.jalon, etat,
      sortieId: sortie?.id ?? null, realiseMin: faite ? (sortie?.dureeS ? Math.round(sortie.dureeS / 60) : prevu) : 0,
    })
    if (s.jalon) jalons.push({ seanceId: s.id, genre: s.genre, nom: s.jalon, date: s.date, semaine: i })
  }
  jalons.sort((a, b) => a.date.localeCompare(b.date))

  const comptees = liste.map((l) => l.filter((s) => !s.optionnelle))
  const prevu = comptees.map((l) => l.reduce((t, s) => t + s.prevuMin, 0))
  const phases = deduirePhases(prevu, jalons.map((j) => j.semaine), o.parametres)
  const semaines = debuts.map<SemainePlan>((debut, i) => {
    const echues = comptees[i].filter((s) => s.etat !== 'aVenir')
    return {
      rang: i + 1, debut, phase: phases[i], prevuMin: prevu[i], realiseMin: comptees[i].reduce((t, s) => t + s.realiseMin, 0),
      prevues: comptees[i].length, echues: echues.length,
      points: echues.reduce((t, s) => t + (s.etat === 'faite' ? 1 : s.etat === 'autrement' ? autrementPct / 100 : 0), 0),
      prevuEchuMin: echues.reduce((t, s) => t + s.prevuMin, 0), realiseEchuMin: echues.reduce((t, s) => t + s.realiseMin, 0),
      jalon: jalons.find((j) => j.semaine === i) ?? null,
      seances: [...liste[i]].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    }
  })
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
  /** Taux en % (0 à 100+), null sans séance échue. */
  tauxPct: number | null
  /** Points gagnés (une séance faite = 1) et séances échues. */
  faites: number
  prevues: number
  prevuMin: number
  realiseMin: number
}

function taux(r: { points: number; echues: number; prevuEchuMin: number; realiseEchuMin: number }, mesure: MesureReussite): number | null {
  const parSeances = r.echues > 0 ? (r.points / r.echues) * 100 : null
  const parDuree = r.prevuEchuMin > 0 ? (r.realiseEchuMin / r.prevuEchuMin) * 100 : null
  const t = mesure === 'seances' ? parSeances : mesure === 'duree' ? parDuree : parSeances !== null && parDuree !== null ? (parSeances + parDuree) / 2 : null
  return t === null ? null : Math.round(t)
}

/** Réalisation sur les semaines d'indices [de, a] (bornées au plan), selon la mesure choisie. */
export function realisationEntre(plan: Plan, de: number, a: number, mesure: MesureReussite): Realisation {
  const r = { points: 0, echues: 0, prevuEchuMin: 0, realiseEchuMin: 0 }
  for (const w of plan.semaines.slice(Math.max(0, de), Math.min(a, plan.semaines.length - 1) + 1)) {
    r.points += w.points
    r.echues += w.echues
    r.prevuEchuMin += w.prevuEchuMin
    r.realiseEchuMin += w.realiseEchuMin
  }
  return { tauxPct: taux(r, mesure), faites: r.points, prevues: r.echues, prevuMin: r.prevuEchuMin, realiseMin: r.realiseEchuMin }
}

/** Réalisation cumulée depuis le début jusqu'à la semaine courante comprise. */
export const realisationJusquA = (plan: Plan, indiceCourant: number, mesure: MesureReussite): Realisation => realisationEntre(plan, 0, indiceCourant, mesure)

/** Taux de chaque semaine jusqu'à `jusqua` sur une fenêtre glissante de `fenetre` semaines (la semaine et les précédentes). */
export function tauxGlissant(plan: Plan, jusqua: number, mesure: MesureReussite, fenetre = 4): { rang: number; tauxPct: number | null }[] {
  const fin = Math.min(jusqua, plan.semaines.length - 1)
  return Array.from({ length: Math.max(0, fin + 1) }, (_, i) => ({ rang: i + 1, tauxPct: realisationEntre(plan, i - fenetre + 1, i, mesure).tauxPct }))
}

/** Nombre de semaines de suite, jusqu'à `jusqua` compris, dont le taux (sur la semaine seule) est sous `seuilPct`. Ignore les semaines sans séance échue. */
export function semainesSousSeuil(plan: Plan, jusqua: number, mesure: MesureReussite, seuilPct: number): number {
  let n = 0
  for (let i = Math.min(jusqua, plan.semaines.length - 1); i >= 0; i--) {
    const t = realisationEntre(plan, i, i, mesure).tauxPct
    if (t === null) continue
    if (t >= seuilPct) break
    n++
  }
  return n
}

export interface Proposition {
  sortie: Sortie
  seance: SeancePlan
}

/**
 * Propositions de rattachement : une sortie sans séance est proposée pour une séance non faite du même sport, du même jour
 * (sinon de la même semaine) ; une seule séance par sortie, une seule sortie par séance. Jamais appliquées sans confirmation.
 */
export function proposerRattachements(semaine: SemainePlan, sorties: readonly Sortie[]): Proposition[] {
  const debut = semaine.debut
  const fin = ajouterJours(debut, 6)
  const libres = sorties.filter((s) => !s.seanceId && s.date >= debut && s.date <= fin)
  const candidates = semaine.seances.filter((s) => s.sortieId === null && (s.etat === 'manquee' || s.etat === 'aVenir' || s.etat === 'facultative'))
  const prises = new Set<string>()
  const res: Proposition[] = []
  for (const sortie of [...libres].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
    const duree = sortie.dureeS ? sortie.dureeS / 60 : null
    const possibles = candidates
      .filter((c) => c.genre === sortie.sport && !prises.has(c.id))
      .map((c) => ({ c, ecartJours: Math.abs(joursEntre(c.date, sortie.date)), ecartDuree: duree === null ? 0 : Math.abs(c.prevuMin - duree) }))
      .filter((x) => x.ecartJours <= 1)
      .sort((a, b) => a.ecartJours - b.ecartJours || a.ecartDuree - b.ecartDuree || a.c.id.localeCompare(b.c.id))
    const meilleure = possibles[0]
    if (meilleure) {
      prises.add(meilleure.c.id)
      res.push({ sortie, seance: meilleure.c })
    }
  }
  return res
}
