import { useCallback, useLayoutEffect, useRef } from 'react'

// Garde de sortie de l'écran d'exécution : `bloquerRef` dit si une navigation doit être interceptée (lu par useBlocker).
// `contourner` désarme la garde juste avant une navigation voulue par l'écran lui-même (bilan, suppression, édition
// des exercices) : elle ne doit pas rouvrir le dialogue de sortie.
export function useGardeSortie(active: boolean) {
  const bloquerRef = useRef(active)
  const contourne = useRef(false)
  // Effet de mise en page : la garde est armée dès que l'écran apparaît, sans attendre le rendu différé des effets passifs
  useLayoutEffect(() => {
    bloquerRef.current = active && !contourne.current
  }, [active])
  const contourner = useCallback(() => {
    contourne.current = true
    bloquerRef.current = false
  }, [])
  return { bloquerRef, contourner }
}
