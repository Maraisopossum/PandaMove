import { z } from 'zod'

// Schémas Zod du format d'export Android « PandaMoveExport » v3.x (miroir de ExportDtos.kt).
// Chaque `.default(...)` reprend la valeur par défaut Kotlin du DTO ; un champ Kotlin nullable
// est `.nullable()`, un champ non nullable refuse `null` (comme kotlinx.serialization sans
// coerceInputValues). Les clés inconnues sont ignorées (ignoreUnknownKeys = true côté Android).

/** Erreur d'import : message en français + chemin du champ fautif (ex. `strengthTemplates.0.seance.nom`). */
export class ImportError extends Error {
  readonly chemin: string

  constructor(message: string, chemin = '') {
    super(message)
    this.name = 'ImportError'
    this.chemin = chemin
  }
}

const entier = z.number().int()
const listeTextes = z.array(z.string()).default([])

// ── Renforcement ───────────────────────────────────────────────────────────────

export const SeanceDtoSchema = z.object({
  id: entier,
  nom: z.string(),
  groupesMusculaires: listeTextes,
  dureeEstimeeMin: entier.default(60),
  notes: z.string().default(''),
  seanceCategory: z.string().default('STRENGTH'),
  createdAt: z.string().default(''),
  updatedAt: z.string().default(''),
})

export const BlocDtoSchema = z.object({
  id: entier,
  seanceId: entier,
  nom: z.string(),
  type: z.string().default('ECHAUFFEMENT'),
  position: entier.default(0),
  dureeMin: entier.nullable().default(null),
  description: z.string().default(''),
  tempsReposInterSec: entier.default(20),
  tempsReposFinRoundSec: entier.default(120),
  instanceSeanceId: entier.nullable().default(null),
})

export const ExerciceDtoSchema = z.object({
  id: entier,
  seanceId: entier,
  exerciceId: entier,
  exerciceName: z.string().default(''),
  instanceSeanceId: entier.nullable().default(null),
  blocId: entier.nullable().default(null),
  supersetGroupe: z.string().nullable().default(null),
  position: entier.default(0),
  nombreSeriesPrevues: entier.default(3),
  repsCibles: z.string().default(''),
  chargeCible: z.string().default(''),
  tempo: z.string().default(''),
  repsType: z.string().default('REPS'),
  tempsReposSec: entier.default(90),
  consigneCle: z.string().default(''),
  equipement: z.string().default(''),
  avertissement: z.string().default(''),
  isBilateral: z.boolean().default(false),
  // Surcharge progressive (ajoutés v3.2)
  progressionActivee: z.boolean().default(false),
  systemeProgression: z.string().nullable().default(null),
  repsMin: entier.nullable().default(null),
  repsMax: entier.nullable().default(null),
  incrementKg: z.number().nullable().default(null),
  incrementDureeSec: entier.default(5),
  seuilDeload: entier.default(3),
  typeExercice: z.string().nullable().default(null),
  incrementPct: z.number().nullable().default(null),
  // Poids de corps (ajouté v3.3)
  isBodyweight: z.boolean().default(false),
})

export const InstanceDtoSchema = z.object({
  id: entier,
  seanceId: entier,
  date: z.string(),
  notes: z.string().default(''),
  isCompleted: z.boolean().default(false),
  completedAt: z.string().nullable().default(null),
  durationSeconds: entier.default(0),
  createdAt: z.string().default(''),
})

export const SerieDtoSchema = z.object({
  id: entier,
  instanceSeanceId: entier,
  exerciceSeanceId: entier,
  numeroSerie: entier,
  repsRealisees: entier.nullable().default(null),
  chargeKg: z.number().nullable().default(null),
  chargeLabel: z.string().nullable().default(null),
  rpe: z.number().nullable().default(null),
  notes: z.string().default(''),
  isCompleted: z.boolean().default(false),
})

export const StrengthTemplateDtoSchema = z.object({
  seance: SeanceDtoSchema,
  blocs: z.array(BlocDtoSchema).default([]),
  exercices: z.array(ExerciceDtoSchema).default([]),
})

export const StrengthSessionDtoSchema = z.object({
  instance: InstanceDtoSchema,
  series: z.array(SerieDtoSchema).default([]),
  blocs: z.array(BlocDtoSchema).default([]),
  exercices: z.array(ExerciceDtoSchema).default([]),
})

export const StrengthSessionsDtoSchema = z.object({
  completed: z.array(StrengthSessionDtoSchema).default([]),
  planned: z.array(StrengthSessionDtoSchema).default([]),
})

// ── Exercices personnalisés / catalogue ─────────────────────────────────────────

export const CustomExerciseDtoSchema = z.object({
  id: entier,
  name: z.string(),
  description: z.string().default(''),
  category: z.string().default(''),
  muscleGroups: listeTextes,
  exerciseType: z.string().default(''),
  equipment: listeTextes,
  musclePrimary: z.string().default(''),
})

export const ObjectifProgressionDtoSchema = z.object({
  id: entier,
  seanceId: entier,
  exerciceId: entier,
  exerciceName: z.string().default(''),
  chargeCible: z.number().nullable().default(null),
  repsCible: entier.nullable().default(null),
  dureeCibleSec: entier.nullable().default(null),
  compteurEchec: entier.default(0),
  derniereMaj: z.string().nullable().default(null),
})

// ── Inventaire matériel ─────────────────────────────────────────────────────────

