import { normalizeSearch } from '../common/normalizeSearch'
import { deterministicId } from '../db/ids'
import type { Ligne } from '../db/repos/mappers'
import { construirePatch, type EquipmentPatch } from './equipment'
import {
  analyser,
  detecterTypeExport,
  EquipmentConfigExportSchema,
  ExerciseCatalogExportSchema,
  ImportError,
  PandaMoveExportSchema,
  type BlocDto,
  type CustomExerciseDto,
  type EquipmentConfigDto,
  type ExerciceDto,
  type PandaMoveExport,
} from './schema'

// Plan d'import PUR : transforme un export Android (déjà parsé en `unknown`) en lignes prêtes à
// insérer dans le SQLite local (colonnes snake_case de db/schema.ts). Aucun accès base ni horloge
// cachée : à entrée, userId et `now` identiques, le plan est strictement identique (idempotence).
//
// Identifiants :
//  - lignes à id Long Android : deterministicId(`${userId}:${table}`, String(idLong)) ;
//  - exercices : deterministicId(`${userId}:exercises`, normalizeSearch(nom)), car l'export ne
//    contient pas le catalogue de base et les ids Long du catalogue diffèrent d'un téléphone à l'autre ;
//  - matériel : pas de ligne user_settings, un patch fusionné par Task 10 via mergeEquipment.

export { detecterTypeExport, ImportError }
export { mergeEquipment, type EquipmentPatch, type EquipmentStocke } from './equipment'
export { verifierIntegrite } from './integrite'
export type { TypeExport } from './schema'

export type TableName =
  | 'exercises'
  | 'seances'
  | 'blocs_seance'
  | 'exercices_seance'
  | 'instances_seance'
  | 'series_realisees'
  | 'objectifs_progression'
  | 'user_settings'

export type Row = Ligne

export interface ImportReport {
  seances: number
  instances: number
  series: number
  exercises: number
  /** Exercices référencés par une séance/un objectif mais absents du fichier : ligne minimale créée. */
  exercisesCrees: number
  /** Sections abandonnées (hors périmètre phase 1) ou données remplacées, en clair. */
  ignores: string[]
}

export interface ImportPlan {
  rows: Record<TableName, Row[]>
  report: ImportReport
  /** Ids des lignes `exercises` minimales : à insérer seulement si absentes (ne jamais écraser
   * une fiche plus riche déjà importée depuis un catalogue). */
  exercisesMinimauxIds: string[]
  /** Patch « Mon matériel » à fusionner (mergeEquipment) dans les réglages ; null si le fichier n'en a pas.
   * rows.user_settings reste toujours vide. */
  equipmentPatch: EquipmentPatch | null
}

export interface ImportOptions {
  /** Horodatage ISO utilisé quand l'export ne fournit pas de date (défaut : maintenant). */
  now?: string
}

// ── Énumérations (valeur inconnue -> défaut, comme runCatching { valueOf() } côté Kotlin) ──
const BLOC_TYPES = ['ECHAUFFEMENT', 'ACTIVATION', 'SUPERSET', 'CIRCUIT', 'RECUPERATION']
const SEANCE_CATEGORIES = ['STRENGTH', 'WARMUP_GENERAL', 'WARMUP_MOBILITY', 'WARMUP_ACTIVATION', 'STRENGTH_ONESHOT']
const REPS_TYPES = ['REPS', 'DURATION']
const TYPES_EXERCICE = ['COMPOSE_BAS', 'COMPOSE_HAUT', 'ISOLATION', 'MACHINE', 'PDC']
const SYSTEMES_PROGRESSION = ['LINEAIRE', 'DOUBLE', 'TEMPORELLE']
const EXERCISE_CATEGORIES = ['CHEST', 'BACK', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'LEGS', 'GLUTES', 'CORE', 'CARDIO', 'FULL_BODY', 'OTHER']

const enumOu = (valeur: string, valides: string[], defaut: string) => (valides.includes(valeur) ? valeur : defaut)
const enumOuNull = (valeur: string | null, valides: string[]) => (valeur !== null && valides.includes(valeur) ? valeur : null)
const bool = (v: boolean) => (v ? 1 : 0)
// Listes : même encodage que le ListConverters Room (JSON d'un tableau de chaînes)
const liste = (v: string[]) => JSON.stringify(v)

// ── Dates (parité parseDateTimeFlexible / LocalDate.parse) ──────────────────────
const RE_DATE_HEURE = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?$/
const RE_DATE_HEURE_LEGACY = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}:\d{2})$/
const RE_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

