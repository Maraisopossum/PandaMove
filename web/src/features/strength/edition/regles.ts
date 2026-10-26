import type { TypeBloc } from '../draft'

// Règles d'affichage de l'écran d'édition, tirées de SeanceCreateScreen.kt (BlocCard, ExerciceCard).
// Pures : les composants ne décident de rien, ils lisent ces tables.

export interface ReglesBloc {
  /** Repos entre exercices et en fin de tour (Superset, Circuit) */
  reposBloc: boolean
  /** Nombre de séries commun à tout le bloc (Circuit) */
  seriesCommunes: boolean
}

export function reglesBloc(type: TypeBloc): ReglesBloc {
  return { reposBloc: type === 'SUPERSET' || type === 'CIRCUIT', seriesCommunes: type === 'CIRCUIT' }
}

export interface ReglesExercice {
  series: boolean
  /** Repos entre les séries de l'exercice (sinon géré par le bloc) */
  repos: boolean
  /** Circuit : toujours en durée */
  typeRepsVerrouille: boolean
  bilateral: boolean
  /** Surcharge progressive possible (bible §0.3 : pas en échauffement ni activation) */
  progression: boolean
}

/** `typeBloc` null : exercice libre. */
export function reglesExercice(typeBloc: TypeBloc | null): ReglesExercice {
  const circuit = typeBloc === 'CIRCUIT'
  return {
    series: !circuit,
    repos: typeBloc === null || typeBloc === 'ECHAUFFEMENT' || typeBloc === 'ACTIVATION' || typeBloc === 'RECUPERATION',
    typeRepsVerrouille: circuit,
    bilateral: !circuit,
    progression: typeBloc !== 'ECHAUFFEMENT' && typeBloc !== 'ACTIVATION',
  }
}

// Icônes Android (Whatshot, SelfImprovement, Bolt, FitnessCenter, SelfImprovement), en pictogrammes.
export const ICONES_BLOC: Record<TypeBloc, string> = {
  ECHAUFFEMENT: '🔥',
  ACTIVATION: '🧘',
  SUPERSET: '⚡',
  CIRCUIT: '🏋️',
  RECUPERATION: '🌿',
}

// Une phrase par type, affichée sous le choix du type pour décider sans deviner
export const DESCRIPTIONS_BLOC: Record<TypeBloc, string> = {
  ECHAUFFEMENT: 'Préparer le corps avant la séance principale, exercice par exercice.',
  ACTIVATION: 'Réveiller les muscles ciblés avant les charges lourdes (sans surcharge progressive).',
  SUPERSET: 'Deux exercices ou plus enchaînés ; le repos se prend seulement après le tour.',
  CIRCUIT: 'Exercices en durée enchaînés, répétés sur plusieurs tours communs.',
  RECUPERATION: 'Retour au calme : étirements, mobilité, respiration.',
}

// Pas des compteurs, en secondes (IntStepperField / NumberStepper Android)
export const textesPas = { reposInter: 5, reposFinTour: 15, reposExercice: 15 } as const
