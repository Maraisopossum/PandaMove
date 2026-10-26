import { useEffect, useState } from 'react'
import { getDb } from '../../../core/db/client'
import { historiqueExercice } from '../../stats/statsQueries'
import { texteHistorique } from './lignesSeries'

const NB_LIGNES = 5

// Historique de l'exercice du catalogue (séances terminées, les plus récentes d'abord), relu quand on change
// d'exercice. Un échec de lecture donne simplement une section absente (information secondaire).
export function useHistoriqueExercice(exerciseId: string | null): string[] {
  const [etat, setEtat] = useState<{ pour: string | null; lignes: string[] }>({ pour: null, lignes: [] })

  useEffect(() => {
    if (exerciseId === null) return
    let annule = false
    historiqueExercice(getDb(), exerciseId)
      .then((points) => {
        if (!annule) setEtat({ pour: exerciseId, lignes: points.slice(-NB_LIGNES).reverse().map(texteHistorique) })
      })
      .catch((e: unknown) => console.error("Lecture de l'historique de l'exercice impossible", e))
    return () => {
      annule = true
    }
  }, [exerciseId])

  return etat.pour === exerciseId ? etat.lignes : []
}
