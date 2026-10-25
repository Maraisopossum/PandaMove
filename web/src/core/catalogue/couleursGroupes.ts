import { composer } from '../../app/contraste'
import type { MuscleGroup } from '../db/types'

// Couleur de chaque groupe musculaire (Android : MuscleGroup.colorArgb, MuscleGroup.kt). Elle ne sert que de REPÈRE visuel
// (liseré, teinte de fond de la puce choisie) : le nom du groupe reste toujours écrit, et le texte garde la couleur du
// thème, car plusieurs de ces teintes (jaune des quadriceps…) n'atteignent pas 4,5:1 comme texte.
export const COULEURS_GROUPE: Record<MuscleGroup, string> = {
  PECTORAUX: '#e57373',
  DOS: '#4db6ac',
  TRAPEZES: '#5c6bc0',
  LOMBAIRES: '#8d6e63',
  EPAULES: '#64b5f6',
  BICEPS: '#9575cd',
  TRICEPS: '#ffb74d',
  QUADRICEPS: '#ffd54f',
  ISCHIO: '#ff8a65',
  FESSIERS: '#f06292',
  ADDUCTEURS: '#ec407a',
  MOLLETS: '#81c784',
  ABDOMINAUX: '#aed581',
  OBLIQUES: '#26a69a',
  AVANT_BRAS: '#a1887f',
  AUTRE: '#90a4ae',
}

/** Teinte `couleur` posée à `alpha` sur `surface` (hex opaque) : fond d'une puce choisie, pour le calcul de contraste. */
export function melangerSurSurface(couleur: string, surface: string, alpha: number): string {
  return composer({ couleur, alpha }, surface)
}
