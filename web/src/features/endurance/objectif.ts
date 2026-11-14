import type { Sport } from '../../core/db/repos/sorties'

// Objectif de distance de la semaine, par sport : réglage d'appareil (comme la FTP ou la FC max), jamais synchronisé.
// Absent : pas d'objectif, la carte « Cette semaine » ne montre alors que le bilan.

export const CLE_OBJECTIF = 'pandamove.sorties.objectif'
export const OBJECTIF_MIN_KM = 1
export const OBJECTIF_MAX_KM = 2000

type Objectifs = Partial<Record<Sport, number>>

function lire(): Objectifs {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CLE_OBJECTIF) ?? 'null')
    if (!v || typeof v !== 'object') return {}
    const o = v as Record<string, unknown>
    const valide = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= OBJECTIF_MIN_KM && x <= OBJECTIF_MAX_KM ? x : undefined)
    return { course: valide(o.course), velo: valide(o.velo) }
  } catch {
    return {}
  }
}

/** Objectif en kilomètres, ou null. */
export const lireObjectif = (sport: Sport): number | null => lire()[sport] ?? null

/** Retient l'objectif d'un sport ; `null` le retire. Une valeur hors de 1 à 2 000 km est refusée (renvoie false). */
export function ecrireObjectif(sport: Sport, km: number | null): boolean {
  if (km !== null && !(Number.isFinite(km) && km >= OBJECTIF_MIN_KM && km <= OBJECTIF_MAX_KM)) return false
  try {
    const suite = { ...lire(), [sport]: km === null ? undefined : Math.round(km * 10) / 10 }
    localStorage.setItem(CLE_OBJECTIF, JSON.stringify(suite))
  } catch {
    // Stockage indisponible (navigation privée, quota) : l'objectif vaut pour la session seulement
  }
  return true
}
