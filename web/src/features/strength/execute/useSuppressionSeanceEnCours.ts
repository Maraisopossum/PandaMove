import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { getDb } from '../../../core/db/client'
import type { Db } from '../../../core/db/Db'
import { ErreurCalendrier } from '../../calendar/calendrier'
import { ErreurSeance } from '../affectation'
import { supprimerInstanceRenforcement } from '../suppression'

// « Supprimer la séance » du menu de l'exécution (deleteInstance Android) : suppression LOGIQUE de la séance jouée,
// de ses lignes copiées et de ses séries, après confirmation. Le modèle n'est jamais touché ; on retourne ensuite
// aux séances programmées. En cas d'échec le dialogue reste ouvert avec un message français.
export function useSuppressionSeanceEnCours(instanceId: string, db?: Db) {
  const navigate = useNavigate()
  const [ouverte, setOuverte] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const verrou = useRef(false)

  const demander = useCallback(() => {
    setErreur(null)
    setOuverte(true)
  }, [])
  const annuler = useCallback(() => {
    if (!verrou.current) setOuverte(false)
  }, [])

  const confirmer = useCallback(async () => {
    if (verrou.current) return
    verrou.current = true
    setEnCours(true)
    setErreur(null)
    try {
      await supprimerInstanceRenforcement(db ?? getDb(), instanceId)
      setOuverte(false)
      await navigate('/strength/planned')
    } catch (e) {
      if (e instanceof ErreurSeance || e instanceof ErreurCalendrier) setErreur(e.message)
      else {
        console.error('Suppression de la séance impossible', e)
        setErreur('La suppression de la séance a échoué. Réessayez.')
      }
    } finally {
      verrou.current = false
      setEnCours(false)
    }
  }, [db, instanceId, navigate])

  return { ouverte, erreur, enCours, demander, annuler, confirmer }
}
