import { useEffect, useRef } from 'react'

// Place le focus sur l'élément (titre de l'étape) au montage et à chaque changement d'étape :
// le lecteur d'écran annonce le nouveau contenu et la navigation au clavier repart de là.
export function useFocusEtape<T extends HTMLElement>(etape: number) {
  const ref = useRef<T>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [etape])
  return ref
}
