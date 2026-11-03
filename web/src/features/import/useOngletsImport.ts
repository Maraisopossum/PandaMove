import { useCallback, useState, type KeyboardEvent } from 'react'

export type OngletImport = 'android' | 'ia' | 'programme'
const ORDRE: OngletImport[] = ['android', 'ia', 'programme']

export const idOnglet = (o: OngletImport) => `import-onglet-${o}`
export const idPanneau = (o: OngletImport) => `import-panneau-${o}`

// Onglets de l'écran d'import (motif WAI-ARIA « tabs ») : flèches gauche / droite, Début et Fin déplacent aussi le focus.
export function useOngletsImport() {
  const [onglet, setOnglet] = useState<OngletImport>('android')

  const surTouche = useCallback(
    (e: KeyboardEvent) => {
      const i = ORDRE.indexOf(onglet)
      const cible =
        e.key === 'ArrowRight' ? ORDRE[(i + 1) % ORDRE.length]
        : e.key === 'ArrowLeft' ? ORDRE[(i + ORDRE.length - 1) % ORDRE.length]
        : e.key === 'Home' ? ORDRE[0]
        : e.key === 'End' ? ORDRE[ORDRE.length - 1]
        : null
      if (!cible) return
      e.preventDefault()
      setOnglet(cible)
      document.getElementById(idOnglet(cible))?.focus()
    },
    [onglet],
  )

  return { onglet, setOnglet, surTouche }
}
