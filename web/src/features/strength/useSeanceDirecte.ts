import { useCallback, useRef, useState } from 'react'
import { ErreurSeance } from './affectation'
import { nomParDefautSeanceDirecte } from './seanceDirecte'
import { aujourdhuiIso } from './saisie'

// Dialogue « Séance directe » : une séance planifiée aujourd'hui, sans modèle réutilisable. `creer` vient de
// useSeanceList ; `composer` ouvre l'édition de la séance créée (le web ne permet pas d'ajouter des exercices en cours
// d'exécution : on les choisit avant de jouer). En cas d'échec le dialogue reste ouvert avec un message français.
export function useSeanceDirecte(
  creer: (nom: string, dateIso: string) => Promise<{ seanceId: string }>,
  composer: (seanceId: string) => void,
) {
  const [ouvert, setOuvert] = useState(false)
  const [nom, setNom] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const verrou = useRef(false)
  // Date du jour fixée à l'ouverture (la même pour le nom proposé et la création)
  const [date, setDate] = useState(aujourdhuiIso)

  const ouvrir = useCallback(() => {
    setNom('')
    setErreur(null)
    setDate(aujourdhuiIso())
    setOuvert(true)
  }, [])

  const fermer = useCallback(() => {
    if (!verrou.current) setOuvert(false)
  }, [])

  const confirmer = useCallback(async () => {
    if (verrou.current) return
    verrou.current = true
    setErreur(null)
    setEnCours(true)
    try {
      const { seanceId } = await creer(nom, date)
      setOuvert(false)
      composer(seanceId)
    } catch (e) {
      if (e instanceof ErreurSeance) setErreur(e.message)
      else {
        console.error('Création de la séance directe impossible', e)
        setErreur('La création de la séance a échoué. Réessayez.')
      }
    } finally {
      verrou.current = false
      setEnCours(false)
    }
  }, [composer, creer, date, nom])

  return { ouvert, nom, setNom, proposition: nomParDefautSeanceDirecte(date), erreur, enCours, ouvrir, fermer, confirmer }
}
