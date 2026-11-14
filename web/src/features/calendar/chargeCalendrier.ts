import type { EvenementAgenda } from './types'
import { ajouterJours } from './grille'

// Charge estimée de l'agenda : durée prévue de chaque séance, totaux par jour et par semaine, niveau de la semaine par rapport à la
// moyenne des quatre semaines précédentes, jours d'affilée et jour libre conseillé. Fonctions pures, indicatives : la durée d'une
// séance de renforcement est celle estimée à la création de la séance (ou réelle une fois terminée), celle d'une séance de cardio
// est lue dans son détail (« 45 min · zone 2 », « 1 h 30 »). Aucune conclusion de santé.

/** Durée par défaut d'une séance dont la durée n'est ni connue ni lisible (cardio sans détail, modèle supprimé). */
export const DUREE_DEFAUT_MIN = 45

/** Minutes lues dans un texte libre : « 45 min », « 1 h 30 », « 2 h », « 1h15 ». null sans durée lisible. */
export function minutesDeDetail(detail: string | null): number | null {
  if (!detail) return null
  const heures = /(\d+)\s*h(?:\s*(\d{1,2}))?/i.exec(detail)
  if (heures) return Number(heures[1]) * 60 + Number(heures[2] ?? 0)
  const minutes = /(\d+)\s*min/i.exec(detail)
  return minutes ? Number(minutes[1]) : null
}

/** Durée d'un événement en minutes : réelle si terminée, sinon estimée (`dureesSeances` : durée estimée des modèles de renforcement). */
export function dureeEvenementMin(e: EvenementAgenda, dureesSeances: ReadonlyMap<string, number>): number {
  if (e.genre === 'renfo') {
    if (e.etat === 'terminee' && e.instance.dureeSec && e.instance.dureeSec > 0) return Math.round(e.instance.dureeSec / 60)
    const estimee = dureesSeances.get(e.instance.seanceId)
    return estimee && estimee > 0 ? estimee : DUREE_DEFAUT_MIN
  }
  return minutesDeDetail(e.detail) ?? DUREE_DEFAUT_MIN
}

/** Lundi de la semaine d'un jour (yyyy-MM-dd). */
export function lundiDe(dateIso: string): string {
  const [a, m, j] = dateIso.split('-').map(Number)
  const decalage = (new Date(a, m - 1, j, 12).getDay() + 6) % 7
  return ajouterJours(dateIso, -decalage)
}

export type NiveauCharge = 'bas' | 'moyen' | 'haut'

export interface JourCharge {
  dateIso: string
  minutes: number
  seances: number
}

export interface ChargeSemaine {
  /** Lundi de la semaine. */
  debut: string
  jours: JourCharge[]
  minutes: number
  seances: number
  /** Moyenne (minutes) des quatre semaines précédentes avec au moins une séance ; null sans historique. */
  moyenneMin: number | null
  niveau: NiveauCharge
  /** Écart avec la moyenne, en pourcents (positif = au-dessus) ; null sans moyenne. */
  ecartPct: number | null
  /** Plus longue suite de jours avec séance, et ses bornes. */
  suite: { longueur: number; debut: string | null; fin: string | null }
  /** Jour sans séance conseillé pour déplacer une séance : le premier jour libre qui suit la plus longue suite, sinon le premier jour libre. */
  jourLibre: string | null
}

// Sans historique, des repères absolus : plus de 8 h dans la semaine est « haut », plus de 4 h « moyen ».
const SEUIL_HAUT_ABSOLU = 8 * 60
const SEUIL_MOYEN_ABSOLU = 4 * 60
const RATIO_HAUT = 1.3
const RATIO_MOYEN = 0.9

function niveauDe(minutes: number, moyenne: number | null): NiveauCharge {
  if (moyenne !== null && moyenne > 0) return minutes >= RATIO_HAUT * moyenne ? 'haut' : minutes >= RATIO_MOYEN * moyenne ? 'moyen' : 'bas'
  return minutes > SEUIL_HAUT_ABSOLU ? 'haut' : minutes > SEUIL_MOYEN_ABSOLU ? 'moyen' : 'bas'
}

function totauxParSemaine(evenements: readonly EvenementAgenda[], dureesSeances: ReadonlyMap<string, number>): Map<string, number> {
  const m = new Map<string, number>()
  for (const e of evenements) m.set(lundiDe(e.dateIso), (m.get(lundiDe(e.dateIso)) ?? 0) + dureeEvenementMin(e, dureesSeances))
  return m
}

/**
 * Charge de la semaine qui commence le lundi `debut`. `evenements` doit contenir la semaine et, pour la moyenne, les quatre
 * semaines qui la précèdent (les événements en trop sont ignorés).
 */
export function chargeSemaine(debut: string, evenements: readonly EvenementAgenda[], dureesSeances: ReadonlyMap<string, number>): ChargeSemaine {
  const jours: JourCharge[] = Array.from({ length: 7 }, (_, i) => {
    const dateIso = ajouterJours(debut, i)
    const duJour = evenements.filter((e) => e.dateIso === dateIso)
    return { dateIso, minutes: duJour.reduce((t, e) => t + dureeEvenementMin(e, dureesSeances), 0), seances: duJour.length }
  })
  const minutes = jours.reduce((t, j) => t + j.minutes, 0)
  const parSemaine = totauxParSemaine(evenements, dureesSeances)
  const precedentes = [1, 2, 3, 4].map((n) => parSemaine.get(ajouterJours(debut, -7 * n)) ?? 0).filter((m) => m > 0)
  const moyenneMin = precedentes.length > 0 ? precedentes.reduce((t, m) => t + m, 0) / precedentes.length : null

  let suite = { longueur: 0, debut: null as string | null, fin: null as string | null }
  let courante = { longueur: 0, debut: null as string | null }
  for (const j of jours) {
    if (j.seances > 0) {
      courante = { longueur: courante.longueur + 1, debut: courante.debut ?? j.dateIso }
      if (courante.longueur > suite.longueur) suite = { longueur: courante.longueur, debut: courante.debut, fin: j.dateIso }
    } else courante = { longueur: 0, debut: null }
  }
  const libres = jours.filter((j) => j.seances === 0)
  const apresSuite = suite.fin ? libres.find((j) => j.dateIso > (suite.fin as string)) : undefined
  return {
    debut, jours, minutes, seances: jours.reduce((t, j) => t + j.seances, 0), moyenneMin,
    niveau: niveauDe(minutes, moyenneMin),
    ecartPct: moyenneMin !== null && moyenneMin > 0 ? Math.round((minutes / moyenneMin - 1) * 100) : null,
    suite, jourLibre: (apresSuite ?? libres[0])?.dateIso ?? null,
  }
}

/** « 16 au 22 novembre » ; sur deux mois « 26 octobre au 1 novembre ». */
export function libelleSemaine(debut: string): string {
  const fin = ajouterJours(debut, 6)
  const mois = (iso: string) => new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), 12))
  const j = (iso: string) => Number(iso.slice(8))
  return debut.slice(5, 7) === fin.slice(5, 7) ? `${j(debut)} au ${j(fin)} ${mois(fin)}` : `${j(debut)} ${mois(debut)} au ${j(fin)} ${mois(fin)}`
}

/** Durée lisible : 100 -> « 1 h 40 », 55 -> « 55 min », 0 -> « — ». */
export function formaterMinutes(minutes: number): string {
  if (minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}
