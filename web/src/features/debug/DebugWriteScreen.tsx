import { useAuth } from '../../core/auth/AuthProvider'
import { useDebugSeances } from './useDebugSeances'

// Page de debug (dev uniquement, route /debug/write) : écrit une séance en local.
// L'état de synchro (data-testid="sync-state", vérifié par e2e/offline-sync.spec.ts) et la
// déconnexion viennent de la coque applicative.
export default function DebugWriteScreen() {
  const { session } = useAuth()
  const { seances, ajouter } = useDebugSeances(session?.user.id ?? '')

  return (
    <>
      <h1>Debug : écriture</h1>
      <button type="button" onClick={() => void ajouter()}>
        Ajouter une séance
      </button>
      <ul>
        {seances.map((s) => (
          <li key={s.id}>{s.nom}</li>
        ))}
      </ul>
    </>
  )
}
