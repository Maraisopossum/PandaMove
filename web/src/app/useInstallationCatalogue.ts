import { useEffect } from 'react'
import { getDb } from '../core/db/client'

// Installe une seule fois le catalogue de base d'exercices après la première synchronisation
// (règles et marqueur dans core/catalogue/installationAuto). Une erreur est journalisée : le bouton
// « Ajouter le catalogue de base » de l'écran Catalogue reste disponible.
// Le module (catalogue JSON + schémas zod, ~45 Ko gzip) est chargé à la demande : il ne sert qu'une fois,
// après la première synchronisation, et n'a pas à retarder le premier affichage.
export function useInstallationCatalogue(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return
    const annulation = new AbortController()
    const db = getDb()
    import('../core/catalogue/installationAuto')
      .then(({ installerAutomatiquement }) =>
        installerAutomatiquement({
          db,
          userId,
          attendreSynchro: () => db.waitForFirstSync(annulation.signal),
        }),
      )
      .catch((e: unknown) => {
      if (!annulation.signal.aborted) console.error("Installation automatique du catalogue impossible", e)
    })
    return () => annulation.abort()
  }, [userId])
}
