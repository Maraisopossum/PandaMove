import type { Sport } from '../../core/db/repos/sorties'

// Chemin du module de chaque sport (course : /running, vélo : /cycling).
export const CHEMIN_SPORT: Record<Sport, string> = { course: '/running', velo: '/cycling' }
