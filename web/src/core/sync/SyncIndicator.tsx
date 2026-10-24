import { cssFondBadgeSync } from '../../app/contraste'
import { LIBELLES_SYNCHRO } from './libellesSynchro'
import { useSyncStatus, type SyncState } from './useSyncStatus'

// Pastille de présentation pure (testable sans base).
export function SyncBadge({ state }: { state: SyncState }) {
  return (
    <span className={`sync sync--${state}`} role="status" data-testid="sync-state" style={{ background: cssFondBadgeSync }}>
      {LIBELLES_SYNCHRO[state]}
    </span>
  )
}

// Indicateur branché sur l'état de synchro PowerSync.
export function SyncIndicator() {
  const { state } = useSyncStatus()
  return <SyncBadge state={state} />
}
