import { useEffect } from 'react'
import { installerAutomatiquement } from '../core/catalogue/installationAuto'
import { getDb } from '../core/db/client'

// Installe une seule fois le catalogue de base d'exercices après la première synchronisation
// (règles et marqueur dans core/catalogue/installationAuto). Une erreur est journalisée : le bouton
// « Ajouter le catalogue de base » de l'écran Catalogue reste disponible.
export function useInstallationCatalogue(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return
    const annulation = new AbortController()
    const db = getDb()
    installerAutomatiquement({
      db,
      userId,
      attendreSynchro: () => db.waitForFirstSync(annulation.signal),
    }).catch((e: unknown) => {
      if (!annulation.signal.aborted) console.error("Installation automatique du catalogue impossible", e)
    })
    return () => annulation.abort()
  }, [userId])
}
