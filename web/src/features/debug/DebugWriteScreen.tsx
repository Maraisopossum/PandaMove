import { useSyncStatus, type SyncState } from '../../core/sync/useSyncStatus'
import { useDebugSeances } from './useDebugSeances'

const LIBELLES: Record<SyncState, string> = {
  offline: 'hors ligne',
  syncing: 'synchronisation…',
  online: 'en ligne',
}

// Page de debug (dev uniquement) : écrit une séance en local et affiche l'état de synchro.
// Les textes d'état sont vérifiés par le test e2e (e2e/offline-sync.spec.ts).
export default function DebugWriteScreen({ userId, onSignOut }: { userId: string; onSignOut: () => void }) {
  const { state } = useSyncStatus()
  const { seances, ajouter } = useDebugSeances(userId)

  return (
    <main>
      <h1>Debug : écriture</h1>
      <p data-testid="sync-state">{LIBELLES[state]}</p>
      <button type="button" onClick={() => void ajouter()}>
        Ajouter une séance
      </button>
      <button type="button" onClick={onSignOut}>
        Se déconnecter
      </button>
      <ul>
        {seances.map((s) => (
          <li key={s.id}>{s.nom}</li>
        ))}
      </ul>
    </main>
  )
}
