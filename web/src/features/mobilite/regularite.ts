import { ajouterJours } from '../endurance/calculCharge'
import { lundiDe } from '../home/semaine'
import type { SeanceFaite } from './stockage'

// Régularité de la mobilité : jours de suite, grille des quatre dernières semaines et totaux. Fonctions pures sur l'historique
// (jours locaux yyyy-MM-dd), indépendantes de l'heure et du fuseau.

export interface JourGrille {
  dateIso: string
  fait: boolean
  /** Jour à venir de la semaine en cours : ni fait ni manqué. */
  avenir: boolean
  /** Séances ce jour-là. */
  nombre: number
}

/** Nombre de jours consécutifs avec au moins une séance, en comptant jusqu'à aujourd'hui, ou jusqu'à hier si aujourd'hui n'est pas encore fait. */
export function serieJours(historique: readonly SeanceFaite[], aujourdhuiIso: string): number {
  const jours = new Set(historique.map((s) => s.date))
  let courant = jours.has(aujourdhuiIso) ? aujourdhuiIso : ajouterJours(aujourdhuiIso, -1)
  let n = 0
  while (jours.has(courant)) {
    n++
    courant = ajouterJours(courant, -1)
  }
  return n
}

/** 28 jours, du lundi d'il y a trois semaines au dimanche de la semaine en cours. */
export function grilleQuatreSemaines(historique: readonly SeanceFaite[], aujourdhuiIso: string): JourGrille[] {
  const debut = ajouterJours(lundiDe(aujourdhuiIso), -21)
  const parJour = new Map<string, number>()
  for (const s of historique) parJour.set(s.date, (parJour.get(s.date) ?? 0) + 1)
  return Array.from({ length: 28 }, (_, i) => {
    const dateIso = ajouterJours(debut, i)
    const nombre = parJour.get(dateIso) ?? 0
    return { dateIso, fait: nombre > 0, avenir: dateIso > aujourdhuiIso, nombre }
  })
}

/** Séances et minutes de la fenêtre de la grille (jusqu'à aujourd'hui). */
export function totauxQuatreSemaines(historique: readonly SeanceFaite[], aujourdhuiIso: string): { seances: number; minutes: number } {
  const debut = ajouterJours(lundiDe(aujourdhuiIso), -21)
  const dedans = historique.filter((s) => s.date >= debut && s.date <= aujourdhuiIso)
  return { seances: dedans.length, minutes: Math.round(dedans.reduce((t, s) => t + s.dureeS, 0) / 60) }
}
