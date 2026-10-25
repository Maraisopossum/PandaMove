import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { ErreurCalendrier } from '../calendar/calendrier'
import { ErreurSeance, lancerSeanceMaintenant } from './affectation'
import { lireDetailSeance, type DetailSeance, type InstanceDetail } from './detailSeance'
import { supprimerInstanceRenforcement } from './suppression'
import { useLancement } from './useLancement'

export interface DepsDetailSeance {
  /** Base à utiliser (défaut : base de l'application, résolue à l'usage). */
  db?: Db
}

type Etat = { id: string; detail: DetailSeance | null; erreur: string | null }

// Détail d'une séance type (lecture seule) : composition, historique des séances jouées, lancement immédiat et
// suppression d'une séance jouée. La base n'expose pas d'observation : le détail est relu après chaque écriture.
// `id` vient de l'URL (/strength/:id) ; un id inconnu ou supprimé donne l'état « introuvable » (jamais un écran vide).
export function useDetailSeance({ db }: DepsDetailSeance = {}) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [etat, setEtat] = useState<Etat | null>(null)
  const [erreurAction, setErreurAction] = useState<string | null>(null)
  // Seule la dernière lecture lancée est appliquée (changement d'id, rechargement)
  const sequence = useRef(0)

  const lire = useCallback(async (): Promise<Etat> => {
    try {
      const detail = await lireDetailSeance(db ?? getDb(), id)
      return { id, detail, erreur: detail ? null : 'Séance introuvable.' }
    } catch (e) {
      console.error('Chargement de la séance impossible', e)
      return { id, detail: null, erreur: 'Le chargement de la séance a échoué.' }
    }
  }, [db, id])

  const recharger = useCallback(async () => {
    const numero = ++sequence.current
    const r = await lire()
    if (numero === sequence.current) setEtat(r)
  }, [lire])

  useEffect(() => {
    void recharger()
  }, [recharger])

  const ouvrirInstance = useCallback((instanceId: string) => navigate(`/strength/instance/${instanceId}`), [navigate])
  const lancement = useLancement((seanceId) => lancerSeanceMaintenant(db ?? getDb(), seanceId, new Date()), ouvrirInstance)

  const detailCourant = etat !== null && etat.id === id ? etat.detail : null
  const { ouvrir: ouvrirLancement } = lancement
  const lancer = useCallback(() => {
    if (detailCourant) ouvrirLancement({ id: detailCourant.id, nom: detailCourant.nom })
  }, [detailCourant, ouvrirLancement])

  // Suppression d'une séance jouée / planifiée de cet historique, après confirmation
  const [aSupprimer, setASupprimer] = useState<InstanceDetail | null>(null)
  const [suppressionEnCours, setSuppressionEnCours] = useState(false)
  const demanderSuppression = useCallback((i: InstanceDetail) => {
    setErreurAction(null)
    setASupprimer(i)
  }, [])
  const annulerSuppression = useCallback(() => setASupprimer(null), [])
  const confirmerSuppression = useCallback(async () => {
    if (!aSupprimer || suppressionEnCours) return
    setSuppressionEnCours(true)
    try {
      await supprimerInstanceRenforcement(db ?? getDb(), aSupprimer.id)
    } catch (e) {
      if (e instanceof ErreurSeance || e instanceof ErreurCalendrier) setErreurAction(e.message)
      else {
        console.error('Suppression de la séance impossible', e)
        setErreurAction('La suppression a échoué.')
      }
    } finally {
      setSuppressionEnCours(false)
      setASupprimer(null)
    }
    await recharger()
  }, [aSupprimer, db, recharger, suppressionEnCours])

  const aJour = etat !== null && etat.id === id
  return {
    id,
    chargement: !aJour,
    detail: aJour ? etat.detail : null,
    erreur: aJour ? etat.erreur : null,
    erreurAction,
    lancement,
    lancer,
    aSupprimer,
    suppressionEnCours,
    demanderSuppression,
    annulerSuppression,
    confirmerSuppression,
  }
}
