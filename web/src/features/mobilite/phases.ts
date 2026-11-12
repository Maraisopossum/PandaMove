import { TRANSITION_S, type Etape, type PlanSeance } from './generer'

// Découpage d'une séance en phases chronométrées : une préparation, puis pour chaque exercice ses côtés (gauche, droite) et
// une transition vers le suivant. Fonction pure, sans horloge : le chronomètre est dans useSeanceMobilite.

export const PREPARATION_S = 5

export type TypePhase = 'preparation' | 'exercice' | 'transition'

export interface PhaseSeance {
  type: TypePhase
  dureeS: number
  /** Indice de l'étape de la séance concernée (pour la préparation et les transitions : l'exercice à venir). */
  etape: number
  cote: 'gauche' | 'droite' | null
}

export function decouperEnPhases(plan: Pick<PlanSeance, 'etapes'>): PhaseSeance[] {
  const phases: PhaseSeance[] = [{ type: 'preparation', dureeS: PREPARATION_S, etape: 0, cote: null }]
  plan.etapes.forEach((e: Etape, i: number) => {
    if (e.exercice.cote) {
      phases.push({ type: 'exercice', dureeS: e.dureeS, etape: i, cote: 'gauche' }, { type: 'exercice', dureeS: e.dureeS, etape: i, cote: 'droite' })
    } else phases.push({ type: 'exercice', dureeS: e.dureeS, etape: i, cote: null })
    // Pas de transition après le dernier exercice
    if (i < plan.etapes.length - 1) phases.push({ type: 'transition', dureeS: TRANSITION_S, etape: i + 1, cote: null })
  })
  return phases
}

export const dureePhases = (phases: PhaseSeance[]): number => phases.reduce((t, p) => t + p.dureeS, 0)
