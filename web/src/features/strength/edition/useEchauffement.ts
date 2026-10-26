import { useCallback, useState } from 'react'
import { getDb } from '../../../core/db/client'
import type { Db } from '../../../core/db/Db'
import { newId } from '../../../core/db/ids'
import type { Exercise } from '../../../core/db/types'
import type { BlocDraft } from '../draft'
import { construireBlocEchauffement, listerEchauffements, type ModeleEchauffement } from './echauffement'

interface Deps {
  db?: Db
  catalogue: Exercise[]
  inserer: (bloc: BlocDraft) => void
}

// « Ajouter un échauffement » : liste des modèles d'échauffement, puis recopie du choisi en tête de séance.
export function useEchauffement({ db, catalogue, inserer }: Deps) {
  const [ouvert, setOuvert] = useState(false)
  const [modeles, setModeles] = useState<ModeleEchauffement[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const ouvrir = useCallback(() => {
    setOuvert(true)
    setModeles(null)
    setErreur(null)
    listerEchauffements(db ?? getDb())
      .then(setModeles)
      .catch((e: unknown) => {
        console.error('Chargement des échauffements impossible', e)
        setModeles([])
        setErreur('Les échauffements n’ont pas pu être chargés.')
      })
  }, [db])
  const fermer = useCallback(() => setOuvert(false), [])

  const choisir = useCallback(
    async (modeleId: string) => {
      try {
        const bloc = await construireBlocEchauffement(db ?? getDb(), modeleId, catalogue, newId)
        if (!bloc) {
          setErreur('Cet échauffement n’existe plus.')
          return
        }
        inserer(bloc)
        setOuvert(false)
      } catch (e) {
        console.error("Ajout de l'échauffement impossible", e)
        setErreur('L’échauffement n’a pas pu être ajouté.')
      }
    },
    [catalogue, db, inserer],
  )

  return { ouvert, modeles, erreur, ouvrir, fermer, choisir }
}
