import { useCallback, useState } from 'react'
import type { ResultatDeconnexion } from '../core/sync/useSyncConnection'

export interface Deconnexion {
  avertissement: string | null
  enCours: boolean
  deconnecter: () => Promise<void>
}

// Déconnexion sûre : l'avertissement de la synchro (modifications non envoyées) est conservé pour l'UI.
export function useDeconnexion(signOutSafely: () => Promise<ResultatDeconnexion>): Deconnexion {
  const [avertissement, setAvertissement] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const deconnecter = useCallback(async () => {
    setEnCours(true)
    try {
      const resultat = await signOutSafely()
      setAvertissement(resultat.message ?? null)
    } finally {
      setEnCours(false)
    }
  }, [signOutSafely])

  return { avertissement, enCours, deconnecter }
}
