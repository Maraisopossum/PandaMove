// Petit stockage local du navigateur (localStorage), tolérant : indisponible, plein ou refusé => on continue sans.
// Sert aux réglages d'exécution qui n'ont pas de colonne en base (minuteur de repos, notes d'exercice).
export function lireStockage(cle: string): string | null {
  try {
    return window.localStorage.getItem(cle)
  } catch {
    return null
  }
}

export function ecrireStockage(cle: string, valeur: string | null): void {
  try {
    if (valeur === null) window.localStorage.removeItem(cle)
    else window.localStorage.setItem(cle, valeur)
  } catch {
    // stockage indisponible : l'état reste en mémoire pour la session
  }
}