const moisJourValides = (mois: string, jour: string) =>
  Number(mois) >= 1 && Number(mois) <= 12 && Number(jour) >= 1 && Number(jour) <= 31

/** Date-heure locale ISO conservée telle quelle ; format legacy `dd/MM/yyyy HH:mm:ss` converti ; sinon null. */
function dateHeure(brut: string | null): string | null {
  if (!brut) return null
  const iso = RE_DATE_HEURE.exec(brut)
  if (iso) return moisJourValides(iso[2], iso[3]) ? brut : null
  const legacy = RE_DATE_HEURE_LEGACY.exec(brut)
  if (legacy && moisJourValides(legacy[2], legacy[1])) return `${legacy[3]}-${legacy[2]}-${legacy[1]}T${legacy[4]}`
  return null
}

function dateSeule(brut: string | null): string | null {
  if (!brut) return null
  const m = RE_DATE.exec(brut)
  return m && moisJourValides(m[2], m[3]) ? brut : null
}

// ── Construction ────────────────────────────────────────────────────────────────

const TABLES: TableName[] = [
  'exercises', 'seances', 'blocs_seance', 'exercices_seance', 'instances_seance',
  'series_realisees', 'objectifs_progression', 'user_settings',
]

class Constructeur {
  // Une Map par table : la première ligne d'un id gagne (templates avant copies d'instance).
  private readonly tables = new Map<TableName, Map<string, Row>>(TABLES.map((t) => [t, new Map()]))
  private readonly minimaux = new Set<string>()
  readonly ignores: string[] = []
  private exercicesSansNom = 0
  private objectifsSansExercice = 0
  private equipmentPatch: EquipmentPatch | null = null
  private readonly userId: string
  readonly now: string

  constructor(userId: string, now: string) {
    this.userId = userId
    this.now = now
  }

  id(table: TableName, legacy: number): string {
    return deterministicId(`${this.userId}:${table}`, String(legacy))
  }

  idExercice(nom: string): string {
    return deterministicId(`${this.userId}:exercises`, normalizeSearch(nom))
  }

  private ajouter(table: TableName, id: string, champs: Row, ecraser = false) {
    const t = this.tables.get(table) as Map<string, Row>
    if (t.has(id) && !ecraser) return
    t.set(id, { id, user_id: this.userId, updated_at: this.now, deleted_at: null, ...champs })
  }

  exercice(dto: CustomExerciseDto, ecraser: boolean) {
    // Nom vide : ignoré (comme l'import en masse Android)
    if (!normalizeSearch(dto.name)) return
    const id = this.idExercice(dto.name)
    // Une fiche complète remplace une éventuelle fiche minimale
    if (this.minimaux.delete(id)) ecraser = true
    this.ligneExercice(id, dto, ecraser)
  }

  private ligneExercice(id: string, dto: CustomExerciseDto, ecraser: boolean) {
    this.ajouter('exercises', id, {
      name: dto.name,
      category: enumOu(dto.category, EXERCISE_CATEGORIES, 'OTHER'),
      muscle_groups: liste(dto.muscleGroups),
      description: dto.description,
      is_favorite: 0,
      is_custom: 1,
      image_url: null,
      exercise_type: dto.exerciseType,
      equipment: liste(dto.equipment),
      muscle_primary: dto.musclePrimary,
      is_bodyweight: 0,
    }, ecraser)
  }

  /** Résout un exercice par nom ; crée une fiche minimale s'il n'existe pas encore. */
  referenceExercice(nom: string, exerciceIdLegacy: number): string {
    let nomEffectif = nom.trim()
    if (!normalizeSearch(nomEffectif)) {
      nomEffectif = `Exercice inconnu #${exerciceIdLegacy}`
      this.exercicesSansNom++
    }
    const id = this.idExercice(nomEffectif)
    const t = this.tables.get('exercises') as Map<string, Row>
    if (!t.has(id)) {
      this.minimaux.add(id)
      this.ligneExercice(id, {
        id: exerciceIdLegacy, name: nomEffectif, description: '', category: 'OTHER',
        muscleGroups: [], exerciseType: '', equipment: [], musclePrimary: '',
      }, false)
    }
    return id
  }

  seance(dto: PandaMoveExport['strengthTemplates'][number]['seance']) {
    this.ajouter('seances', this.id('seances', dto.id), {
      updated_at: dateHeure(dto.updatedAt) ?? this.now,
      nom: dto.nom,
      groupes_musculaires: liste(dto.groupesMusculaires),
      duree_estimee_min: dto.dureeEstimeeMin,
      notes: dto.notes,
      seance_category: enumOu(dto.seanceCategory, SEANCE_CATEGORIES, 'STRENGTH'),
      created_at: dateHeure(dto.createdAt) ?? this.now,
      is_archived: 0,
    })
  }

