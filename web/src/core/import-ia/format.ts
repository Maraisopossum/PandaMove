import { z } from 'zod'
import { TYPES_BLOC } from '../../features/strength/draft'
import { SYSTEMES_PROGRESSION, TYPES_EXERCICE } from '../../features/strength/edition/progressionConfig'
import { MUSCLE_GROUPS } from '../db/types'

// Format « PandaMove – séances IA » v1 : un fichier JSON (UTF-8) de 1 à 20 séances de renforcement, écrit par une
// IA (ChatGPT, Claude, Gemini…) d'après la consigne générée par l'application (modele.ts). Les valeurs
// autorisées sont CELLES DU CODE (types de bloc, systèmes de progression, groupes musculaires) : aucune liste
// recopiée, donc aucune dérive possible entre la consigne, le schéma et l'éditeur.

export const FORMAT_ID = 'pandamove-seances-ia'
export const VERSION_FORMAT = 1

export const NB_SEANCES_MAX = 20
export const NB_BLOCS_MAX = 20
export const NB_EXERCICES_MAX = 30

/** LIBRE = exercices hors bloc (exercices libres de l'éditeur) ; les autres sont les types de bloc existants. */
export const TYPES_BLOC_IA = ['LIBRE', ...TYPES_BLOC] as const
export type TypeBlocIA = (typeof TYPES_BLOC_IA)[number]

export const SYSTEMES = SYSTEMES_PROGRESSION.map((s) => s.valeur)
export const TYPES_EXERCICE_IA = TYPES_EXERCICE.map((t) => t.valeur)
export const GROUPES = [...MUSCLE_GROUPS]

/** Valeurs prises quand un champ est omis : les mêmes que l'éditeur (vérifié par les tests). */
export const DEFAUTS = {
  reposSec: 90,
  reposInterExercicesSec: 20,
  reposFinTourSec: 120,
  tours: 3,
  seuilDeload: 3,
  repsMin: 8,
  repsMax: 12,
  incrementKg: 2.5,
  systeme: 'DOUBLE',
} as const

// ── Messages d'erreur en français ───────────────────────────────────────────────────────────────
type Probleme = { input?: unknown }
const err = (attendu: string) => (iss: Probleme) => (iss.input === undefined ? 'est obligatoire' : `doit être ${attendu}`)

const entier = (min: number, max: number, decrit: string) => {
  const msg = `doit être un entier entre ${min} et ${max}`
  return z.number({ error: err(`un entier entre ${min} et ${max}`) }).int(msg).min(min, msg).max(max, msg).describe(decrit)
}
const nombre = (min: number, max: number, decrit: string) => {
  const msg = `doit être un nombre entre ${min} et ${max}`
  return z.number({ error: err(`un nombre entre ${min} et ${max}`) }).min(min, msg).max(max, msg).describe(decrit)
}
const texte = (max: number, decrit: string) =>
  z
    .string({ error: err('un texte') })
    .max(max, `doit faire ${max} caractères au maximum`)
    .refine((s) => s.trim() !== '', 'ne doit pas être vide')
    .describe(decrit)
const enumDe = <T extends string>(valeurs: readonly T[], decrit: string) =>
  z
    .enum(valeurs as [T, ...T[]], {
      error: (iss) => (iss.input === undefined ? 'est obligatoire' : `doit valoir l'une de ces valeurs : ${valeurs.join(', ')}`),
    })
    .describe(decrit)
const booleen = (decrit: string) => z.boolean({ error: err('true ou false') }).describe(decrit)
const liste = <T extends z.ZodType>(element: T, min: number, max: number, decrit: string) =>
  z
    .array(element, { error: err('une liste') })
    .min(min, `doit contenir au moins ${min} élément${min > 1 ? 's' : ''}`)
    .max(max, `doit contenir ${max} éléments au maximum`)
    .describe(decrit)
const objet = <T extends z.ZodRawShape>(forme: T, decrit: string) => z.object(forme, { error: err('un objet JSON { … }') }).describe(decrit)

// ── Schéma ─────────────────────────────────────────────────────────────────────────────────────
export const MusclesSchema = objet(
  {
    principal: enumDe(GROUPES, 'Groupe musculaire principal (code)'),
    secondaires: liste(enumDe(GROUPES, 'Groupe musculaire secondaire (code)'), 0, 6, 'Groupes musculaires secondaires (codes). Facultatif.').optional(),
  },
  "Muscles de l'exercice. Utilisés UNIQUEMENT si l'exercice n'existe pas au catalogue (il sera alors créé).",
)

