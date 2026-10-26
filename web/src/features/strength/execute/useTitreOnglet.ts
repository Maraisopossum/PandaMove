import { useEffect } from 'react'

// Titre de l'onglet pendant l'écran (chrono et repos visibles en arrière-plan) ; l'ancien titre est rétabli à la sortie.
export function useTitreOnglet(titre: string): void {
  // Déclaré AVANT l'effet qui pose le titre : il mémorise le titre d'origine avant qu'on le remplace
  useEffect(() => {
    const avant = document.title
    return () => {
      document.title = avant
    }
  }, [])
  useEffect(() => {
    document.title = titre
  }, [titre])
}