  bloc(dto: BlocDto, instanceLegacy: number | null, source: BlocDto | null) {
    this.ajouter('blocs_seance', this.id('blocs_seance', dto.id), {
      seance_id: this.id('seances', dto.seanceId),
      nom: dto.nom,
      type: enumOu(dto.type, BLOC_TYPES, 'ECHAUFFEMENT'),
      position: dto.position,
      duree_min: dto.dureeMin,
      description: dto.description,
      temps_repos_inter_sec: dto.tempsReposInterSec,
      temps_repos_fin_round_sec: dto.tempsReposFinRoundSec,
      instance_seance_id: instanceLegacy === null ? null : this.id('instances_seance', instanceLegacy),
      bloc_source_id: source ? this.id('blocs_seance', source.id) : null,
    })
  }

  exerciceSeance(dto: ExerciceDto, instanceLegacy: number | null, source: ExerciceDto | null) {
    this.ajouter('exercices_seance', this.id('exercices_seance', dto.id), {
      seance_id: this.id('seances', dto.seanceId),
      exercise_id: this.referenceExercice(dto.exerciceName, dto.exerciceId),
      bloc_id: dto.blocId === null ? null : this.id('blocs_seance', dto.blocId),
      superset_groupe: dto.supersetGroupe,
      position: dto.position,
      nombre_series_prevues: dto.nombreSeriesPrevues,
      reps_cibles: dto.repsCibles,
      charge_cible: dto.chargeCible,
      tempo: dto.tempo,
      reps_type: enumOu(dto.repsType, REPS_TYPES, 'REPS'),
      temps_repos_sec: dto.tempsReposSec,
      consigne_cle: dto.consigneCle,
      equipement: dto.equipement,
      avertissement: dto.avertissement,
      instance_seance_id: instanceLegacy === null ? null : this.id('instances_seance', instanceLegacy),
      exercice_source_id: source ? this.id('exercices_seance', source.id) : null,
      is_bilateral: bool(dto.isBilateral),
      progression_activee: bool(dto.progressionActivee),
      systeme_progression: enumOuNull(dto.systemeProgression, SYSTEMES_PROGRESSION),
      reps_min: dto.repsMin,
      reps_max: dto.repsMax,
      increment_kg: dto.incrementKg,
      increment_duree_sec: dto.incrementDureeSec,
      seuil_deload: dto.seuilDeload,
      type_exercice: enumOuNull(dto.typeExercice, TYPES_EXERCICE),
      increment_pct: dto.incrementPct,
      is_bodyweight: bool(dto.isBodyweight),
    })
  }

  session(s: PandaMoveExport['strengthSessions']['completed'][number], templates: Map<number, Gabarit>) {
    const inst = s.instance
    const completedAt = dateHeure(inst.completedAt)
    const createdAt = dateHeure(inst.createdAt)
    this.ajouter('instances_seance', this.id('instances_seance', inst.id), {
      updated_at: completedAt ?? createdAt ?? this.now,
      seance_id: this.id('seances', inst.seanceId),
      date: dateSeule(inst.date) ?? this.now.slice(0, 10),
      notes: inst.notes,
      is_completed: bool(inst.isCompleted),
      completed_at: completedAt,
      duration_seconds: inst.durationSeconds,
      created_at: createdAt ?? this.now,
    })
    // Copies d'instance : isolées par instance_seance_id (forcé sur l'instance de la session si
    // absent, pour ne jamais créer de faux template) et reliées au template d'origine.
    const blocsUtilises = new Set<BlocDto>()
    for (const b of s.blocs) {
      const source = apparier(templates.get(b.seanceId)?.blocs ?? [], b, (x) => x.nom, blocsUtilises)
      this.bloc(b, b.instanceSeanceId ?? inst.id, source)
    }
    const exercicesUtilises = new Set<ExerciceDto>()
    for (const e of s.exercices) {
      const source = apparier(templates.get(e.seanceId)?.exercices ?? [], e, (x) => x.exerciceName, exercicesUtilises)
      this.exerciceSeance(e, e.instanceSeanceId ?? inst.id, source)
    }
    for (const serie of s.series) {
      this.ajouter('series_realisees', this.id('series_realisees', serie.id), {
        instance_seance_id: this.id('instances_seance', serie.instanceSeanceId),
        // Android : exerciceSeanceId désigne la ligne exercices_seance (normalement la copie d'instance)
        exercice_seance_id: this.id('exercices_seance', serie.exerciceSeanceId),
        numero_serie: serie.numeroSerie,
        reps_realisees: serie.repsRealisees,
        charge_kg: serie.chargeKg,
        charge_label: serie.chargeLabel,
        rpe: serie.rpe,
        notes: serie.notes,
        is_completed: bool(serie.isCompleted),
      })
    }
  }

