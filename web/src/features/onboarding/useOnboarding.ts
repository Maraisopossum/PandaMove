import { useCallback, useState } from 'react'
import { ETAPES_ONBOARDING, lireVu, marquerVu, type AccesStockage } from './onboarding'

export interface DepsOnboarding {
  /** Stockage injectable (défaut : localStorage du navigateur). */
  stockage?: AccesStockage
}

const DERNIERE = ETAPES_ONBOARDING.length - 1

// État de l'onboarding : affiché au premier lancement, étape courante, navigation, « Passer » / « Commencer »
// qui le marquent vu. Le composant n'a qu'à afficher l'étape et relier les boutons.
export function useOnboarding({ stockage }: DepsOnboarding = {}) {
  const [afficher, setAfficher] = useState(() => !lireVu(stockage))
  const [index, setIndex] = useState(0)

  const suivant = useCallback(() => setIndex((i) => Math.min(i + 1, DERNIERE)), [])
  const precedent = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])
  const passer = useCallback(() => {
    marquerVu(stockage)
    setAfficher(false)
  }, [stockage])

  // Flèches gauche / droite : étape précédente / suivante. Renvoie true si la touche est traitée.
  const surTouche = useCallback(
    (touche: string) => {
      if (touche === 'ArrowRight') suivant()
      else if (touche === 'ArrowLeft') precedent()
      else return false
      return true
    },
    [suivant, precedent],
  )

  return {
    afficher,
    index,
    total: ETAPES_ONBOARDING.length,
    etape: ETAPES_ONBOARDING[index],
    estPremiere: index === 0,
    estDerniere: index === DERNIERE,
    libelleProgression: `Étape ${index + 1} sur ${ETAPES_ONBOARDING.length}`,
    suivant,
    precedent,
    passer,
    terminer: passer,
    surTouche,
  }
}
