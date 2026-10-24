// Types de domaine camelCase (les lignes SQL sont en snake_case, voir mappers dans repos/).
// Miroir de l'enum Kotlin MuscleGroup (16 valeurs, dont AVANT_BRAS et AUTRE).
export const MUSCLE_GROUPS = [
  'PECTORAUX', 'DOS', 'TRAPEZES', 'LOMBAIRES', 'EPAULES', 'BICEPS', 'TRICEPS', 'QUADRICEPS',
  'ISCHIO', 'FESSIERS', 'ADDUCTEURS', 'MOLLETS', 'ABDOMINAUX', 'OBLIQUES', 'AVANT_BRAS', 'AUTRE',
] as const
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

export type TypeExercice = 'COMPOSE_BAS' | 'COMPOSE_HAUT' | 'ISOLATION' | 'MACHINE' | 'PDC'
// DURATION : repsRealisees contient des secondes, pas des répétitions.
export type RepsType = 'REPS' | 'DURATION'
export type PandaVariant = 'male' | 'female'

export interface Seance {
  id: string
  nom: string
  groupesMusculaires: string
  dureeEstimeeMin: number
  notes: string
  seanceCategory: string
  createdAt: string
  isArchived: boolean
  updatedAt: string
}

export interface BlocSeance {
  id: string
  seanceId: string
  nom: string
  type: string
  position: number
  dureeMin: number | null
  description: string
  tempsReposInterSec: number
  tempsReposFinRoundSec: number
  instanceSeanceId: string | null
  blocSourceId: string | null
  updatedAt: string
}

export interface ExerciceSeance {
  id: string
  seanceId: string
  exerciseId: string
  blocId: string | null
  supersetGroupe: string | null
  position: number
  nombreSeriesPrevues: number
  repsCibles: string
  chargeCible: string
  tempo: string
  repsType: RepsType
  tempsReposSec: number
  consigneCle: string
  equipement: string
  avertissement: string
  instanceSeanceId: string | null
  exerciceSourceId: string | null
  isBilateral: boolean
  progressionActivee: boolean
  systemeProgression: string | null
  repsMin: number | null
  repsMax: number | null
  incrementKg: number | null
  incrementDureeSec: number
  seuilDeload: number
  typeExercice: TypeExercice | null
  incrementPct: number | null
  isBodyweight: boolean
  updatedAt: string
}

export interface InstanceSeance {
  id: string
  seanceId: string
  date: string
  notes: string
  isCompleted: boolean
  completedAt: string | null
  durationSeconds: number
  createdAt: string
  updatedAt: string
  // Démarrage de l'exécution (ISO) ; null = jamais démarrée
  startedAt: string | null
  // Pauses en JSON [{ fromMs, toMs | null }] (voir features/strength/execute/sessionClock.ts)
  pausedJson: string | null
}

export interface SerieRealisee {
  id: string
  instanceSeanceId: string
  exerciceSeanceId: string
  numeroSerie: number
  repsRealisees: number | null
  chargeKg: number | null
  chargeLabel: string | null
  rpe: number | null
  notes: string
  isCompleted: boolean
  updatedAt: string
}

export interface ObjectifProgression {
  id: string
  seanceId: string
  exerciseId: string
  chargeCible: number | null
  repsCible: number | null
  dureeCibleSec: number | null
  compteurEchec: number
  derniereMaj: string | null
  nombreSeriesCible: number | null
  updatedAt: string
}

export interface Exercise {
  id: string
  name: string
  category: string
  muscleGroups: string
  description: string
  isFavorite: boolean
  isCustom: boolean
  imageUrl: string | null
  exerciseType: string
  equipment: string
  musclePrimary: string
  isBodyweight: boolean
  updatedAt: string
}

export interface UserSettings {
  pandaVariant: PandaVariant
  // null = aucun choix explicite (suivre la préférence du système)
  darkMode: boolean | null
  // JSON sérialisé de l'inventaire matériel ; '{}' par défaut (aucun matériel déclaré)
  equipmentJson: string
}