  objectif(o: PandaMoveExport['objectifsProgression'][number]) {
    // Pas de fiche minimale pour un objectif : un exercice qu'aucune séance ni fiche du fichier ne
    // connaît rend l'objectif orphelin (écarté et signalé, comme errors++ côté Android).
    const exerciseId = normalizeSearch(o.exerciceName) ? this.idExercice(o.exerciceName) : null
    if (exerciseId === null || !(this.tables.get('exercises') as Map<string, Row>).has(exerciseId)) {
      this.objectifsSansExercice++
      return
    }
    this.ajouter('objectifs_progression', this.id('objectifs_progression', o.id), {
      seance_id: this.id('seances', o.seanceId),
      exercise_id: exerciseId,
      charge_cible: o.chargeCible,
      reps_cible: o.repsCible,
      duree_cible_sec: o.dureeCibleSec,
      compteur_echec: o.compteurEchec,
      derniere_maj: dateSeule(o.derniereMaj),
      nombre_series_cible: null,
    })
  }

  equipement(config: EquipmentConfigDto) {
    this.equipmentPatch = construirePatch(config)
  }

  plan(): ImportPlan {
    const table = (t: TableName) => this.tables.get(t) as Map<string, Row>
    const ignores = [...this.ignores]
    if (this.exercicesSansNom > 0) {
      ignores.push(`${this.exercicesSansNom} référence(s) d'exercice sans nom : rattachée(s) à « Exercice inconnu #id »`)
    }

    // Orphelins : écartés (référence obligatoire non résolue) dans l'ordre des dépendances, puis signalés.
    const ecarter = (t: TableName, garder: (r: Row) => boolean): number => {
      let n = 0
      for (const [id, r] of table(t)) if (!garder(r)) { table(t).delete(id); n++ }
      return n
    }
    const existe = (t: TableName, id: Row[string]) => typeof id === 'string' && table(t).has(id)
    const facultatifOk = (t: TableName, id: Row[string]) => id === null || existe(t, id)

    const instances = ecarter('instances_seance', (r) => existe('seances', r.seance_id))
    const blocs = ecarter('blocs_seance', (r) => existe('seances', r.seance_id) && facultatifOk('instances_seance', r.instance_seance_id))
    const exercices = ecarter('exercices_seance', (r) => existe('seances', r.seance_id) && facultatifOk('instances_seance', r.instance_seance_id))
    const series = ecarter('series_realisees', (r) => existe('instances_seance', r.instance_seance_id) && existe('exercices_seance', r.exercice_seance_id))
    const objectifs = this.objectifsSansExercice + ecarter('objectifs_progression', (r) => existe('seances', r.seance_id))

    // Références facultatives non résolues : remises à null, et signalées (jamais en silence)
    let facultatives = 0
    const nettoyer = (t: TableName, colonne: string, cible: TableName) => {
      for (const [id, r] of table(t)) {
        if (!facultatifOk(cible, r[colonne])) { table(t).set(id, { ...r, [colonne]: null }); facultatives++ }
      }
    }
    nettoyer('blocs_seance', 'bloc_source_id', 'blocs_seance')
    nettoyer('exercices_seance', 'bloc_id', 'blocs_seance')
    nettoyer('exercices_seance', 'exercice_source_id', 'exercices_seance')

    // Fiches minimales créées seulement par des lignes écartées : retirées
    const references = new Set<Row[string]>([
      ...[...table('exercices_seance').values()].map((r) => r.exercise_id),
      ...[...table('objectifs_progression').values()].map((r) => r.exercise_id),
    ])
    for (const id of [...this.minimaux]) {
      if (!references.has(id)) { this.minimaux.delete(id); table('exercises').delete(id) }
    }

    const signaler = (n: number, message: string) => { if (n > 0) ignores.push(`${n} ${message}`) }
    signaler(instances, "instance(s) ignorée(s) : séance d'origine absente du fichier")
    signaler(blocs, 'bloc(s) ignoré(s) : séance ou instance absente du fichier')
    signaler(exercices, 'exercice(s) de séance ignoré(s) : séance ou instance absente du fichier')
    signaler(series, 'série(s) ignorée(s) : instance ou exercice de séance introuvable')
    signaler(objectifs, 'objectif(s) de progression ignoré(s) : séance ou exercice introuvable')
    signaler(facultatives, 'référence(s) facultative(s) (bloc ou ligne source) introuvable(s) : remise(s) à vide')

    const rows = Object.fromEntries(TABLES.map((t) => [t, [...table(t).values()]])) as Record<TableName, Row[]>
    return {
      rows,
      report: {
        seances: rows.seances.length,
        instances: rows.instances_seance.length,
        series: rows.series_realisees.length,
        exercises: rows.exercises.length,
        exercisesCrees: this.minimaux.size,
        ignores,
      },
      exercisesMinimauxIds: [...this.minimaux],
      equipmentPatch: this.equipmentPatch,
    }
  }
}