// Map<Float, Int> Kotlin : les clés JSON sont des flottants en texte ("20.0"). On vérifie qu'elles
// sont numériques puis on les normalise ("20.0" -> "20") au format de progression/types.ts.
const disquesSchema = z
  .record(z.string(), entier)
  .superRefine((disques, ctx) => {
    for (const cle of Object.keys(disques)) {
      if (cle.trim() === '' || !Number.isFinite(Number(cle))) {
        ctx.addIssue({ code: 'custom', path: [cle], message: `poids de disque non numérique : « ${cle} »` })
      }
    }
  })
  .transform((disques) => {
    const normalise: Record<string, number> = {}
    for (const [cle, quantite] of Object.entries(disques)) normalise[String(Number(cle))] = quantite
    return normalise
  })

export const DisquesConfigSchema = z.object({
  barreKg: z.number(),
  disques: disquesSchema.default({}),
})

export const PlageConfigSchema = z.object({
  minKg: z.number(),
  maxKg: z.number(),
  pasKg: z.number(),
})

export const HalteresConfigSchema = z.object({
  poidsFixes: z.array(z.number()).default([]),
  chargeable: DisquesConfigSchema.nullable().default(null),
})

export const EquipmentConfigDtoSchema = z.object({
  selectedCategories: listeTextes,
  pasParCategorie: z.record(z.string(), z.number()).default({}),
  halteres: HalteresConfigSchema.nullable().default(null),
  barre: DisquesConfigSchema.nullable().default(null),
  kettlebell: PlageConfigSchema.nullable().default(null),
  cable: PlageConfigSchema.nullable().default(null),
})

// ── Racines ─────────────────────────────────────────────────────────────────────

// Sections hors phase 1 (running, vélo, rando, respiration) : acceptées puis abandonnées,
// seule leur forme de liste est vérifiée.
const sectionIgnoree = z.array(z.unknown()).default([])
const sessionsIgnorees = z
  .object({ completed: sectionIgnoree, planned: sectionIgnoree })
  .default({ completed: [], planned: [] })

export const PandaMoveExportSchema = z.object({
  version: z.string().default('3.0'),
  exportDate: z.string().default(''),
  strengthTemplates: z.array(StrengthTemplateDtoSchema).default([]),
  strengthSessions: StrengthSessionsDtoSchema.default({ completed: [], planned: [] }),
  runTemplates: sectionIgnoree,
  runSessions: sessionsIgnorees,
  cyclingTemplates: sectionIgnoree,
  cyclingSessions: sessionsIgnorees,
  hikingTemplates: sectionIgnoree,
  hikingSessions: sessionsIgnorees,
  breathingSessions: sectionIgnoree,
  customExercises: z.array(CustomExerciseDtoSchema).default([]),
  objectifsProgression: z.array(ObjectifProgressionDtoSchema).default([]),
  equipmentConfig: EquipmentConfigDtoSchema.nullable().default(null),
})

export const ExerciseCatalogExportSchema = z.object({
  version: z.string().default('1.0'),
  exportDate: z.string().default(''),
  exercises: z.array(CustomExerciseDtoSchema).default([]),
})

export const EquipmentConfigExportSchema = z.object({
  version: z.string().default('1.0'),
  exportDate: z.string().default(''),
  config: EquipmentConfigDtoSchema.default({
    selectedCategories: [],
    pasParCategorie: {},
    halteres: null,
    barre: null,
    kettlebell: null,
    cable: null,
  }),
})

export type PandaMoveExport = z.infer<typeof PandaMoveExportSchema>
export type ExerciseCatalogExport = z.infer<typeof ExerciseCatalogExportSchema>
export type EquipmentConfigExport = z.infer<typeof EquipmentConfigExportSchema>
export type EquipmentConfigDto = z.infer<typeof EquipmentConfigDtoSchema>
export type ExerciceDto = z.infer<typeof ExerciceDtoSchema>
export type BlocDto = z.infer<typeof BlocDtoSchema>
export type CustomExerciseDto = z.infer<typeof CustomExerciseDtoSchema>

/** Valide `input` ; à la première anomalie, lève une ImportError (message Zod en français + chemin). */
export function analyser<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const r = schema.safeParse(input, { error: z.locales.fr().localeError })
  if (r.success) return r.data
  const issue = r.error.issues[0]
  const chemin = issue.path.map(String).join('.')
  const lieu = chemin ? `champ « ${chemin} »` : 'racine du fichier'
  throw new ImportError(`Fichier d'import invalide (${lieu}) : ${issue.message}`, chemin)
}

export type TypeExport = 'complet' | 'catalogue' | 'materiel'

// Clés propres à l'export complet (v2.0 inclus, pour que sa version soit refusée explicitement).
const CLES_EXPORT_COMPLET = [
  'strengthTemplates', 'strengthSessions', 'runTemplates', 'runSessions', 'cyclingTemplates',
  'cyclingSessions', 'hikingTemplates', 'hikingSessions', 'breathingSessions', 'customExercises',
  'objectifsProgression', 'equipmentConfig', 'runWorkouts',
]

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Reconnaît le type d'un fichier déposé (export complet, catalogue d'exercices, « Mon matériel »). */
export function detecterTypeExport(input: unknown): TypeExport {
  if (!estObjet(input)) throw new ImportError("Fichier d'import non reconnu : un objet JSON est attendu", '')
  if (CLES_EXPORT_COMPLET.some((cle) => cle in input)) return 'complet'
  if (Array.isArray(input.exercises)) return 'catalogue'
  if (estObjet(input.config)) return 'materiel'
  throw new ImportError(
    "Fichier d'import non reconnu : ni export complet, ni catalogue d'exercices, ni « Mon matériel »",
    '',
  )
}