export const ProgressionSchema = objet(
  {
    activee: booleen('true pour activer la surcharge progressive sur cet exercice'),
    systeme: enumDe(SYSTEMES, `Système de progression (défaut ${DEFAUTS.systeme})`).optional(),
    repsMin: entier(1, 1000, `Répétitions minimales de la plage (double progression, défaut ${DEFAUTS.repsMin})`).optional(),
    repsMax: entier(1, 1000, `Répétitions maximales de la plage (double progression, défaut ${DEFAUTS.repsMax})`).optional(),
    incrementKg: nombre(0, 500, `Charge ajoutée à chaque montée, en kg (défaut ${DEFAUTS.incrementKg})`).optional(),
    seuilDeload: entier(1, 10, `Nombre d'échecs avant de proposer une décharge (défaut ${DEFAUTS.seuilDeload})`).optional(),
  },
  'Surcharge progressive. Sans effet dans un bloc ECHAUFFEMENT ou ACTIVATION.',
)

export const ExerciceIASchema = objet(
  {
    exercice: texte(120, "Nom EXACT de l'exercice du catalogue fourni ; sinon un nouveau nom (l'exercice sera créé, ajoutez alors « muscles »)"),
    series: entier(1, 20, "Nombre de séries. Obligatoire sauf dans un bloc CIRCUIT (c'est « tours » du bloc qui compte)").optional(),
    reps: z
      .union([texte(20, ''), entier(1, 1000, '')], { error: err('un texte (« 8-12 », « 10 ») ou un nombre de répétitions') })
      .describe('Répétitions visées : « 10 » ou une plage « 8-12 ». Pour un exercice chronométré, utilisez dureeSec.')
      .optional(),
    dureeSec: entier(1, 3600, 'Durée en secondes (exercice chronométré : gainage, circuit…). Obligatoire dans un CIRCUIT.').optional(),
    chargeKg: nombre(0, 1000, 'Charge cible en kg. Ne pas indiquer pour un poids de corps (utilisez charge).').optional(),
    charge: z
      .literal('PDC', { error: () => 'doit valoir « PDC » (poids de corps) ; pour une charge, utilisez chargeKg' })
      .describe('« PDC » pour un exercice au poids de corps')
      .optional(),
    reposSec: entier(0, 3600, `Repos entre les séries, en secondes (défaut ${DEFAUTS.reposSec}). Ignoré dans un SUPERSET ou un CIRCUIT.`).optional(),
    tempo: texte(20, 'Tempo, par exemple « 3-1-1 »').optional(),
    consigne: texte(300, "Consigne d'exécution courte").optional(),
    bilateral: booleen("true si l'exercice se fait un côté après l'autre (la durée estimée double). Défaut false.").optional(),
    typeExercice: enumDe(TYPES_EXERCICE_IA, "Type d'exercice (règle l'incrément de la progression). Facultatif.").optional(),
    muscles: MusclesSchema.optional(),
    progression: ProgressionSchema.optional(),
  },
  'Un exercice du bloc',
).superRefine((e, ctx) => {
  if (e.charge !== undefined && e.chargeKg !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['chargeKg'], message: "ne peut pas être combiné avec « charge » (PDC) : choisissez l'un ou l'autre" })
  }
  const p = e.progression
  if (p && p.repsMin !== undefined && p.repsMax !== undefined && p.repsMin > p.repsMax) {
    ctx.addIssue({ code: 'custom', path: ['progression', 'repsMin'], message: 'ne peut pas dépasser repsMax' })
  }
})

export const BlocIASchema = objet(
  {
    nom: texte(100, 'Nom du bloc. Facultatif (le libellé du type est utilisé). Ignoré pour LIBRE.').optional(),
    type: enumDe(
      TYPES_BLOC_IA,
      'Type de bloc. LIBRE = exercices hors bloc ; SUPERSET = 2 à 4 exercices enchaînés ; CIRCUIT = exercices chronométrés répétés sur plusieurs tours.',
    ),
    reposInterExercicesSec: entier(0, 3600, `SUPERSET et CIRCUIT : repos entre deux exercices, en secondes (défaut ${DEFAUTS.reposInterExercicesSec})`).optional(),
    reposFinTourSec: entier(0, 3600, `SUPERSET et CIRCUIT : repos en fin de tour, en secondes (défaut ${DEFAUTS.reposFinTourSec})`).optional(),
    tours: entier(1, 20, `CIRCUIT uniquement : nombre de tours (défaut ${DEFAUTS.tours})`).optional(),
    exercices: liste(ExerciceIASchema, 1, NB_EXERCICES_MAX, "Exercices du bloc, dans l'ordre"),
  },
  'Un bloc de la séance',
).superRefine((b, ctx) => {
  b.exercices.forEach((e, i) => {
    if (b.type === 'CIRCUIT') {
      if (e.dureeSec === undefined) {
        ctx.addIssue({ code: 'custom', path: ['exercices', i, 'dureeSec'], message: 'est obligatoire dans un CIRCUIT (durée en secondes)' })
      }
    } else if (e.series === undefined) {
      ctx.addIssue({ code: 'custom', path: ['exercices', i, 'series'], message: 'doit être un entier entre 1 et 20 (obligatoire)' })
    }
  })
})

