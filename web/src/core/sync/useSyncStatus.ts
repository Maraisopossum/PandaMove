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

// Vrai si le navigateur se sait hors ligne. Sans `navigator` (tests, rendu serveur), on suppose en ligne.
function navigateurHorsLigne(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

// Indicateur de synchronisation : l'état se met à jour à chaque changement de statut PowerSync.
// Le drapeau `connected` de PowerSync ne bascule qu'à l'échec du flux (parfois très tard) :
// dès que le navigateur est hors ligne (navigator.onLine === false), l'état est donc « offline »,
// quel que soit le statut PowerSync. Les événements `online` / `offline` de la fenêtre le réévaluent
// immédiatement ; au retour en ligne, on retombe sur l'état dérivé de PowerSync.
// `db` est paramétrable pour les tests ; par défaut, la base de l'application.
export function useSyncStatus(db: PowerSyncDatabase = getDb()): { state: SyncState } {
  const [etatPowerSync, setEtatPowerSync] = useState<SyncState>(() => calculerEtat(db.currentStatus))
  const [horsLigne, setHorsLigne] = useState<boolean>(navigateurHorsLigne)

  useEffect(() => {
    return db.registerListener({ statusChanged: (statut) => setEtatPowerSync(calculerEtat(statut)) })
  }, [db])

  useEffect(() => {
    const reevaluer = () => setHorsLigne(navigateurHorsLigne())
    window.addEventListener('online', reevaluer)
    window.addEventListener('offline', reevaluer)
    // Le réseau a pu changer entre le premier rendu et l'abonnement
    reevaluer()
    return () => {
      window.removeEventListener('online', reevaluer)
      window.removeEventListener('offline', reevaluer)
    }
  }, [])

  return { state: horsLigne ? 'offline' : etatPowerSync }
}
