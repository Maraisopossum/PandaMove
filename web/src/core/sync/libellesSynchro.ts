import type { SyncState } from './useSyncStatus'

// Libellés partagés (barre du haut) ; le test e2e s'appuie sur ces textes exacts.
export const LIBELLES_SYNCHRO: Record<SyncState, string> = {
  offline: 'hors ligne',
  syncing: 'synchronisation…',
  online: 'en ligne',
}