interface Gabarit {
  blocs: BlocDto[]
  exercices: ExerciceDto[]
}

/** Ligne template correspondant à une copie : même nom (normalisé) et même position, sinon même
 * nom ; chaque ligne source n'est utilisée qu'une fois par instance (contrainte d'unicité
 * (instance_seance_id, exercice_source_id) côté Postgres). */
function apparier<T extends { position: number }>(
  candidats: T[],
  copie: T,
  nom: (x: T) => string,
  utilises: Set<T>,
): T | null {
  const cle = normalizeSearch(nom(copie))
  const libres = candidats.filter((c) => !utilises.has(c) && normalizeSearch(nom(c)) === cle)
  const choix = libres.find((c) => c.position === copie.position) ?? libres[0] ?? null
  if (choix) utilises.add(choix)
  return choix
}

function verifierVersion(input: Record<string, unknown>) {
  const version = input.version
  if (typeof version !== 'string') return // absente -> défaut "3.0" ; mauvais type -> erreur Zod
  const majeure = Number(version.split('.')[0])
  if (majeure !== 3) {
    throw new ImportError(
      `version d'export non prise en charge : « ${version} » (seules les versions 3.x sont acceptées)`,
      'version',
    )
  }
}

const SECTIONS_IGNOREES = [
  'runTemplates', 'runSessions', 'cyclingTemplates', 'cyclingSessions',
  'hikingTemplates', 'hikingSessions', 'breathingSessions',
] as const

function planComplet(input: Record<string, unknown>, c: Constructeur): void {
  verifierVersion(input)
  const exp = analyser(PandaMoveExportSchema, input)

  for (const cle of SECTIONS_IGNOREES) {
    const section = exp[cle]
    const n = Array.isArray(section) ? section.length : section.completed.length + section.planned.length
    if (n > 0) c.ignores.push(`${cle} : ${n} élément(s) ignoré(s) (hors périmètre phase 1 : renforcement uniquement)`)
  }

  // 1. Exercices personnalisés en premier (upsert par nom, comme Android : le dernier gagne)
  for (const ex of exp.customExercises) c.exercice(ex, true)

  // 2. Templates (seuls les blocs/exercices sans instance, comme l'export Android)
  const gabarits = new Map<number, Gabarit>()
  for (const t of exp.strengthTemplates) {
    c.seance(t.seance)
    gabarits.set(t.seance.id, { blocs: t.blocs, exercices: t.exercices })
    for (const b of t.blocs) c.bloc(b, b.instanceSeanceId, null)
    for (const e of t.exercices) c.exerciceSeance(e, e.instanceSeanceId, null)
  }

  // 3. Instances (réalisées puis planifiées)
  for (const s of [...exp.strengthSessions.completed, ...exp.strengthSessions.planned]) c.session(s, gabarits)

  // 4. Objectifs de progression, 5. matériel (seulement s'il est présent dans le fichier)
  for (const o of exp.objectifsProgression) c.objectif(o)
  if (exp.equipmentConfig) c.equipement(exp.equipmentConfig)
}

/**
 * Construit le plan d'import d'un fichier Android (export complet v3.x, catalogue d'exercices
 * ou « Mon matériel »). Lève ImportError (message français + chemin) si le fichier est invalide.
 */
export function buildImportPlan(input: unknown, userId: string, opts: ImportOptions = {}): ImportPlan {
  const c = new Constructeur(userId, opts.now ?? new Date().toISOString())
  const type = detecterTypeExport(input)
  const objet = input as Record<string, unknown>
  if (type === 'complet') {
    planComplet(objet, c)
  } else if (type === 'catalogue') {
    // Import en masse Android : doublon de nom ignoré (le premier gagne)
    for (const ex of analyser(ExerciseCatalogExportSchema, objet).exercises) c.exercice(ex, false)
  } else {
    c.equipement(analyser(EquipmentConfigExportSchema, objet).config)
  }
  return c.plan()
}
