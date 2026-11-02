import { useCallback, useSyncExternalStore } from 'react'

// Réglage « RPE dans les séances » : propre à l'appareil, activé par défaut. Lu par le tableau de séries,
// modifié depuis le profil et le menu de la séance (même onglet : évènement maison ; autre onglet : « storage »).
const CLE = 'pandamove.rpe'
const EVENEMENT = 'pandamove:rpe'

export function lireReglageRpe(): boolean {
  try {
    return localStorage.getItem(CLE) !== '0'
  } catch {
    return true
  }
}

export function ecrireReglageRpe(actif: boolean): void {
  try {
    localStorage.setItem(CLE, actif ? '1' : '0')
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

export function useReglageRpe(): { rpeActif: boolean; changerRpe: (actif: boolean) => void } {
  const rpeActif = useSyncExternalStore(abonner, lireReglageRpe, () => true)
  const changerRpe = useCallback((actif: boolean) => ecrireReglageRpe(actif), [])
  return { rpeActif, changerRpe }
}
