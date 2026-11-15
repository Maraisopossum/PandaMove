import { useEffect, useRef } from 'react'
import { getSupabase } from '../db/client'
import { useSyncStatus } from '../sync/useSyncStatus'
import { rejetsEnvoi } from '../sync/rejetsEnvoi'
import { envoyerBattement } from './admin'

/** Version de l'application envoyée avec le battement : empreinte du commit du build (vite.config.ts), « dev » en local. */
export const VERSION_APPLICATION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'

/** Délai minimal entre deux battements « synchro » (une synchro toutes les quelques secondes ne doit pas devenir une requête à chaque fois). */
export const DELAI_BATTEMENT_MS = 15 * 60 * 1000

/**
 * Battement de l'application (version et horodatage, aucune donnée d'entraînement) : une fois à l'ouverture, puis après une synchro
 * réussie, au plus toutes les 15 minutes. Annoncé dans le profil. Les échecs sont ignorés.
 */
export function useBattement({ userId, envoyer }: { userId: string | undefined; envoyer?: (synchro: boolean) => Promise<void> }) {
  const { state } = useSyncStatus()
  const dernier = useRef(0)
  const ouvert = useRef<string | null>(null)
  const emettre =
    envoyer ??
    (async (synchro: boolean) => {
      // Les rejets comptés depuis le dernier battement partent avec lui ; en cas d'échec, ils sont restitués pour le suivant
      const rejets = rejetsEnvoi.prelever()
      if (!(await envoyerBattement(getSupabase(), VERSION_APPLICATION, synchro, rejets))) rejetsEnvoi.restituer(rejets)
    })

  useEffect(() => {
    if (!userId || ouvert.current === userId) return
    ouvert.current = userId
    dernier.current = Date.now()
    void emettre(false)
    // `emettre` change à chaque rendu sans changer de sens : seul l'utilisateur déclenche l'ouverture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (!userId || state !== 'online' || Date.now() - dernier.current < DELAI_BATTEMENT_MS) return
    dernier.current = Date.now()
    void emettre(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, state])
}
