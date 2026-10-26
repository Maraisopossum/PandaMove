// Montée en charge (WarmupSets Android, WarmupEngine.kt) : séries d'échauffement calculées en pourcentage de la charge
// cible, arrondies sur le matériel déclaré. Comme sur Android, ce sont des paliers à cocher dans l'ordre (éphémères) :
// ils ne créent PAS de séries réalisées. Fonctions pures ; Float 32 bits comme le Kotlin.
import type { TypeExercice } from '../../../core/db/types'
import { f32 } from '../../../core/progression/inventory'
import { parseChargeKg } from '../progression/cible'

export type Protocole = 'DEBUTANT' | 'STANDARD' | 'LOURD'

interface ModelePalier {
  pct: number
  reps: number
  reposSec: number
}

export const PROTOCOLES: Record<Protocole, ModelePalier[]> = {
  DEBUTANT: [
    { pct: 0.5, reps: 8, reposSec: 60 },
    { pct: 0.7, reps: 5, reposSec: 60 },
  ],
  STANDARD: [
    { pct: 0.4, reps: 10, reposSec: 60 },
    { pct: 0.6, reps: 5, reposSec: 75 },
    { pct: 0.8, reps: 3, reposSec: 90 },
  ],
  LOURD: [
    { pct: 0.4, reps: 5, reposSec: 60 },
    { pct: 0.55, reps: 4, reposSec: 75 },
    { pct: 0.7, reps: 3, reposSec: 90 },
    { pct: 0.83, reps: 2, reposSec: 90 },
    { pct: 0.92, reps: 1, reposSec: 120 },
  ],
}

export const LIBELLES_PROTOCOLE: Record<Protocole, string> = { DEBUTANT: 'Débutant', STANDARD: 'Standard', LOURD: 'Lourd' }

/** Composé bas : lourd ; composé haut : standard ; autres : débutant ; type inconnu : pas de suggestion. */
export function protocoleDefaut(type: TypeExercice | null): Protocole | null {
  switch (type) {
    case 'COMPOSE_BAS':
      return 'LOURD'
    case 'COMPOSE_HAUT':
      return 'STANDARD'
    case 'ISOLATION':
    case 'MACHINE':
    case 'PDC':
      return 'DEBUTANT'
    default:
      return null
  }
}

export interface Palier {
  chargeKg: number
  reps: number
  reposSec: number
  fait: boolean
}

// kotlin.math.round : arrondi à l'entier le plus proche, MOITIÉ VERS LE PAIR (Math.round JS arrondit la moitié vers le haut).
function arrondiPair(x: number): number {
  const r = Math.round(x)
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r
}

/** Paliers du protocole pour une charge cible : charge composable la plus proche, sinon arrondi au demi-kilo. */
export function calculerPaliers(chargeObjectifKg: number, protocole: Protocole, chargesAtteignables: number[]): Palier[] {
  return PROTOCOLES[protocole].map((m) => {
    const cible = f32(f32(chargeObjectifKg) * f32(m.pct))
    let charge: number
    if (chargesAtteignables.length > 0) {
      charge = chargesAtteignables[0]
      for (const c of chargesAtteignables) if (Math.abs(f32(c - cible)) < Math.abs(f32(charge - cible))) charge = c
    } else {
      charge = arrondiPair(f32(cible * 2)) / 2
    }
    return { chargeKg: charge, reps: m.reps, reposSec: m.reposSec, fait: false }
  })
}

/** « 40 kg », « 17,5 kg » ; « PDC » pour une charge nulle. */
export function texteCharge(kg: number): string {
  return kg <= 0 ? 'PDC' : `${String(kg).replace('.', ',')} kg`
}

/** Paliers avec leur état d'activité : seul le premier palier non fait peut être coché (ordre imposé). */
export function paliersActifs(paliers: Palier[]): (Palier & { actif: boolean })[] {
  return paliers.map((p, i) => ({ ...p, actif: !p.fait && paliers.slice(0, i).every((x) => x.fait) }))
}

/** Coche le palier `index` s'il est le palier actif ; sinon renvoie la liste inchangée (même référence). */
export function marquerFait(paliers: Palier[], index: number): Palier[] {
  if (!paliersActifs(paliers)[index]?.actif) return paliers
  return paliers.map((p, i) => (i === index ? { ...p, fait: true } : p))
}

/** Repos (s) qui suit le palier `index` (chrono inter-paliers) ; 0 si le palier n'existe pas. */
export const tempsRepos = (paliers: Palier[], index: number): number => paliers[index]?.reposSec ?? 0

/** La montée en charge s'offre hors échauffement / activation / récupération, avec une charge cible > 0. */
export function monteeDisponible(blocType: string | null, chargeCible: string): boolean {
  if (blocType === 'ECHAUFFEMENT' || blocType === 'ACTIVATION' || blocType === 'RECUPERATION') return false
  const kg = parseChargeKg(chargeCible)
  return kg !== null && kg > 0
}
