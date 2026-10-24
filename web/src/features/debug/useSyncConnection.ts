import { useEffect } from 'react'
import { getDb } from '../../core/db/client'
import { SupabaseConnector } from '../../core/sync/connector'

// Branche la synchro PowerSync tant qu'une session existe, et la coupe à la déconnexion.
// À la déconnexion, les données locales sont effacées pour ne pas les exposer au compte suivant.
export function useSyncConnection(connecte: boolean) {
  useEffect(() => {
    if (!connecte) return
    const db = getDb()
    void db.connect(new SupabaseConnector())
    return () => {
      void db.disconnectAndClear()
    }
  }, [connecte])
}
