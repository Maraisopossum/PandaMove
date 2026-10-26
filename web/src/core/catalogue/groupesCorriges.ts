import { MUSCLE_GROUPS, type MuscleGroup } from '../db/types'
import { muscleToGroup } from './muscleToGroup'

/** Groupes de l'exercice du catalogue de base de même nom normalisé. */
export interface EntreeBase {
  musclePrimary: string
  muscleGroups: readonly string[]
}

export interface GroupesExercice {
  musclePrimary: string
  muscleGroups: string[]
}

const estCode = (texte: string) => (MUSCLE_GROUPS as readonly string[]).includes(texte)

// Normalise en codes MuscleGroup, sans doublon, ordre conservé. Renvoie null si un élément ne se
// convertit qu'en AUTRE par défaut (texte inconnu) : la liste est alors laissée telle quelle.
function versCodes(groupes: string[]): MuscleGroup[] | null {
  const codes: MuscleGroup[] = []
  for (const g of groupes) {
    const code = muscleToGroup(g)
    if (code === 'AUTRE' && g.trim() !== 'AUTRE' && g.trim().toLowerCase() !== 'autre') return null
    if (!codes.includes(code)) codes.push(code)
  }
  return codes
}

/**
 * Groupes musculaires corrigés d'un exercice (fonction pure) :
 *  - exercice du catalogue de base (`base` fourni) : principal et groupes du catalogue ;
 *  - exercice personnalisé : muscle principal vide dérivé du premier groupe (muscleToGroup), jamais
 *    modifié s'il est renseigné ; groupes convertis en codes seulement si tous se convertissent
 *    sans passer par AUTRE, sinon laissés tels quels.
 */
export function groupesCorriges(exercice: GroupesExercice, base: EntreeBase | null): GroupesExercice {
  if (base) return { musclePrimary: base.musclePrimary, muscleGroups: [...base.muscleGroups] }
  const groupes = exercice.muscleGroups.filter((g) => g.trim() !== '')
  const normalises = groupes.length > 0 ? versCodes(groupes) : null
  const muscleGroups = normalises ?? exercice.muscleGroups
  let musclePrimary = exercice.musclePrimary
  if (musclePrimary.trim() === '' && groupes.length > 0) {
    const premier = groupes[0]
    musclePrimary = estCode(premier) ? premier : muscleToGroup(premier)
  }
  return { musclePrimary, muscleGroups }
}
