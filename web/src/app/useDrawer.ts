import { useCallback, useEffect, useRef, useState } from 'react'

// Au-dessus de 1024 px le drawer est permanent : aucune gestion de focus.
function estLarge(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1025px)').matches
}

// État du drawer en dessous de 1024 px (au-dessus il est permanent, géré en CSS). Échap le referme.
// Mode étroit (modal) : à l'ouverture le focus va au premier lien, à la fermeture il revient au bouton.
export function useDrawer() {
  const [ouvert, setOuvert] = useState(false)
  const refBascule = useRef<HTMLButtonElement>(null)
  const refDrawer = useRef<HTMLElement>(null)
  const dejaOuvert = useRef(false)
  const basculer = useCallback(() => setOuvert((o) => !o), [])
  const fermer = useCallback(() => setOuvert(false), [])

  useEffect(() => {
    if (ouvert) {
      dejaOuvert.current = true
      if (!estLarge()) refDrawer.current?.querySelector<HTMLElement>('a')?.focus()
    } else if (dejaOuvert.current) {
      dejaOuvert.current = false
      if (!estLarge()) refBascule.current?.focus()
    }
  }, [ouvert])

  useEffect(() => {
    if (!ouvert) return
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false)
    }
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [ouvert])

  return { ouvert, basculer, fermer, refBascule, refDrawer }
}
