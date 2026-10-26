import type { PowerSyncBackendConnector, PowerSyncDatabase } from '@powersync/web'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDb } from '../db/client'
import { SupabaseConnector } from './connector'

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

export const MESSAGE_AUTRE_COMPTE =
  "Des modifications non synchronisées d'un autre compte sont présentes sur cet appareil. Reconnectez-vous avec ce compte pour les envoyer."

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
    // Renvoie true si la connexion est bloquée par des modifications non envoyées d'un autre compte
    connecter(userId: string) {
      return enfiler(
        'connexion',
        async () => {
          const dernier = stockage.lire()
          if (dernier && dernier !== userId) {
            // Autre compte sur ce navigateur : ses écritures non envoyées ne doivent être ni perdues
            // ni envoyées sous le jeton du nouveau compte, donc on ne vide que si la file est vide.
            const { count } = await db.getUploadQueueStats()
            if (count > 0) return true
            await db.disconnectAndClear()
          }
          stockage.ecrire(userId)
          await db.connect(creerConnecteur())
          return false
        },
        false,
      )
    },
    // Choix explicite de l'utilisateur : abandonne les données locales de l'autre compte puis connecte
    abandonnerEtConnecter(userId: string) {
      return enfiler(
        'abandon des données locales',
        async () => {
          await db.disconnectAndClear()
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

  const [bloque, setBloque] = useState(false)

  useEffect(() => {
    if (!userId) return
    void operations.connecter(userId).then(setBloque)
    return () => {
      void operations.deconnecter()
    }
  }, [userId, operations])

  const signOutSafely = useCallback(() => operations.deconnexionSure(signOut), [operations, signOut])
  const abandonnerDonneesLocales = useCallback(async () => {
    if (!userId) return
    await operations.abandonnerEtConnecter(userId)
    setBloque(false)
  }, [operations, userId])

  return {
    signOutSafely,
    abandonnerDonneesLocales,
    messageAutreCompte: userId && bloque ? MESSAGE_AUTRE_COMPTE : null,
  }
}
