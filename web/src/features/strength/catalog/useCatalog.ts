import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  catalogueDeBaseInstalle, corrigerGroupesMusculaires, installerCatalogueDeBase, messageCorrection, messageInstallation,
} from '../../../core/catalogue/installerCatalogue'
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

// Résultat de la dernière action de maintenance (installation, correction), annoncé à l'utilisateur.
export interface OperationCatalogue {
  enCours: boolean
  message: string | null
  erreur: string | null
}

const OPERATION_INITIALE: OperationCatalogue = { enCours: false, message: null, erreur: null }

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
  const [baseInstallee, setBaseInstallee] = useState<boolean | null>(null)
  const [operation, setOperation] = useState<OperationCatalogue>(OPERATION_INITIALE)

  const recharger = useCallback(async () => {
    const base = db ?? getDb()
    setTous(await listExercises(base))
    setBaseInstallee(await catalogueDeBaseInstalle(base))
    setCharge(true)
  }, [db])

  useEffect(() => {
    let annule = false
    const base = db ?? getDb()
    Promise.all([listExercises(base), catalogueDeBaseInstalle(base)])
      .then(([liste, installee]) => {
        if (annule) return
        setTous(liste)
        setBaseInstallee(installee)
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

  // Une action de maintenance à la fois : pas de seconde exécution pendant la première
  const lancer = useCallback(
    async (action: () => Promise<string>, messageErreur: string) => {
      if (operation.enCours) return
      setOperation({ enCours: true, message: null, erreur: null })
      try {
        const message = await action()
        await recharger()
        setOperation({ enCours: false, message, erreur: null })
      } catch (e) {
        console.error(messageErreur, e)
        setOperation({ enCours: false, message: null, erreur: messageErreur })
      }
    },
    [operation.enCours, recharger],
  )

  const installerBase = useCallback(async () => {
    await lancer(async () => {
      if (!userId) throw new Error('Utilisateur non connecté.')
      return messageInstallation(await installerCatalogueDeBase(db ?? getDb(), userId))
    }, "L'ajout du catalogue de base a échoué. Réessayez.")
  }, [db, userId, lancer])

  const corrigerGroupes = useCallback(async () => {
    await lancer(async () => messageCorrection(await corrigerGroupesMusculaires(db ?? getDb())), 'La correction a échoué. Réessayez.')
  }, [db, lancer])

  return { exercices, charge, filtre, baseInstallee, operation, installerBase, corrigerGroupes, setFiltre, toggleFavori, creerPersonnalise, modifier, supprimer }
}
