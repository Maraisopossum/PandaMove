import { useCallback, useState } from 'react'
import type { Seance } from '../../core/db/types'
import { ErreurSeance } from './affectation'
import { aujourdhuiIso } from './saisie'

// État du dialogue d'affectation d'une séance à une date. `assigner` vient de useSeanceList.
export function useAffectation(assigner: (seanceId: string, dateIso: string) => Promise<string>) {
  const [cible, setCible] = useState<Seance | null>(null)
  const [date, setDate] = useState(aujourdhuiIso)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  // Instance créée par la dernière affectation : lien « Ouvrir la séance » (avant le calendrier)
  const [instanceCreee, setInstanceCreee] = useState<string | null>(null)

  const ouvrir = useCallback((seance: Seance) => {
    setCible(seance)
    setDate(aujourdhuiIso())
    setErreur(null)
    setConfirmation(null)
    setInstanceCreee(null)
  }, [])

  const fermer = useCallback(() => setCible(null), [])

  const confirmer = useCallback(async () => {
    if (!cible || enCours) return
    setErreur(null)
    setEnCours(true)
    try {
      const instanceId = await assigner(cible.id, date)
      setInstanceCreee(instanceId)
      const [a, m, j] = date.split('-')
      setConfirmation(`« ${cible.nom} » est affectée au ${j}/${m}/${a}.`)
      setCible(null)
    } catch (e) {
      if (e instanceof ErreurSeance) setErreur(e.message)
      else {
        console.error("Affectation de la séance impossible", e)
        setErreur("L'affectation a échoué.")
      }
    } finally {
      setEnCours(false)
    }
  }, [assigner, cible, date, enCours])

  return { cible, date, setDate, erreur, enCours, confirmation, instanceCreee, ouvrir, fermer, confirmer }
}