export const SeanceIASchema = objet(
  {
    nom: texte(100, 'Nom de la séance'),
    notes: texte(2000, 'Notes ou objectif de la séance. Facultatif.').optional(),
    blocs: liste(BlocIASchema, 1, NB_BLOCS_MAX, "Blocs de la séance, dans l'ordre"),
  },
  'Une séance de renforcement',
)

export const FichierIASchema = objet(
  {
    format: z.literal(FORMAT_ID, { error: () => `doit valoir « ${FORMAT_ID} »` }).describe('Identifiant du format, toujours cette valeur'),
    version: z.literal(VERSION_FORMAT, { error: () => `doit valoir ${VERSION_FORMAT} (seule version prise en charge)` }).describe('Version du format'),
    seances: liste(SeanceIASchema, 1, NB_SEANCES_MAX, 'Séances à importer'),
  },
  'Fichier « PandaMove – séances IA »',
)

export type FichierIA = z.infer<typeof FichierIASchema>
export type SeanceIA = z.infer<typeof SeanceIASchema>
export type BlocIA = z.infer<typeof BlocIASchema>
export type ExerciceIA = z.infer<typeof ExerciceIASchema>

// ── Validation ─────────────────────────────────────────────────────────────────────────────────
export interface ErreurIA {
  /** Chemin lisible, par exemple « seances[1].blocs[0].exercices[2].series » */
  chemin: string
  message: string
  /** « chemin : message » */
  texte: string
}

export function formaterChemin(chemin: readonly PropertyKey[]): string {
  return chemin.reduce<string>((acc, cle) => (typeof cle === 'number' ? `${acc}[${cle}]` : acc === '' ? String(cle) : `${acc}.${String(cle)}`), '')
}

const erreur = (chemin: string, message: string): ErreurIA => ({ chemin, message, texte: `${chemin === '' ? 'Fichier' : chemin} : ${message}` })

// Champs reconnus à chaque niveau, lus dans les schémas eux-mêmes.
const cles = (o: { shape: Record<string, unknown> }) => new Set(Object.keys(o.shape))
const CLES = {
  racine: cles(FichierIASchema),
  seance: cles(SeanceIASchema),
  bloc: cles(BlocIASchema),
  exercice: cles(ExerciceIASchema),
  muscles: cles(MusclesSchema),
  progression: cles(ProgressionSchema),
}

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const tableau = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

/** Avertissements « champ inconnu » : l'import continue, mais l'utilisateur voit ce qui est ignoré (faute de frappe). */
export function champsInconnus(brut: unknown): string[] {
  const avertissements: string[] = []
  const verifier = (valeur: unknown, connus: Set<string>, chemin: string) => {
    if (!estObjet(valeur)) return
    for (const cle of Object.keys(valeur)) {
      if (!connus.has(cle)) avertissements.push(`${chemin === '' ? 'Fichier' : chemin} : champ inconnu « ${cle} » ignoré`)
    }
  }
  verifier(brut, CLES.racine, '')
  if (!estObjet(brut)) return avertissements
  tableau(brut.seances).forEach((s, i) => {
    const cs = `seances[${i}]`
    verifier(s, CLES.seance, cs)
    if (!estObjet(s)) return
    tableau(s.blocs).forEach((b, j) => {
      const cb = `${cs}.blocs[${j}]`
      verifier(b, CLES.bloc, cb)
      if (!estObjet(b)) return
      tableau(b.exercices).forEach((e, k) => {
        const ce = `${cb}.exercices[${k}]`
        verifier(e, CLES.exercice, ce)
        if (!estObjet(e)) return
        verifier(e.muscles, CLES.muscles, `${ce}.muscles`)
        verifier(e.progression, CLES.progression, `${ce}.progression`)
      })
    })
  })
  return avertissements
}

export interface ResultatValidation {
  donnees: FichierIA | null
  erreurs: ErreurIA[]
  avertissements: string[]
}

/** Valide un JSON déjà parsé. Toutes les erreurs sont renvoyées d'un coup, avec leur chemin. */
export function validerFichierIA(brut: unknown): ResultatValidation {
  const avertissements = champsInconnus(brut)
  const r = FichierIASchema.safeParse(brut)
  if (r.success) return { donnees: r.data, erreurs: [], avertissements }
  const vues = new Set<string>()
  const erreurs: ErreurIA[] = []
  for (const iss of r.error.issues) {
    const e = erreur(formaterChemin(iss.path), iss.message)
    if (!vues.has(e.texte)) {
      vues.add(e.texte)
      erreurs.push(e)
    }
  }
  return { donnees: null, erreurs, avertissements }
}
