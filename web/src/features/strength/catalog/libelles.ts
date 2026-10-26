import { LIBELLES_GROUPE } from '../../../core/catalogue/muscleToGroup'
import { MUSCLE_GROUPS, type MuscleGroup } from '../../../core/db/types'

export { MUSCLE_GROUPS }

// « EPAULES » -> « Épaules » (libellés français de muscleToGroup) ; un texte libre est seulement mis en forme.
export function libelleMuscle(code: string): string {
  if ((MUSCLE_GROUPS as readonly string[]).includes(code)) return LIBELLES_GROUPE[code as MuscleGroup]
  const minuscules = code.toLowerCase().replace(/_/g, ' ')
  return minuscules.charAt(0).toUpperCase() + minuscules.slice(1)
}

export const CATEGORIES_EXERCICE: { id: string; libelle: string }[] = [
  { id: 'CHEST', libelle: 'Pectoraux' },
  { id: 'BACK', libelle: 'Dos' },
  { id: 'SHOULDERS', libelle: 'Épaules' },
  { id: 'BICEPS', libelle: 'Biceps' },
  { id: 'TRICEPS', libelle: 'Triceps' },
  { id: 'LEGS', libelle: 'Jambes' },
  { id: 'GLUTES', libelle: 'Fessiers' },
  { id: 'CORE', libelle: 'Abdominaux / gainage' },
  { id: 'CARDIO', libelle: 'Cardio' },
  { id: 'FULL_BODY', libelle: 'Corps entier' },
  { id: 'OTHER', libelle: 'Autre' },
]
