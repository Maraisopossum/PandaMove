import type { MethodePerso } from '../../core/db/repos/respiration'
import { LIMITES_RESPIRATION } from '../../core/db/repos/respiration'
import { dureeCycleMs, type ConfigSession } from './moteur'

// Une méthode, intégrée (dans le code, non modifiable) ou personnalisée (en base). Durées en secondes, comme en base ;
// les durées des méthodes intégrées peuvent être décimales (Wim Hof : 1,5 s), celles des méthodes personnalisées sont entières.
export interface Methode {
  /** Intégrée : « 4_7_8 »... ; personnalisée : l'uuid de la ligne. */
  id: string
  nom: string
  description: string
  emoji: string
  inspireSec: number
  retentionPleineSec: number
  expireSec: number
  retentionVideSec: number
  cyclesDefaut: number
  personnalisee: boolean
}

export const METHODES_INTEGREES: readonly Methode[] = [
  {
    id: 'coherence_cardiaque', nom: 'Cohérence cardiaque', emoji: '💚',
    description: "5 secondes d'inspiration, 5 secondes d'expiration. 6 cycles/min pendant 5 minutes.",
    inspireSec: 5, retentionPleineSec: 0, expireSec: 5, retentionVideSec: 0, cyclesDefaut: 30, personnalisee: false,
  },
  {
    id: '4_7_8', nom: '4-7-8', emoji: '🌙',
    description: 'Inspire 4s, retiens 7s, expire 8s. Favorise la relaxation profonde.',
    inspireSec: 4, retentionPleineSec: 7, expireSec: 8, retentionVideSec: 0, cyclesDefaut: 4, personnalisee: false,
  },
  {
    id: 'box_breathing', nom: 'Respiration en boîte', emoji: '⬛',
    description: '4 phases égales de 4 secondes. Utilisée par les Navy SEALs pour garder le calme.',
    inspireSec: 4, retentionPleineSec: 4, expireSec: 4, retentionVideSec: 4, cyclesDefaut: 6, personnalisee: false,
  },
  {
    id: 'wim_hof', nom: 'Wim Hof', emoji: '❄️',
    description: '30 inspirations rapides puis rétention poumons vides. Énergie et concentration.',
    inspireSec: 1.5, retentionPleineSec: 0, expireSec: 1.5, retentionVideSec: 15, cyclesDefaut: 30, personnalisee: false,
  },
]

export function depuisMethodePerso(m: MethodePerso): Methode {
  const base = { ...m, description: '', personnalisee: true }
  return { ...base, description: descriptionAuto(base) }
}

type Durees = Pick<Methode, 'inspireSec' | 'retentionPleineSec' | 'expireSec' | 'retentionVideSec' | 'cyclesDefaut'>

// « 4s · 7s · 8s — 4 cycles » : seules les phases actives sont listées.
export function descriptionAuto(d: Durees): string {
  const phases = [`${d.inspireSec}s`]
  if (d.retentionPleineSec > 0) phases.push(`${d.retentionPleineSec}s`)
  phases.push(`${d.expireSec}s`)
  if (d.retentionVideSec > 0) phases.push(`${d.retentionVideSec}s`)
  return `${phases.join(' · ')} — ${d.cyclesDefaut} cycles`
}

export function configDe(m: Methode, cycles: number = m.cyclesDefaut): ConfigSession {
  return {
    inspireMs: Math.round(m.inspireSec * 1000),
    retentionPleineMs: Math.round(m.retentionPleineSec * 1000),
    expireMs: Math.round(m.expireSec * 1000),
    retentionVideMs: Math.round(m.retentionVideSec * 1000),
    cycles,
  }
}

export const trouverIntegree = (id: string): Methode | undefined => METHODES_INTEGREES.find((m) => m.id === id)

export type ModeDuree = 'cycles' | 'minutes'

export const BORNES_DUREE = { cycles: { min: 1, max: LIMITES_RESPIRATION.cyclesSeance }, minutes: { min: 1, max: 90 } } as const

/** Durée par défaut en minutes (arrondie vers le bas, au moins 1). */
export function minutesParDefaut(m: Methode): number {
  const ms = dureeCycleMs(configDe(m)) * m.cyclesDefaut
  return Math.max(1, Math.floor(ms / 60_000))
}

/** Nombre de cycles à jouer pour la valeur choisie, selon le mode (au moins 1, au plus la borne). */
export function cyclesEffectifs(m: Methode, mode: ModeDuree, valeur: number): number {
  if (mode === 'cycles') return Math.min(BORNES_DUREE.cycles.max, Math.max(1, Math.trunc(valeur)))
  const cycleMs = Math.max(1, dureeCycleMs(configDe(m)))
  return Math.min(BORNES_DUREE.cycles.max, Math.max(1, Math.floor((valeur * 60_000) / cycleMs)))
}
