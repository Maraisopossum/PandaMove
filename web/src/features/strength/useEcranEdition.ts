import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useSeanceEdit } from './useSeanceEdit'

// Orchestration de l'écran d'édition : séance (id de la route, absent = création), sélecteur
// d'exercices et retour à la liste après enregistrement.
export function useEcranEdition() {
  const { id } = useParams()
  const navigate = useNavigate()
  const edition = useSeanceEdit(id ?? null)
  const { ajouterExercice, setRecherche, enregistrer } = edition
  // Bloc pour lequel le sélecteur d'exercices est ouvert (null = fermé)
  const [blocSelecteur, setBlocSelecteur] = useState<string | null>(null)

  const ouvrirSelecteur = useCallback(
    (blocId: string) => {
      setRecherche('')
      setBlocSelecteur(blocId)
    },
    [setRecherche],
  )
  const fermerSelecteur = useCallback(() => setBlocSelecteur(null), [])

  const choisirExercice = useCallback(
    (exerciseId: string) => {
      if (blocSelecteur !== null) ajouterExercice(blocSelecteur, exerciseId)
      setBlocSelecteur(null)
    },
    [ajouterExercice, blocSelecteur],
  )

  const soumettre = useCallback(async () => {
    const idEnregistre = await enregistrer()
    if (idEnregistre !== null) await navigate('/strength')
  }, [enregistrer, navigate])

  return { ...edition, enCreation: id === undefined, blocSelecteur, ouvrirSelecteur, fermerSelecteur, choisirExercice, soumettre }
}
