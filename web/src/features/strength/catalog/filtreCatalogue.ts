import { LIBELLES_GROUPE, muscleToGroup } from '../../../core/catalogue/muscleToGroup'
import { normalizeSearch } from '../../../core/common/normalizeSearch'
import type { Exercise, MuscleGroup } from '../../../core/db/types'

export interface FiltreCatalogue {
  query: string
  muscle: MuscleGroup | null
  favorisSeulement: boolean
}

export const FILTRE_INITIAL: FiltreCatalogue = { query: '', muscle: null, favorisSeulement: false }

// muscle_groups est stocké en JSON d'un tableau de chaînes ; toute autre forme donne une liste vide.
export function lireGroupes(texte: string | null | undefined): string[] {
  try {
    const v: unknown = JSON.parse(texte ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

// Muscle principal ou secondaire rangé dans le groupe : codes, libellés et noms anatomiques du catalogue
// Android (« Grand dorsal ») passent par muscleToGroup. Un texte vide n'est jamais rangé dans « Autre ».
function correspondAuMuscle(e: Exercise, groupe: MuscleGroup): boolean {
  return [e.musclePrimary, ...lireGroupes(e.muscleGroups)]
    .filter((m) => m.trim() !== '')
    .some((m) => muscleToGroup(m) === groupe)
}

// Filtre puis trie par nom normalisé (accents et casse ignorés), comme la recherche Android.
export function filtrerExercices(liste: Exercise[], filtre: FiltreCatalogue): Exercise[] {
  const requete = normalizeSearch(filtre.query)
  return liste
    .filter((e) => !filtre.favorisSeulement || e.isFavorite)
    .filter((e) => !requete || normalizeSearch(e.name).includes(requete))
    .filter((e) => !filtre.muscle || correspondAuMuscle(e, filtre.muscle))
    .map((e) => ({ e, cle: normalizeSearch(e.name) }))
    .sort((a, b) => (a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0))
    .map(({ e }) => e)
}

export interface MusclesAffiches {
  /** Libellé français du muscle principal (même règle que les stats : premier groupe, sinon muscle_primary). */
  principal: string | null
  /** Libellés français des autres groupes sollicités. */
  secondaires: string[]
}

// Muscles d'un exercice pour l'affichage : codes, libellés ou noms anatomiques rangés par muscleToGroup.
export function musclesAffiches(e: Pick<Exercise, 'musclePrimary' | 'muscleGroups'>): MusclesAffiches {
  const groupes = lireGroupes(e.muscleGroups).filter((m) => m.trim() !== '')
  const tous = groupes.length > 0 ? groupes : e.musclePrimary.trim() !== '' ? [e.musclePrimary] : []
  const codes = tous.map(muscleToGroup).filter((g, i, liste) => liste.indexOf(g) === i)
  return {
    principal: codes.length > 0 ? LIBELLES_GROUPE[codes[0]] : null,
    secondaires: codes.slice(1).map((g) => LIBELLES_GROUPE[g]),
  }
}
