import { useCallback, useMemo, useState } from 'react'
import type { Exercise, MuscleGroup } from '../../../core/db/types'
import { basculerSelection, FILTRE_SELECTEUR_INITIAL, filtrerSelecteur, type FiltreSelecteur } from './selecteur'

interface Deps {
  catalogue: Exercise[]
  /** Catégories de matériel déclarées (« Mon matériel ») */
  categoriesPossedees: string[]
  /** Reçoit la cible (id de bloc, null = exercice libre) et les ids dans l'ordre de sélection */
  ajouter: (cible: string | null, exerciseIds: string[]) => void
}

// Sélecteur d'exercices à sélection multiple : recherche, groupe musculaire, « Mon matériel ». La sélection
// garde l'ordre des coches ; elle repart de zéro à chaque ouverture.
export function useSelecteurExercices({ catalogue, categoriesPossedees, ajouter }: Deps) {
  const [ouvert, setOuvert] = useState(false)
  const [cible, setCible] = useState<string | null>(null)
  const [filtre, setFiltre] = useState<FiltreSelecteur>(FILTRE_SELECTEUR_INITIAL)
  const [selection, setSelection] = useState<string[]>([])

  const ouvrir = useCallback((versCible: string | null) => {
    setCible(versCible)
    setFiltre(FILTRE_SELECTEUR_INITIAL)
    setSelection([])
    setOuvert(true)
  }, [])
  const fermer = useCallback(() => setOuvert(false), [])

  const setQuery = useCallback((query: string) => setFiltre((f) => ({ ...f, query })), [])
  const setGroupe = useCallback((groupe: MuscleGroup | null) => setFiltre((f) => ({ ...f, groupe })), [])
  const basculerDisponible = useCallback(() => setFiltre((f) => ({ ...f, seulementDisponible: !f.seulementDisponible })), [])
  const basculer = useCallback((id: string) => setSelection((s) => basculerSelection(s, id)), [])

  const confirmer = useCallback(() => {
    if (selection.length > 0) ajouter(cible, selection)
    setOuvert(false)
  }, [ajouter, cible, selection])

  const resultats = useMemo(() => filtrerSelecteur(catalogue, filtre, categoriesPossedees), [catalogue, filtre, categoriesPossedees])

  return { ouvert, cible, filtre, selection, resultats, ouvrir, fermer, setQuery, setGroupe, basculerDisponible, basculer, confirmer }
}
