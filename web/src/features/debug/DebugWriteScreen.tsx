import { useActionState } from 'react'
import { useSyncStatus, type SyncState } from '../../core/sync/useSyncStatus'
import { useDebugSeances } from './useDebugSeances'
import type { ResultatDeconnexion } from './useSyncConnection'

const LIBELLES: Record<SyncState, string> = {
  offline: 'hors ligne',
  syncing: 'synchronisation…',
  online: 'en ligne',
}

// Page de debug (dev uniquement) : écrit une séance en local et affiche l'état de synchro.
// Les textes d'état sont vérifiés par le test e2e (e2e/offline-sync.spec.ts).
export default function DebugWriteScreen({
  userId,
  signOutSafely,
  abandonnerDonneesLocales,
  messageAutreCompte,
}: {
  userId: string
  signOutSafely: () => Promise<ResultatDeconnexion>
  abandonnerDonneesLocales: () => Promise<void>
  messageAutreCompte: string | null
}) {
  const { state } = useSyncStatus()
  const { seances, ajouter } = useDebugSeances(userId)
  const [avertissement, deconnecter] = useActionState(async () => (await signOutSafely()).message ?? null, null)

  return (
    <main>
      <h1>Debug : écriture</h1>
      <p data-testid="sync-state">{LIBELLES[state]}</p>
      <button type="button" onClick={() => void ajouter()}>
        Ajouter une séance
      </button>
      <form action={deconnecter}>
        <button type="submit">Se déconnecter</button>
      </form>
      {messageAutreCompte && (
        <section role="alert">
          <p>{messageAutreCompte}</p>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Les modifications non synchronisées de l’autre compte seront définitivement perdues. Continuer ?')) {
                void abandonnerDonneesLocales()
              }
            }}
          >
            Abandonner les données locales
          </button>
        </section>
      )}
      {avertissement && <p role="alert">{avertissement}</p>}
      <ul>
        {seances.map((s) => (
          <li key={s.id}>{s.nom}</li>
        ))}
      </ul>
    </main>
  )
}
