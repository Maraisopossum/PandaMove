import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDb } from '../../../core/db/client'
import type { Db } from '../../../core/db/Db'
import {
  creerExercice, listExercises, modifierExercice, setFavori, type NewExercise,
} from '../../../core/db/repos/exercises'
import { softDelete } from '../../../core/db/repos/seances'
import type { Exercise } from '../../../core/db/types'
import { FILTRE_INITIAL, filtrerExercices, type FiltreCatalogue } from './filtreCatalogue'

export type { NewExercise } from '../../../core/db/repos/exercises'
export type { FiltreCatalogue } from './filtreCatalogue'

export interface DepsCatalogue {
  /** Base à utiliser (défaut : base de l'application, résolue à l'usage). */
  db?: Db
  userId?: string
}

// Catalogue d'exercices. La base n'expose pas de mécanisme d'observation : la liste est relue
// après chaque écriture (les écritures de ce hook sont les seules sources de changement locales).
export function useCatalog({ db, userId }: DepsCatalogue = {}) {
  const [tous, setTous] = useState<Exercise[]>([])
  const [charge, setCharge] = useState(false)
  const [filtre, setFiltre] = useState<FiltreCatalogue>(FILTRE_INITIAL)

  const recharger = useCallback(async () => {
    setTous(await listExercises(db ?? getDb()))
    setCharge(true)
  }, [db])

  useEffect(() => {
    let annule = false
    listExercises(db ?? getDb())
      .then((liste) => {
        if (annule) return
        setTous(liste)
        setCharge(true)
      })
      .catch((e: unknown) => console.error('Chargement du catalogue impossible', e))
    return () => {
      annule = true
    }
  }, [db])

  const exercices = useMemo(() => filtrerExercices(tous, filtre), [tous, filtre])

  const toggleFavori = useCallback(
    async (id: string) => {
      const courant = tous.find((e) => e.id === id)
      if (!courant) return
      await setFavori(db ?? getDb(), id, !courant.isFavorite)
      await recharger()
    },
    [db, tous, recharger],
  )

  const creerPersonnalise = useCallback(
    async (e: NewExercise) => {
      if (!userId) throw new Error('Utilisateur non connecté.')
      await creerExercice(db ?? getDb(), userId, e)
      await recharger()
    },
    [db, userId, recharger],
  )

  const modifier = useCallback(
    async (id: string, e: NewExercise) => {
      await modifierExercice(db ?? getDb(), id, e)
      await recharger()
    },
    [db, recharger],
  )

  const supprimer = useCallback(
    async (id: string) => {
      await softDelete(db ?? getDb(), 'exercises', id)
      await recharger()
    },
    [db, recharger],
  )

  return { exercices, charge, filtre, setFiltre, toggleFavori, creerPersonnalise, modifier, supprimer }
}
