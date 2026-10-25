import type { Exercise, MuscleGroup } from '../../../core/db/types'
import { rawEquipmentToCategory } from '../../../core/progression/inventory'
import { filtrerExercices, FILTRE_INITIAL } from '../catalog/filtreCatalogue'
import { lireListeEquipement } from '../progression/cible'

// Sélecteur d'exercices de l'écran d'édition (ExercicePickerSheet) : filtres et sélection multiple.

export interface FiltreSelecteur {
  query: string
  groupe: MuscleGroup | null
  /** « Mon matériel » : seulement les exercices réalisables avec le matériel déclaré */
  seulementDisponible: boolean
}

export const FILTRE_SELECTEUR_INITIAL: FiltreSelecteur = { query: '', groupe: null, seulementDisponible: false }

/**
 * Réalisable avec le matériel déclaré (filteredPickerExercises Android) : aucun équipement requis, poids de
 * corps seul, ou toutes les catégories requises possédées. `equipmentJson` : colonne `equipment` du catalogue.
 */
export function exerciceDisponible(equipmentJson: string, categoriesPossedees: string[]): boolean {
  const requises = new Set(
    lireListeEquipement(equipmentJson).flatMap((raw) => {
      const categorie = rawEquipmentToCategory(raw)
      return categorie ? [categorie] : []
    }),
  )
  if (requises.size === 0) return true
  if (requises.size === 1 && requises.has('POIDS_DE_CORPS')) return true
  return [...requises].every((c) => categoriesPossedees.includes(c))
}

export function filtrerSelecteur(liste: Exercise[], filtre: FiltreSelecteur, categoriesPossedees: string[]): Exercise[] {
  return filtrerExercices(liste, { ...FILTRE_INITIAL, query: filtre.query, muscle: filtre.groupe }).filter(
    (e) => !filtre.seulementDisponible || exerciceDisponible(e.equipment, categoriesPossedees),
  )
}

/**
 * Coche / décoche : les exercices restent dans l'ORDRE DE SÉLECTION (jamais trié par nom, piège connu :
 * l'ordre alphabétique place « Élévations » après « Face pull »).
 */
export function basculerSelection(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
}
