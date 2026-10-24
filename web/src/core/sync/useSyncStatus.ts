import type { PowerSyncDatabase } from '@powersync/web'
import { useEffect, useState } from 'react'
import { getDb } from '../db/client'

export type SyncState = 'online' | 'offline' | 'syncing'

type StatutSynchro = PowerSyncDatabase['currentStatus']

function calculerEtat(statut: StatutSynchro): SyncState {
  if (!statut.connected) return 'offline'
  if (statut.dataFlowStatus.uploading || statut.dataFlowStatus.downloading) return 'syncing'
  return 'online'
}

// Indicateur de synchronisation : l'état se met à jour à chaque changement de statut PowerSync.
// `db` est paramétrable pour les tests ; par défaut, la base de l'application.
export function useSyncStatus(db: PowerSyncDatabase = getDb()): { state: SyncState } {
  const [state, setState] = useState<SyncState>(() => calculerEtat(db.currentStatus))

  useEffect(() => {
    return db.registerListener({ statusChanged: (statut) => setState(calculerEtat(statut)) })
  }, [db])

  return { state }
}
