import { useCallback, useEffect, useState } from 'react'

// État du drawer en dessous de 1024 px (au-dessus il est permanent, géré en CSS). Échap le referme.
export function useDrawer() {
  const [ouvert, setOuvert] = useState(false)
  const basculer = useCallback(() => setOuvert((o) => !o), [])
  const fermer = useCallback(() => setOuvert(false), [])

  useEffect(() => {
    if (!ouvert) return
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false)
    }
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [ouvert])

  return { ouvert, basculer, fermer }
}
