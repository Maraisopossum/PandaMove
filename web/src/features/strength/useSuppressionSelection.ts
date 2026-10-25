import { useCallback, useRef, useState } from 'react'
import { ErreurCalendrier } from '../calendar/calendrier'
import { ErreurSeance } from './affectation'

// Dialogue « Supprimer ces N éléments ? » d'une sélection multiple. `executer` écrit (suppressions logiques) et recharge la
// liste ; en cas de succès la sélection est quittée. En cas d'échec le dialogue reste ouvert avec un message français.
export function useSuppressionSelection(executer: (ids: string[]) => Promise<unknown>, quitterSelection: () => void) {
  const [ouvert, setOuvert] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const verrou = useRef(false)

  const demander = useCallback(() => {
    setErreur(null)
    setOuvert(true)
  }, [])
  const fermer = useCallback(() => {
    if (!verrou.current) setOuvert(false)
  }, [])

  const confirmer = useCallback(
    async (ids: string[]) => {
      if (verrou.current) return
      verrou.current = true
      setEnCours(true)
      setErreur(null)
      try {
        await executer(ids)
        setOuvert(false)
        quitterSelection()
      } catch (e) {
        if (e instanceof ErreurSeance || e instanceof ErreurCalendrier) setErreur(e.message)
        else {
          console.error('Suppression de la sélection impossible', e)
          setErreur('La suppression a échoué. Réessayez.')
        }
      } finally {
        verrou.current = false
        setEnCours(false)
      }
    },
    [executer, quitterSelection],
  )

  return { ouvert, erreur, enCours, demander, fermer, confirmer }
}
