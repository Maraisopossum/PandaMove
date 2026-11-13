// Aides pures des notifications push (rappels application fermée). Aucun accès réseau ici : l'abonnement et l'écriture vers
// Supabase sont dans usePushRappels.

/** Drapeau local : cet appareil reçoit ses rappels par push (le planificateur local, qui ferait doublon, se met alors en retrait). */
export const CLE_PUSH_ACTIF = 'pandamove.push.actif'

/** Table des abonnements (migration 0013), écrite directement vers Supabase (hors synchronisation PowerSync). */
export const TABLE_ABONNEMENTS = 'push_abonnements'

/** Clé publique VAPID du serveur d'envoi (variable de build) ; absente : l'option n'est pas proposée. */
export const cleVapidPublique = (): string | undefined => {
  const v = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  return v && v.trim() !== '' ? v.trim() : undefined
}

/** Le navigateur sait-il recevoir des push, et le serveur est-il configuré ? */
export function pushDisponible(cle: string | undefined = cleVapidPublique()): boolean {
  return (
    cle !== undefined &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** Clé VAPID (base64 URL) au format attendu par `pushManager.subscribe`. */
export function cleVersUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const rempli = base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)
  const binaire = atob(rempli.replace(/-/g, '+').replace(/_/g, '/'))
  const octets = new Uint8Array(new ArrayBuffer(binaire.length))
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i)
  return octets
}

export interface LigneAbonnement {
  endpoint: string
  cle_p256dh: string
  cle_auth: string
  /** Fuseau horaire IANA de l'appareil : les heures de rappel sont des heures locales. */
  fuseau: string
}

/** Ligne à écrire pour un abonnement du navigateur ; null si le navigateur n'a pas fourni toutes les clés. */
export function ligneDepuisAbonnement(abonnement: Pick<PushSubscription, 'toJSON'>, fuseau: string): LigneAbonnement | null {
  const j = abonnement.toJSON()
  const p256dh = j.keys?.p256dh
  const auth = j.keys?.auth
  if (!j.endpoint || !p256dh || !auth) return null
  return { endpoint: j.endpoint, cle_p256dh: p256dh, cle_auth: auth, fuseau }
}

export const fuseauAppareil = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
