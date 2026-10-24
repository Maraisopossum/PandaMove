import { normalizeSearch } from '../../../core/common/normalizeSearch'
import type { Exercise, MuscleGroup } from '../../../core/db/types'

export interface FiltreCatalogue {
  query: string
  muscle: MuscleGroup | null
  favorisSeulement: boolean
}

export const FILTRE_INITIAL: FiltreCatalogue = { query: '', muscle: null, favorisSeulement: false }

// muscle_groups est stocké en JSON d'un tableau de chaînes ; toute autre forme donne une liste vide.
export function lireGroupes(texte: string): string[] {
  try {
    const v: unknown = JSON.parse(texte)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

// Filtre puis trie par nom normalisé (accents et casse ignorés), comme la recherche Android.
export function filtrerExercices(liste: Exercise[], filtre: FiltreCatalogue): Exercise[] {
  const requete = normalizeSearch(filtre.query)
  return liste
    .filter((e) => !filtre.favorisSeulement || e.isFavorite)
    .filter((e) => !requete || normalizeSearch(e.name).includes(requete))
    .filter((e) => !filtre.muscle || e.musclePrimary === filtre.muscle || lireGroupes(e.muscleGroups).includes(filtre.muscle))
    .map((e) => ({ e, cle: normalizeSearch(e.name) }))
    .sort((a, b) => (a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0))
    .map(({ e }) => e)
}
