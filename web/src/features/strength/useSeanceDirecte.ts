import { useCallback, useRef, useState } from 'react'
import { ErreurSeance } from './affectation'
import { nomParDefautSeanceDirecte } from './seanceDirecte'
import { aujourdhuiIso } from './saisie'

// Dialogue « Séance directe » : une séance planifiée aujourd'hui, sans modèle réutilisable. `creer` vient de
// useSeanceList ; `ouvrir` ouvre l'EXÉCUTION de l'instance créée (comme Android : les exercices s'ajoutent en séance,
// par « Modifier les exercices »). En cas d'échec le dialogue reste ouvert avec un message français.
export function useSeanceDirecte(
  creer: (nom: string, dateIso: string) => Promise<{ instanceId: string }>,
  ouvrir: (instanceId: string) => void,
) {
  const [ouvert, setOuvert] = useState(false)
  const [nom, setNom] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const verrou = useRef(false)
  // Date du jour fixée à l'ouverture (la même pour le nom proposé et la création)
  const [date, setDate] = useState(aujourdhuiIso)

  const ouvrirDialogue = useCallback(() => {
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
      const { instanceId } = await creer(nom, date)
      setOuvert(false)
      ouvrir(instanceId)
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
  }, [ouvrir, creer, date, nom])

  return { ouvert, nom, setNom, proposition: nomParDefautSeanceDirecte(date), erreur, enCours, ouvrir: ouvrirDialogue, fermer, confirmer }
}
