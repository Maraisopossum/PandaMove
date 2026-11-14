// Réglages d'appareil de la respiration (localStorage, clés `pandamove.respiration.*`), jamais synchronisés : objectif quotidien
// en minutes et méthode favorite (affichée en premier). Toute lecture tolère un stockage absent ou corrompu.

export const CLE_OBJECTIF_QUOTIDIEN = 'pandamove.respiration.objectif'
export const CLE_FAVORITE = 'pandamove.respiration.favorite'

export const OBJECTIF_QUOTIDIEN_DEFAUT_MIN = 5
export const OBJECTIF_QUOTIDIEN_MIN = 1
export const OBJECTIF_QUOTIDIEN_MAX = 60

export function lireObjectifQuotidien(): number {
  try {
    const v = Number(localStorage.getItem(CLE_OBJECTIF_QUOTIDIEN))
    return Number.isInteger(v) && v >= OBJECTIF_QUOTIDIEN_MIN && v <= OBJECTIF_QUOTIDIEN_MAX ? v : OBJECTIF_QUOTIDIEN_DEFAUT_MIN
  } catch {
    return OBJECTIF_QUOTIDIEN_DEFAUT_MIN
  }
}

/** Retient l'objectif (entier de 1 à 60 minutes) ; renvoie false et ne change rien sinon. */
export function ecrireObjectifQuotidien(minutes: number): boolean {
  if (!Number.isInteger(minutes) || minutes < OBJECTIF_QUOTIDIEN_MIN || minutes > OBJECTIF_QUOTIDIEN_MAX) return false
  try {
    localStorage.setItem(CLE_OBJECTIF_QUOTIDIEN, String(minutes))
  } catch {
    // Stockage indisponible : l'objectif vaut pour la session seulement
  }
  return true
}

export function lireFavorite(): string | null {
  try {
    const v = localStorage.getItem(CLE_FAVORITE)
    return v && v.length > 0 ? v : null
  } catch {
    return null
  }
}

/** `null` retire la méthode favorite. */
export function ecrireFavorite(id: string | null): void {
  try {
    if (id === null) localStorage.removeItem(CLE_FAVORITE)
    else localStorage.setItem(CLE_FAVORITE, id)
  } catch {
    // Stockage indisponible : le choix vaut pour la session seulement
  }
}
