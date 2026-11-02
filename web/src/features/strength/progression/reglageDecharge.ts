import { useCallback, useSyncExternalStore } from 'react'

// Réglage « décharge planifiée » : nombre de semaines entre deux décharges proposées, propre à l'appareil.
// 0 (défaut) = désactivée. Même principe que le réglage RPE (localStorage, évènement maison + « storage »).
const CLE = 'pandamove.decharge.semaines'
const EVENEMENT = 'pandamove:decharge'
export const SEMAINES_DECHARGE_MAX = 26

function borner(valeur: number): number {
  return Number.isFinite(valeur) ? Math.min(SEMAINES_DECHARGE_MAX, Math.max(0, Math.round(valeur))) : 0
}

export function lireIntervalleDecharge(): number {
  try {
    return borner(Number(localStorage.getItem(CLE) ?? 0))
  } catch {
    return 0
  }
}

export function ecrireIntervalleDecharge(semaines: number): void {
  try {
    localStorage.setItem(CLE, String(borner(semaines)))
  } catch {
    // stockage indisponible : le réglage n'est pas mémorisé
  }
  window.dispatchEvent(new Event(EVENEMENT))
}

function abonner(rappel: () => void): () => void {
  window.addEventListener(EVENEMENT, rappel)
  window.addEventListener('storage', rappel)
  return () => {
    window.removeEventListener(EVENEMENT, rappel)
    window.removeEventListener('storage', rappel)
  }
}

export function useReglageDecharge(): { semaines: number; changerSemaines: (semaines: number) => void } {
  const semaines = useSyncExternalStore(abonner, lireIntervalleDecharge, () => 0)
  const changerSemaines = useCallback((s: number) => ecrireIntervalleDecharge(s), [])
  return { semaines, changerSemaines }
}
