import { MUSCLE_GROUPS } from '../../../core/db/types'

export { MUSCLE_GROUPS }

// Groupes dont le libellé n'est pas la simple mise en forme du code
const SPECIAUX: Record<string, string> = { AVANT_BRAS: 'Avant-bras', AUTRE: 'Autre' }

// « PECTORAUX » -> « Pectoraux »
export function libelleMuscle(code: string): string {
  if (SPECIAUX[code]) return SPECIAUX[code]
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
