import { normalizeSearch } from '../common/normalizeSearch'
import { z } from 'zod'
import { MUSCLE_GROUPS } from '../db/types'
import donnees from './catalogueDeBase.json'

// Catalogue de base d'Android (MuscuCatalog, 166 exercices) avec les groupes musculaires corrigés
// (codes MuscleGroup, jamais de texte anatomique). Même mapping que l'import : category et
// exercise_type recopiés tels quels (types Android « Pluri » / « Mono »), equipment et muscle_groups
// stockés en JSON d'un tableau de chaînes.

const groupe = z.enum(MUSCLE_GROUPS)

export const CATEGORIES_DE_BASE = [
  'CHEST', 'BACK', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'LEGS', 'GLUTES', 'CORE', 'CARDIO', 'FULL_BODY', 'OTHER',
] as const

export const ExerciceDeBaseSchema = z
  .object({
    name: z.string().min(1),
    category: z.enum(CATEGORIES_DE_BASE),
    musclePrimary: groupe,
    /** Principal en tête, puis les secondaires. */
    muscleGroups: z.array(groupe).min(1),
    description: z.string(),
    equipment: z.array(z.string()),
    exerciseType: z.enum(['Pluri', 'Mono']),
    isBodyweight: z.boolean(),
  })
  .refine((e) => e.muscleGroups[0] === e.musclePrimary, {
    message: 'Le muscle principal doit être le premier des groupes musculaires.',
    path: ['musclePrimary'],
  })

export type ExerciceDeBase = z.infer<typeof ExerciceDeBaseSchema>

let cache: ExerciceDeBase[] | undefined

/** Les exercices du catalogue de base, validés une fois (erreur Zod si le fichier est corrompu). */
export function catalogueDeBase(): ExerciceDeBase[] {
  cache ??= z.array(ExerciceDeBaseSchema).parse(donnees)
  return cache
}

/** Catalogue de base indexé par nom normalisé. */
export function baseParNom(): Map<string, ExerciceDeBase> {
  return new Map(catalogueDeBase().map((e) => [normalizeSearch(e.name), e]))
}
