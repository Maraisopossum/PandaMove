import type { z } from 'zod'
import type {
  BlocDtoSchema,
  CustomExerciseDtoSchema,
  EquipmentConfigDtoSchema,
  ExerciceDtoSchema,
  InstanceDtoSchema,
  ObjectifProgressionDtoSchema,
  SeanceDtoSchema,
  SerieDtoSchema,
} from '../import/schema'

// Types de l'export web : chaque DTO est la forme lue par l'import (schéma Zod v3.x, miroir de
// ExportDtos.kt) PLUS des champs additionnels propres au web. Ces champs sont tolérés partout :
// le schéma Zod de l'import les écarte (objets non stricts) et l'import Android les ignore
// (ignoreUnknownKeys). Ils gardent dans la sauvegarde ce que le format Android ne sait pas porter.

/** Champs communs : l'UUID d'origine de la ligne (l'id du format est un Long dérivé, voir ids.ts). */
interface AvecUuid {
  uuid: string
}

export type SeanceExport = z.input<typeof SeanceDtoSchema> & AvecUuid & {
  isArchived: boolean
  /** Non nul pour une séance supprimée dont l'historique (séances jouées) est gardé. */
  deletedAt: string | null
}
export type BlocExport = z.input<typeof BlocDtoSchema> & AvecUuid
/** `notes` (migration 0007) : note de l'utilisateur sur la ligne d'instance, absente si vide. */
export type ExerciceExport = z.input<typeof ExerciceDtoSchema> & AvecUuid
export type InstanceExport = z.input<typeof InstanceDtoSchema> & AvecUuid & {
  /** Horloge de séance (migration 0004), valeurs brutes de la base. */
  startedAt: string | null
  pausedJson: string | null
  /** Marqueur de progression (migration 0005) : évaluation faite et décisions Oui / Non / Ajuster. */
  progressionJson: string | null
  /** Nom propre de la séance jouée (migration 0007), absent si elle porte le nom de son modèle. */
  nom?: string | null
}
export type SerieExport = z.input<typeof SerieDtoSchema> & AvecUuid & {
  /** Instant de validation (migration 0006), ancre du repos. */
  validatedAt: string | null
  updatedAt: string | null
}
export type CustomExerciseExport = z.input<typeof CustomExerciseDtoSchema> & AvecUuid & {
  isFavorite: boolean
  isBodyweight: boolean
  /** Non nul pour un exercice supprimé encore référencé par une séance exportée. */
  deletedAt: string | null
}
export type ObjectifExport = z.input<typeof ObjectifProgressionDtoSchema> & AvecUuid & {
  nombreSeriesCible: number | null
}
export type EquipmentConfigExport = z.input<typeof EquipmentConfigDtoSchema>

export interface StrengthTemplateExport {
  seance: SeanceExport
  blocs: BlocExport[]
  exercices: ExerciceExport[]
}

export interface StrengthSessionExport {
  instance: InstanceExport
  series: SerieExport[]
  blocs: BlocExport[]
  exercices: ExerciceExport[]
}

interface SessionsVides {
  completed: never[]
  planned: never[]
}

/** Export complet « PandaMoveExport » v3.2 produit par le web (renforcement seulement en phase 1). */
export interface PandaMoveExport {
  version: '3.2'
  exportDate: string
  /** Compte qui a produit le fichier : l'import ne reprend les `uuid` comme ids que pour ce compte. */
  webUserId?: string
  strengthTemplates: StrengthTemplateExport[]
  strengthSessions: { completed: StrengthSessionExport[]; planned: StrengthSessionExport[] }
  runTemplates: never[]
  runSessions: SessionsVides
  cyclingTemplates: never[]
  cyclingSessions: SessionsVides
  hikingTemplates: never[]
  hikingSessions: SessionsVides
  breathingSessions: never[]
  customExercises: CustomExerciseExport[]
  objectifsProgression: ObjectifExport[]
  equipmentConfig: EquipmentConfigExport | null
}
