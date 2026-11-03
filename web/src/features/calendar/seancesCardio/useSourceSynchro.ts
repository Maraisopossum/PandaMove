import type { PowerSyncDatabase } from '@powersync/web'
import { useMemo } from 'react'
import { getDb } from '../../../core/db/client'
import { useSyncStatus, type SyncState } from '../../../core/sync/useSyncStatus'

// Ce que l'import du programme demande à la synchronisation. Une interface à part pour pouvoir la simuler dans les
// tests : le vrai PowerSync (WASM) ne se charge pas sous Node.
export interface SourceSynchro {
  etat: SyncState
  /** Se résout quand la première synchronisation est terminée ; annulée par le signal. */
  attendrePremiereSynchro(signal: AbortSignal): Promise<void>
  /** Nombre d'écritures locales pas encore envoyées au serveur. */
  compterFileEnvoi(): Promise<number>
}

// Source réelle : la base de l'application (ou celle fournie par les tests).
export function useSourceSynchro(db: PowerSyncDatabase = getDb()): SourceSynchro {
  const { state } = useSyncStatus(db)
  return useMemo(
    () => ({
      etat: state,
      attendrePremiereSynchro: (signal) => db.waitForFirstSync(signal),
      compterFileEnvoi: async () => (await db.getUploadQueueStats()).count,
    }),
    [db, state],
  )
}
