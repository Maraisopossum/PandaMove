import { useEffect, useState } from 'react'
import { listerComptes, lireJournal, lireResume, type CompteAdmin, type EntreeJournal, type ResumeAdmin } from '../../core/admin/admin'
import { getSupabase } from '../../core/db/client'
import type { ClientSupabase } from '../../core/db/clientSupabase'

type Etat<T> = { etat: 'chargement' } | { etat: 'erreur'; message: string } | { etat: 'pret'; donnees: T }

/** Lecture d'une donnée d'administration (comptes, résumé, journal) : chargement, erreur lisible, ou données. */
function useLecture<T>(lire: (c: ClientSupabase) => Promise<T>, client?: ClientSupabase): Etat<T> {
  const [e, setE] = useState<Etat<T>>({ etat: 'chargement' })
  useEffect(() => {
    let annule = false
    lire(client ?? getSupabase())
      .then((donnees) => !annule && setE({ etat: 'pret', donnees }))
      .catch((err: unknown) => {
        if (!annule) setE({ etat: 'erreur', message: err instanceof Error && /Accès refusé/.test(err.message) ? 'Accès refusé par le serveur : le rôle administrateur manque dans votre jeton (reconnectez-vous).' : 'Impossible de lire ces informations pour le moment.' })
      })
    return () => {
      annule = true
    }
    // `lire` est une fonction du module, stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client])
  return e
}

export const useComptes = (client?: ClientSupabase): Etat<CompteAdmin[]> => useLecture(listerComptes, client)
export const useResume = (client?: ClientSupabase): Etat<ResumeAdmin> => useLecture(lireResume, client)
export const useJournal = (client?: ClientSupabase): Etat<EntreeJournal[]> => useLecture((c) => lireJournal(c, 100), client)
