import type { Phase } from './phases'

// Fond de chaque phase dans la frise (aplats seulement, jamais du texte) : teintes distinctes même sans la légende.
export const COULEUR_PHASE: Record<Phase, string> = {
  base: '#6b7280', developpement: '#B45309', allegee: '#7fb77f', affutage: '#0277BD', reprise: '#4f9a6f', specifique: '#5B3D9E', pic: '#8B2F2F',
}
