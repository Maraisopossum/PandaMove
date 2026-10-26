import { useCallback, useRef, useState } from 'react'
import { NOM_INSTANCE_MAX } from '../../../core/db/repos/instances'

// Dialogue « Modifier le nom » du menu de l'exécution : renomme la séance jouée (jamais le modèle). `renommer` vient de
// useExecute. Le dialogue reste ouvert avec un message français si le nom est refusé ou si l'écriture échoue.
export function useRenommageSeance(nomActuel: string, renommer: (nom: string) => Promise<boolean>) {
  const [ouvert, setOuvert] = useState(false)
  const [texte, setTexte] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const verrou = useRef(false)

  const ouvrir = useCallback(() => {
    setTexte(nomActuel)
    setErreur(null)
    setOuvert(true)
  }, [nomActuel])

  const fermer = useCallback(() => {
    if (!verrou.current) setOuvert(false)
  }, [])

  const valider = useCallback(async () => {
    if (verrou.current) return
    if (texte.trim().length > NOM_INSTANCE_MAX) {
      setErreur(`Le nom de la séance est limité à ${NOM_INSTANCE_MAX} caractères.`)
      return
    }
    verrou.current = true
    setEnCours(true)
    setErreur(null)
    try {
      if (await renommer(texte)) setOuvert(false)
      else setErreur('Le renommage a échoué. Réessayez.')
    } finally {
      verrou.current = false
      setEnCours(false)
    }
  }, [renommer, texte])

  return { ouvert, texte, setTexte, erreur, enCours, ouvrir, fermer, valider }
}
