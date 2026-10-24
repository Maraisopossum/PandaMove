import type {
  BlocSeance, ExerciceSeance, Exercise, InstanceSeance, ObjectifProgression, Seance, SerieRealisee,
  RepsType, TypeExercice,
} from '../types'

// Une ligne SQL brute : snake_case, booléens en 0/1, valeurs nullables.
export type Ligne = Record<string, string | number | null>

const s = (l: Ligne, k: string) => l[k] as string
const sn = (l: Ligne, k: string) => (l[k] ?? null) as string | null
const n = (l: Ligne, k: string) => l[k] as number
const nn = (l: Ligne, k: string) => (l[k] ?? null) as number | null
const b = (l: Ligne, k: string) => l[k] === 1

export const mapSeance = (l: Ligne): Seance => ({
  id: s(l, 'id'),
  nom: s(l, 'nom'),
  groupesMusculaires: s(l, 'groupes_musculaires'),
  dureeEstimeeMin: n(l, 'duree_estimee_min'),
  notes: s(l, 'notes'),
  seanceCategory: s(l, 'seance_category'),
  createdAt: s(l, 'created_at'),
  isArchived: b(l, 'is_archived'),
  updatedAt: s(l, 'updated_at'),
})

export const mapBloc = (l: Ligne): BlocSeance => ({
  id: s(l, 'id'),
  seanceId: s(l, 'seance_id'),
  nom: s(l, 'nom'),
  type: s(l, 'type'),
  position: n(l, 'position'),
  dureeMin: nn(l, 'duree_min'),
  description: s(l, 'description'),
  tempsReposInterSec: n(l, 'temps_repos_inter_sec'),
  tempsReposFinRoundSec: n(l, 'temps_repos_fin_round_sec'),
  instanceSeanceId: sn(l, 'instance_seance_id'),
  blocSourceId: sn(l, 'bloc_source_id'),
  updatedAt: s(l, 'updated_at'),
})

export const mapExerciceSeance = (l: Ligne): ExerciceSeance => ({
  id: s(l, 'id'),
  seanceId: s(l, 'seance_id'),
  exerciseId: s(l, 'exercise_id'),
  blocId: sn(l, 'bloc_id'),
  supersetGroupe: sn(l, 'superset_groupe'),
  position: n(l, 'position'),
  nombreSeriesPrevues: n(l, 'nombre_series_prevues'),
  repsCibles: s(l, 'reps_cibles'),
  chargeCible: s(l, 'charge_cible'),
  tempo: s(l, 'tempo'),
  repsType: s(l, 'reps_type') as RepsType,
  tempsReposSec: n(l, 'temps_repos_sec'),
  consigneCle: s(l, 'consigne_cle'),
  equipement: s(l, 'equipement'),
  avertissement: s(l, 'avertissement'),
  instanceSeanceId: sn(l, 'instance_seance_id'),
  exerciceSourceId: sn(l, 'exercice_source_id'),
  isBilateral: b(l, 'is_bilateral'),
  progressionActivee: b(l, 'progression_activee'),
  systemeProgression: sn(l, 'systeme_progression'),
  repsMin: nn(l, 'reps_min'),
  repsMax: nn(l, 'reps_max'),
  incrementKg: nn(l, 'increment_kg'),
  incrementDureeSec: n(l, 'increment_duree_sec'),
  seuilDeload: n(l, 'seuil_deload'),
  typeExercice: sn(l, 'type_exercice') as TypeExercice | null,
  incrementPct: nn(l, 'increment_pct'),
  isBodyweight: b(l, 'is_bodyweight'),
  updatedAt: s(l, 'updated_at'),
})

export const mapInstance = (l: Ligne): InstanceSeance => ({
  id: s(l, 'id'),
  seanceId: s(l, 'seance_id'),
  date: s(l, 'date'),
  notes: s(l, 'notes'),
  isCompleted: b(l, 'is_completed'),
  completedAt: sn(l, 'completed_at'),
  durationSeconds: n(l, 'duration_seconds'),
  createdAt: s(l, 'created_at'),
  updatedAt: s(l, 'updated_at'),
})

export const mapSerie = (l: Ligne): SerieRealisee => ({
  id: s(l, 'id'),
  instanceSeanceId: s(l, 'instance_seance_id'),
  exerciceSeanceId: s(l, 'exercice_seance_id'),
  numeroSerie: n(l, 'numero_serie'),
  repsRealisees: nn(l, 'reps_realisees'),
  chargeKg: nn(l, 'charge_kg'),
  chargeLabel: sn(l, 'charge_label'),
  rpe: nn(l, 'rpe'),
  notes: s(l, 'notes'),
  isCompleted: b(l, 'is_completed'),
  updatedAt: s(l, 'updated_at'),
})

export const mapObjectif = (l: Ligne): ObjectifProgression => ({
  id: s(l, 'id'),
  seanceId: s(l, 'seance_id'),
  exerciseId: s(l, 'exercise_id'),
  chargeCible: nn(l, 'charge_cible'),
  repsCible: nn(l, 'reps_cible'),
  dureeCibleSec: nn(l, 'duree_cible_sec'),
  compteurEchec: n(l, 'compteur_echec'),
  derniereMaj: sn(l, 'derniere_maj'),
  nombreSeriesCible: nn(l, 'nombre_series_cible'),
  updatedAt: s(l, 'updated_at'),
})

export const mapExercise = (l: Ligne): Exercise => ({
  id: s(l, 'id'),
  name: s(l, 'name'),
  category: s(l, 'category'),
  muscleGroups: s(l, 'muscle_groups'),
  description: s(l, 'description'),
  isFavorite: b(l, 'is_favorite'),
  isCustom: b(l, 'is_custom'),
  imageUrl: sn(l, 'image_url'),
  exerciseType: s(l, 'exercise_type'),
  equipment: s(l, 'equipment'),
  musclePrimary: s(l, 'muscle_primary'),
  isBodyweight: b(l, 'is_bodyweight'),
  updatedAt: s(l, 'updated_at'),
})
