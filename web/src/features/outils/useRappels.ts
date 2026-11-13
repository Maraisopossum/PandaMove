import { useCallback, useEffect, useRef, useState } from 'react'
import { dateIsoLocale } from '../../core/common/dates'
import { useAuth } from '../../core/auth/AuthProvider'
import { getDb } from '../../core/db/client'
import type { Db, DbLecture } from '../../core/db/Db'
import { lireRappelsJson, saveRappelsJson } from '../../core/db/repos/settings'
import { CLE_PUSH_ACTIF } from './push'
import { lireEvenementsPlage } from '../calendar/calendrier'
import {
  CLE_RAPPELS_ENVOYES,
  CLE_REGLAGES_RAPPELS,
  fusionnerSynchro,
  heureValide,
  lireReglages,
  purgerEnvoyes,
  rappelsDus,
  versJsonSynchro,
  type ReglagesRappels,
} from './rappels'

type Permission = 'indisponible' | NotificationPermission

const permissionActuelle = (): Permission => (typeof Notification === 'undefined' ? 'indisponible' : Notification.permission)

export const lireReglagesStockes = (): ReglagesRappels => lireReglages(window.localStorage.getItem(CLE_REGLAGES_RAPPELS))

const memoriser = (r: ReglagesRappels) => window.localStorage.setItem(CLE_REGLAGES_RAPPELS, JSON.stringify(r))

// Réglages des rappels (écran Rappels). Veille / jour même et heures sont synchronisés entre appareils (user_settings) ;
// l'interrupteur général reste sur l'appareil (copie locale complète aussi, pour un affichage immédiat et hors ligne).
// Activer demande l'autorisation de notifier ; refusée, l'interrupteur reste éteint et le message explique où la rétablir.
export function useReglagesRappels({ db }: { db?: Db } = {}) {
  const { session } = useAuth()
  const userId = session?.user.id
  const [reglages, setReglages] = useState<ReglagesRappels>(lireReglagesStockes)
  const [permission, setPermission] = useState<Permission>(permissionActuelle)
  const [message, setMessage] = useState('')

  // Au chargement : la part synchronisée remplace la copie locale ; jamais réglée en base, la copie locale de cet appareil
  // (réglée avant la synchronisation) y est reprise.
  useEffect(() => {
    if (!userId) return
    let annule = false
    const base = db ?? getDb()
    lireRappelsJson(base, userId)
      .then(async (json) => {
        if (annule) return
        if (json !== null) {
          const suite = fusionnerSynchro(lireReglagesStockes(), json)
          setReglages(suite)
          memoriser(suite)
        } else if (window.localStorage.getItem(CLE_REGLAGES_RAPPELS) !== null) {
          await saveRappelsJson(base, userId, versJsonSynchro(lireReglagesStockes()))
        }
      })
      .catch((e: unknown) => console.error('Lecture des réglages de rappels impossible', e))
    return () => {
      annule = true
    }
  }, [db, userId])

  const enregistrer = useCallback(
    (suite: ReglagesRappels) => {
      const synchroAvant = versJsonSynchro(reglages)
      setReglages(suite)
      memoriser(suite)
      if (userId && versJsonSynchro(suite) !== synchroAvant) {
        saveRappelsJson(db ?? getDb(), userId, versJsonSynchro(suite)).catch((e: unknown) =>
          console.error('Enregistrement des réglages de rappels impossible', e),
        )
      }
    },
    [reglages, db, userId],
  )

  const basculer = useCallback(
    async (actif: boolean) => {
      setMessage('')
      if (!actif) return enregistrer({ ...reglages, actif: false })
      if (typeof Notification === 'undefined') {
        setMessage("Ce navigateur ne permet pas les notifications : installez l'application sur l'écran d'accueil.")
        return
      }
      const reponse = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
      setPermission(reponse)
      if (reponse !== 'granted') {
        setMessage("Notifications refusées : autorisez-les pour PandaMove dans les réglages du navigateur ou de l'appareil.")
        return
      }
      enregistrer({ ...reglages, actif: true })
    },
    [reglages, enregistrer],
  )

  const modifier = useCallback(
    (champ: 'veille' | 'jour', actif: boolean) => enregistrer({ ...reglages, [champ]: actif }),
    [reglages, enregistrer],
  )

  const regler = useCallback(
    (champ: 'veilleHeure' | 'jourHeure', heure: string) => {
      if (heureValide(heure)) enregistrer({ ...reglages, [champ]: heure })
    },
    [reglages, enregistrer],
  )

  return { reglages, permission, message, basculer, modifier, regler }
}

