import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabase } from '../../core/db/client'
import {
  CLE_PUSH_ACTIF,
  TABLE_ABONNEMENTS,
  cleVapidPublique,
  cleVersUint8Array,
  fuseauAppareil,
  ligneDepuisAbonnement,
  pushDisponible,
} from './push'

// Accès à la table des abonnements : l'interface minimale utilisée (le client Supabase l'implémente, les tests la remplacent).
export interface ClientAbonnements {
  from(table: string): {
    upsert(ligne: object, options: { onConflict: string }): PromiseLike<{ error: { message: string } | null }>
    delete(): { eq(colonne: string, valeur: string): PromiseLike<{ error: { message: string } | null }> }
  }
}

export interface DepsPush {
  /** Clé VAPID publique (défaut : variable de build). */
  cle?: string
  client?: () => ClientAbonnements
  /** Registration du service worker (défaut : navigator.serviceWorker.ready, avec délai). */
  registration?: () => Promise<ServiceWorkerRegistration>
  demanderPermission?: () => Promise<NotificationPermission>
  fuseau?: () => string
}

const DELAI_SERVICE_WORKER_MS = 8000

const registrationParDefaut = (): Promise<ServiceWorkerRegistration> =>
  Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, rejeter) => setTimeout(() => rejeter(new Error('service worker indisponible')), DELAI_SERVICE_WORKER_MS)),
  ])

const permissionParDefaut = async (): Promise<NotificationPermission> =>
  Notification.permission === 'default' ? Notification.requestPermission() : Notification.permission

function memoriser(actif: boolean) {
  try {
    if (actif) window.localStorage.setItem(CLE_PUSH_ACTIF, '1')
    else window.localStorage.removeItem(CLE_PUSH_ACTIF)
  } catch {
    // stockage indisponible : le planificateur local pourrait faire doublon, sans autre conséquence
  }
}

// Rappels par notification push, application fermée : abonnement du navigateur au service push, puis enregistrement de
// l'abonnement dans Supabase (fonction `envoyer-rappels`, voir supabase/functions/envoyer-rappels/README.md). L'option n'est
// proposée que si le navigateur sait recevoir des push ET que le serveur est configuré (VITE_VAPID_PUBLIC_KEY).
export function usePushRappels({ cle = cleVapidPublique(), client = () => getSupabase(), registration = registrationParDefaut, demanderPermission = permissionParDefaut, fuseau = fuseauAppareil }: DepsPush = {}) {
  const disponible = pushDisponible(cle)
  const [actif, setActif] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState('')
  const verrou = useRef(false)

  // État de départ : cet appareil est-il déjà abonné ? Le fuseau est remis à jour (déplacement, changement d'heure).
  useEffect(() => {
    if (!disponible) return
    let annule = false
    ;(async () => {
      try {
        const abonnement = await (await registration()).pushManager.getSubscription()
        const ligne = abonnement ? ligneDepuisAbonnement(abonnement, fuseau()) : null
        if (annule) return
        setActif(ligne !== null)
        memoriser(ligne !== null)
        if (ligne) await client().from(TABLE_ABONNEMENTS).upsert(ligne, { onConflict: 'endpoint' })
      } catch {
        // pas de service worker (version de développement) ou serveur indisponible : l'option reste éteinte
      }
    })()
    return () => {
      annule = true
    }
    // Lu une fois à l'ouverture de l'écran
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disponible])

  const activer = useCallback(async () => {
    if (verrou.current || !cle) return
    verrou.current = true
    setEnCours(true)
    setMessage('')
    let creeIci = false
    let abonnement: PushSubscription | null = null
    try {
      if ((await demanderPermission()) !== 'granted') {
        setMessage("Notifications refusées : autorisez-les pour PandaMove dans les réglages du navigateur ou de l'appareil.")
        return
      }
      const reg = await registration()
      abonnement = await reg.pushManager.getSubscription()
      if (!abonnement) {
        abonnement = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleVersUint8Array(cle) })
        creeIci = true
      }
      const ligne = ligneDepuisAbonnement(abonnement, fuseau())
      if (!ligne) throw new Error('abonnement incomplet')
      const { error } = await client().from(TABLE_ABONNEMENTS).upsert(ligne, { onConflict: 'endpoint' })
      if (error) throw new Error(error.message)
      memoriser(true)
      setActif(true)
    } catch (e) {
      console.error('Activation des rappels push impossible', e)
      // Ne pas garder un abonnement que le serveur ne connaît pas
      if (creeIci) await abonnement?.unsubscribe().catch(() => undefined)
      setMessage("Les rappels application fermée n'ont pas pu être activés. Vérifiez votre connexion puis réessayez ; si le problème continue, le serveur d'envoi n'est peut-être pas encore installé.")
    } finally {
      verrou.current = false
      setEnCours(false)
    }
  }, [cle, client, demanderPermission, fuseau, registration])

  const desactiver = useCallback(async () => {
    if (verrou.current) return
    verrou.current = true
    setEnCours(true)
    setMessage('')
    try {
      const abonnement = await (await registration()).pushManager.getSubscription()
      if (abonnement) {
        // Ligne supprimée d'abord ; si elle reste (réseau coupé), le serveur la retirera quand le service push la déclarera expirée
        await client().from(TABLE_ABONNEMENTS).delete().eq('endpoint', abonnement.endpoint)
        await abonnement.unsubscribe()
      }
    } catch (e) {
      console.error('Désactivation des rappels push impossible', e)
    } finally {
      memoriser(false)
      setActif(false)
      verrou.current = false
      setEnCours(false)
    }
  }, [client, registration])

  return { disponible, actif, enCours, message, activer, desactiver }
}
