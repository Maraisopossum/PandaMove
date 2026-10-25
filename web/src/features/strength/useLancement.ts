import { useCallback, useRef, useState } from 'react'
import type { Seance } from '../../core/db/types'

/** Ce dont le lancement a besoin : l'id (à lancer) et le nom (affiché dans le dialogue). */
export type CibleLancement = Pick<Seance, 'id' | 'nom'>
import { ErreurSeance } from './affectation'

// Dialogue « Lancer « {nom} » maintenant ? ». `lancer` crée (ou reprend) puis démarre l'instance du jour
// et renvoie son id ; `ouvrirInstance` navigue vers l'exécution. En cas d'échec le dialogue reste ouvert
// avec un message français (jamais de fermeture silencieuse).
export function useLancement(lancer: (seanceId: string) => Promise<string>, ouvrirInstance: (instanceId: string) => void) {
  const [cible, setCible] = useState<CibleLancement | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  // Garde synchrone contre le double clic (l'état `enCours` n'est visible qu'au rendu suivant)
  const verrou = useRef(false)

  const ouvrir = useCallback((seance: CibleLancement) => {
    setCible(seance)
    setErreur(null)
  }, [])

  const fermer = useCallback(() => {
    if (!verrou.current) setCible(null)
  }, [])

  const confirmer = useCallback(async () => {
    if (!cible || verrou.current) return
    verrou.current = true
    setErreur(null)
    setEnCours(true)
    try {
      const instanceId = await lancer(cible.id)
      setCible(null)
      ouvrirInstance(instanceId)
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
  }, [cible, lancer, ouvrirInstance])

  return { cible, erreur, enCours, ouvrir, fermer, confirmer }
}
