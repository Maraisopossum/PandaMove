import { useCallback, useState } from 'react'
import type { BlocDraft } from '../draft'

// Suppression d'un bloc : immédiate s'il est vide, sinon confirmation (il emporte ses exercices).
export function useSuppressionBloc(supprimer: (blocId: string) => void) {
  const [enAttente, setEnAttente] = useState<BlocDraft | null>(null)

  const demander = useCallback(
    (bloc: BlocDraft) => {
      if (bloc.exercices.length === 0) supprimer(bloc.id)
      else setEnAttente(bloc)
    },
    [supprimer],
  )
  const annuler = useCallback(() => setEnAttente(null), [])
  const confirmer = useCallback(() => {
    if (enAttente) supprimer(enAttente.id)
    setEnAttente(null)
  }, [enAttente, supprimer])

  return { enAttente, demander, annuler, confirmer }
}
