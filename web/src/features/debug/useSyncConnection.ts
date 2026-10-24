import type { PowerSyncBackendConnector, PowerSyncDatabase } from '@powersync/web'
import { useCallback, useEffect, useMemo } from 'react'
import { getDb } from '../../core/db/client'
import { SupabaseConnector } from '../../core/sync/connector'

const CLE_DERNIER_UTILISATEUR = 'pandamove.dernierUtilisateur'

export interface StockageUtilisateur {
  lire(): string | null
  ecrire(id: string): void
  effacer(): void
}

// Mémorise le dernier utilisateur connecté ; localStorage peut être indisponible ou lever une erreur.
const stockageNavigateur: StockageUtilisateur = {
  lire() {
    try {
      return localStorage.getItem(CLE_DERNIER_UTILISATEUR)
    } catch {
      return null
    }
  },
  ecrire(id) {
    try {
      localStorage.setItem(CLE_DERNIER_UTILISATEUR, id)
    } catch {
      /* stockage indisponible : on retombe sur le comportement sans mémoire */
    }
  },
  effacer() {
    try {
      localStorage.removeItem(CLE_DERNIER_UTILISATEUR)
    } catch {
      /* idem */
    }
  },
}

export interface ResultatDeconnexion {
  ok: boolean
  message?: string
}

// Opérations de synchro sérialisées : chaque appel attend la fin du précédent (pas de connexion qui
// double un effacement en cours), et toute erreur est journalisée au lieu d'être avalée.
export function creerOperationsSynchro(
  db: PowerSyncDatabase,
  creerConnecteur: () => PowerSyncBackendConnector,
  stockage: StockageUtilisateur,
) {
  let chaine: Promise<unknown> = Promise.resolve()
  function enfiler<T>(nom: string, operation: () => Promise<T>, repli: T): Promise<T> {
    const suite = chaine.then(operation).catch((e: unknown) => {
      console.error(`Synchro : échec de l'opération « ${nom} »`, e)
      return repli
    })
    chaine = suite
    return suite
  }

  return {
    connecter(userId: string) {
      return enfiler(
        'connexion',
        async () => {
          // Autre compte sur ce navigateur : on vide la base locale avant de connecter
          const dernier = stockage.lire()
          if (dernier && dernier !== userId) await db.disconnectAndClear()
          stockage.ecrire(userId)
          await db.connect(creerConnecteur())
        },
        undefined,
      )
    },
    // Coupure simple : ne touche jamais aux données locales ni à la file d'envoi
    deconnecter() {
      return enfiler('déconnexion', () => db.disconnect(), undefined)
    },
    // Déconnexion explicite : refusée tant que des modifications locales n'ont pas été envoyées
    deconnexionSure(signOut: () => Promise<void>) {
      return enfiler<ResultatDeconnexion>(
        'déconnexion sûre',
        async () => {
          const { count } = await db.getUploadQueueStats()
          if (count > 0) {
            return {
              ok: false,
              message: `${count} modification(s) non synchronisée(s) seraient perdues — reconnectez-vous au réseau puis réessayez`,
            }
          }
          await db.disconnectAndClear()
          stockage.effacer()
          await signOut()
          return { ok: true }
        },
        { ok: false, message: 'La déconnexion a échoué : réessayez.' },
      )
    },
  }
}

interface Options {
  userId: string | null
  signOut: () => Promise<void>
  db?: PowerSyncDatabase
  creerConnecteur?: () => PowerSyncBackendConnector
  stockage?: StockageUtilisateur
}

// Branche la synchro PowerSync tant qu'une session existe. Le nettoyage de l'effet (déconnexion
// automatique, démontage, double effet de StrictMode) ne fait que couper la connexion.
export function useSyncConnection({
  userId,
  signOut,
  db,
  creerConnecteur = () => new SupabaseConnector(),
  stockage = stockageNavigateur,
}: Options) {
  const operations = useMemo(
    () => creerOperationsSynchro(db ?? getDb(), creerConnecteur, stockage),
    // creerConnecteur est stable par construction (valeur par défaut ou injectée une fois)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, stockage],
  )

  useEffect(() => {
    if (!userId) return
    void operations.connecter(userId)
    return () => {
      void operations.deconnecter()
    }
  }, [userId, operations])

  const signOutSafely = useCallback(() => operations.deconnexionSure(signOut), [operations, signOut])
  return { signOutSafely }
}
