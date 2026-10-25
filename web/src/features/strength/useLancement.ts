import { useCallback, useRef, useState } from 'react'
import type { Seance } from '../../core/db/types'
import { ErreurSeance } from './affectation'

/** Ce dont le lancement a besoin : l'id de la séance type à lancer. */
export type CibleLancement = Pick<Seance, 'id' | 'nom'>

// « Lancer » une séance type : démarre tout de suite, sans confirmation (comme Android). `lancer` crée (ou reprend)
// puis démarre l'instance du jour et renvoie son id ; `ouvrirInstance` navigue vers l'exécution. En cas d'échec
// le message français reste affiché (jamais d'échec silencieux) jusqu'au prochain essai.
export function useLancement(lancer: (seanceId: string) => Promise<string>, ouvrirInstance: (instanceId: string) => void) {
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  // Garde synchrone contre le double clic (l'état `enCours` n'est visible qu'au rendu suivant)
  const verrou = useRef(false)

  const lancerSeance = useCallback(
    async (seance: CibleLancement) => {
      if (verrou.current) return
      verrou.current = true
      setErreur(null)
      setEnCours(true)
      try {
        ouvrirInstance(await lancer(seance.id))
      } catch (e) {
        if (e instanceof ErreurSeance) setErreur(e.message)
        else {
          console.error('Lancement de la séance impossible', e)
          setErreur('Le lancement de la séance a échoué. Réessayez.')
        }
      } finally {
        verrou.current = false
        setEnCours(false)
      }
    },
    [lancer, ouvrirInstance],
  )

  const fermerErreur = useCallback(() => setErreur(null), [])

  return { erreur, enCours, lancer: lancerSeance, fermerErreur }
}