async function notifier(titre: string, corps: string, cle: string): Promise<void> {
  // badge : silhouette de panda de la barre d'état Android (sans elle, une cloche générique)
  const options = { body: corps, tag: cle, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png' }
  const enregistrement = await navigator.serviceWorker?.getRegistration?.()
  if (enregistrement) await enregistrement.showNotification(titre, options)
  else new Notification(titre, options)
}

export interface DepsRappelsActifs {
  db?: DbLecture
  /** Compte connecté : ses réglages synchronisés (veille / jour même, heures) priment sur la copie locale. */
  userId?: string | null
  maintenant?: () => Date
  /** Envoi d'une notification (défaut : service worker, sinon Notification). */
  envoyer?: (titre: string, corps: string, cle: string) => Promise<void>
  /** Intervalle de vérification, en ms. */
  intervalleMs?: number
}

// Planificateur, monté une fois dans la coque : tant que l'application est ouverte (ou en arrière-plan sur le téléphone),
// il vérifie chaque minute si un rappel est dû. Une application web ne peut pas réveiller l'appareil quand elle est
// fermée : sans serveur de notifications, un rappel dû est envoyé à la prochaine ouverture de l'application.
const MAINTENANT = () => new Date()

export function useRappelsActifs({ db, userId, maintenant = MAINTENANT, envoyer = notifier, intervalleMs = 60_000 }: DepsRappelsActifs = {}) {
  const enCours = useRef(false)
  useEffect(() => {
    const verifier = async () => {
      if (enCours.current || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
      // Rappels par push activés sur cet appareil : le serveur s'en charge, le planificateur local ferait doublon
      if (window.localStorage.getItem(CLE_PUSH_ACTIF) === '1') return
      const locaux = lireReglagesStockes()
      if (!locaux.actif) return
      enCours.current = true
      try {
        const base = db ?? getDb()
        const reglages = userId ? fusionnerSynchro(locaux, await lireRappelsJson(base, userId)) : locaux
        const maintenantD = maintenant()
        const aujourdhui = dateIsoLocale(maintenantD)
        const [a, m, j] = aujourdhui.split('-').map(Number)
        const evenements = await lireEvenementsPlage(base, aujourdhui, dateIsoLocale(new Date(a, m - 1, j + 1)))
        const envoyes = new Set<string>(JSON.parse(window.localStorage.getItem(CLE_RAPPELS_ENVOYES) ?? '[]') as string[])
        const dus = rappelsDus(reglages, evenements, maintenantD, envoyes)
        for (const r of dus) {
          await envoyer(r.titre, r.corps, r.cle)
          envoyes.add(r.cle)
        }
        if (dus.length > 0) window.localStorage.setItem(CLE_RAPPELS_ENVOYES, JSON.stringify(purgerEnvoyes(envoyes, aujourdhui)))
      } catch (e) {
        console.error('Vérification des rappels impossible', e)
      } finally {
        enCours.current = false
      }
    }
    void verifier()
    const minuteur = window.setInterval(() => void verifier(), intervalleMs)
    const surVisibilite = () => {
      if (document.visibilityState === 'visible') void verifier()
    }
    document.addEventListener('visibilitychange', surVisibilite)
    return () => {
      window.clearInterval(minuteur)
      document.removeEventListener('visibilitychange', surVisibilite)
    }
  }, [db, userId, maintenant, envoyer, intervalleMs])
}
