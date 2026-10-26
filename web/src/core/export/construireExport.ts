import { parseTimestamp } from '../common/parseTimestamp'
import type { DbLecture } from '../db/Db'
import type { Ligne } from '../db/repos/mappers'
import { lireEquipementStocke } from '../import/equipment'
import { AllocateurIds } from './ids'
import type {
  BlocExport,
  CustomExerciseExport,
  EquipmentConfigExport,
  ExerciceExport,
  InstanceExport,
  ObjectifExport,
  PandaMoveExport,
  SeanceExport,
  SerieExport,
  StrengthSessionExport,
} from './types'

export type { PandaMoveExport } from './types'

// Export JSON « PandaMoveExport » v3.2 (format de l'export Android, relu par l'import web et Android).
// Lecture seule de la base locale ; seules les lignes vivantes (deleted_at IS NULL) sont exportées, avec
// deux exceptions pour que l'historique reste importable : une séance supprimée dont des séances jouées
// sont gardées (« Garder l'historique ») est exportée archivée, sans blocs ni exercices, avec deletedAt ;
// un exercice supprimé encore référencé est exporté avec deletedAt (l'import les recrée en suppression
// logique, nom lisible).
//
// Identifiants : chaque id Long est dérivé de l'UUID de la ligne (voir ids.ts) et l'UUID est recopié
// dans un champ additionnel `uuid`, avec le compte exportateur (`webUserId`). Pour un fichier de ce
// même compte, l'import reprend les `uuid` comme ids : réimporter est une mise à jour exacte, sans
// doublon. Pour un autre compte, il calcule ses propres ids à partir des Long (voir import/plan.ts).
//
// Horodatages des champs du format : date-heure ISO sans fuseau, comme le LocalDateTime Android. Une
// valeur déjà sans fuseau (importée d'Android) est recopiée telle quelle ; une valeur avec fuseau
// (client « Z » ou serveur « +00 ») est convertie en UTC, que l'app web relit comme UTC (parseTimestamp).
// Les champs additionnels propres au web gardent la valeur brute de la base.

const RE_SANS_FUSEAU = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?$/
const RE_DATE = /^(\d{4}-\d{2}-\d{2})/

function horodatage(valeur: unknown): string | null {
  if (typeof valeur !== 'string' || valeur.trim() === '') return null
  if (RE_SANS_FUSEAU.test(valeur)) return valeur
  const ms = parseTimestamp(valeur)
  return ms === null ? null : new Date(ms).toISOString().slice(0, 23)
}

const dateSeule = (valeur: unknown): string | null =>
  typeof valeur === 'string' ? (RE_DATE.exec(valeur)?.[1] ?? null) : null

const texte = (v: unknown, defaut = ''): string => (typeof v === 'string' ? v : defaut)
const texteOuNull = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const nombreOuNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const entier = (v: unknown, defaut: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : defaut)
const entierOuNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null)
const bool = (v: unknown): boolean => v === 1 || v === true

// Listes stockées en JSON (même encodage que le ListConverters Room)
function liste(v: unknown): string[] {
  if (typeof v !== 'string') return []
  try {
    const brut: unknown = JSON.parse(v)
    return Array.isArray(brut) ? brut.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

const TABLES_IDS = [
  'exercises', 'seances', 'blocs_seance', 'exercices_seance', 'instances_seance',
  'series_realisees', 'objectifs_progression',
] as const
type TableIds = (typeof TABLES_IDS)[number]

/** Regroupe des lignes par une colonne (ordre de lecture conservé). */
function grouper(lignes: Ligne[], colonne: string): Map<unknown, Ligne[]> {
  const groupes = new Map<unknown, Ligne[]>()
  for (const l of lignes) {
    const cle = l[colonne]
    const g = groupes.get(cle)
    if (g) g.push(l)
    else groupes.set(cle, [l])
  }
  return groupes
}

/** « Mon matériel » : null si aucun réglage n'a jamais été enregistré (l'import ne touchera pas au matériel). */
function materiel(equipmentJson: unknown): EquipmentConfigExport | null {
  if (typeof equipmentJson !== 'string') return null
  let brut: unknown
  try {
    brut = JSON.parse(equipmentJson)
  } catch {
    return null
  }
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut) || Object.keys(brut).length === 0) return null
  const e = lireEquipementStocke(equipmentJson)
  return {
    selectedCategories: e.selectedCategories,
    pasParCategorie: e.pasParCategorie,
    halteres: e.halteres,
    barre: e.barre,
    kettlebell: e.kettlebell,
    cable: e.cable,
  }
}

/** Export refusé, message français affichable tel quel. */
export class ErreurExport extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErreurExport'
  }
}

export const MESSAGE_AUTRE_COMPTE =
  "Cet appareil contient des données d'un autre compte : export impossible. Reconnectez-vous avec ce compte " +
  'pour les synchroniser, ou effacez les données locales, puis réessayez.'

/**
 * Construit l'export complet de la base locale. `maintenant` date le fichier (exportDate) ; il n'a
 * aucun autre effet : deux exports d'une même base ne diffèrent que par exportDate.
 */
export async function construireExport(db: DbLecture, maintenant: Date, userId?: string): Promise<PandaMoveExport> {
  const lire = (sql: string) => db.getAll<Ligne>(sql)

  // Jamais de données d'un autre utilisateur dans le fichier (cas d'un compte bloqué par la file
  // d'envoi d'un autre) : une ligne étiquetée d'un autre user_id fait refuser l'export. Une ligne
  // sans user_id (pas encore synchronisée) appartient à l'appareil et reste exportée.
  if (userId) {
    for (const table of [...TABLES_IDS, 'user_settings']) {
      const etrangere = await db.getOptional<{ one: number }>(
        `SELECT 1 AS one FROM ${table} WHERE user_id IS NOT NULL AND user_id <> ? LIMIT 1`,
        [userId],
      )
      if (etrangere) throw new ErreurExport(MESSAGE_AUTRE_COMPTE)
    }
  }
  const vivantes = (table: string, suite = '') => lire(`SELECT * FROM ${table} WHERE deleted_at IS NULL ${suite}`)

  // Tri explicite partout (l'ordre de lecture SQLite n'est pas garanti) : export reproductible
  const blocs = await vivantes('blocs_seance', 'ORDER BY position, id')
  const lignesEx = await vivantes('exercices_seance', 'ORDER BY position, id')
  const instances = await vivantes('instances_seance', 'ORDER BY date, created_at, id')
  const series = await vivantes('series_realisees', 'ORDER BY numero_serie, id')
  const objectifs = await vivantes('objectifs_progression', 'ORDER BY id')
  const reglages = await db.getOptional<Ligne>(
    'SELECT equipment_json FROM user_settings WHERE deleted_at IS NULL ORDER BY updated_at DESC, id LIMIT 1',
  )
  // Nom de tout exercice référencé, même supprimé : l'import résout les exercices par nom
  const nomsExercices = new Map(
    (await lire('SELECT id, name FROM exercises')).map((e) => [e.id, texte(e.name)]),
  )

  // Seules les lignes exportées comptent pour l'attribution des ids (collisions résolues entre elles)
  const instancesExportees = new Set(instances.map((i) => i.id))
  const blocsExportes = blocs.filter((b) => b.instance_seance_id === null || instancesExportees.has(b.instance_seance_id))
  const lignesExportees = lignesEx.filter((e) => e.instance_seance_id === null || instancesExportees.has(e.instance_seance_id))
  const seriesExportees = series.filter((s) => instancesExportees.has(s.instance_seance_id))

  // Séances : vivantes + supprimées référencées par une instance exportée (historique gardé)
  const seancesReferencees = new Set(instances.map((i) => i.seance_id))
  const seances = (await lire('SELECT * FROM seances ORDER BY created_at, nom, id')).filter(
    (s) => s.deleted_at === null || seancesReferencees.has(s.id),
  )
  // Exercices : vivants + supprimés encore référencés par une ligne de séance ou un objectif exportés
  const exercicesReferences = new Set([...lignesExportees, ...objectifs].map((l) => l.exercise_id))
  const exercises = (await lire('SELECT * FROM exercises ORDER BY name, id')).filter(
    (e) => e.deleted_at === null || exercicesReferences.has(e.id),
  )
  const lignesParTable: Record<TableIds, Ligne[]> = {
    exercises, seances, blocs_seance: blocsExportes, exercices_seance: lignesExportees,
    instances_seance: instances, series_realisees: seriesExportees, objectifs_progression: objectifs,
  }
  const allocateurs = Object.fromEntries(
    TABLES_IDS.map((t) => [t, new AllocateurIds(lignesParTable[t].map((l) => String(l.id)))]),
  ) as Record<TableIds, AllocateurIds>
  const id = (table: TableIds, uuid: unknown): number => allocateurs[table].id(String(uuid))
  const idOuNull = (table: TableIds, uuid: unknown): number | null =>
    typeof uuid === 'string' && uuid !== '' ? id(table, uuid) : null

  // Une référence facultative vers une ligne non exportée (supprimée) est remise à null
  const blocsIds = new Set(blocsExportes.map((b) => b.id))

  const bloc = (b: Ligne): BlocExport => ({
    id: id('blocs_seance', b.id),
    seanceId: id('seances', b.seance_id),
    nom: texte(b.nom),
    type: texte(b.type, 'ECHAUFFEMENT'),
    position: entier(b.position, 0),
    dureeMin: entierOuNull(b.duree_min),
    description: texte(b.description),
    tempsReposInterSec: entier(b.temps_repos_inter_sec, 20),
    tempsReposFinRoundSec: entier(b.temps_repos_fin_round_sec, 120),
    instanceSeanceId: idOuNull('instances_seance', b.instance_seance_id),
    uuid: String(b.id),
  })

  const exercice = (e: Ligne): ExerciceExport => ({
    id: id('exercices_seance', e.id),
    seanceId: id('seances', e.seance_id),
    exerciceId: idOuNull('exercises', e.exercise_id) ?? 0,
    exerciceName: nomsExercices.get(e.exercise_id) ?? '',
    instanceSeanceId: idOuNull('instances_seance', e.instance_seance_id),
    blocId: blocsIds.has(e.bloc_id) ? id('blocs_seance', e.bloc_id) : null,
    supersetGroupe: texteOuNull(e.superset_groupe),
    position: entier(e.position, 0),
    nombreSeriesPrevues: entier(e.nombre_series_prevues, 3),
    repsCibles: texte(e.reps_cibles),
    chargeCible: texte(e.charge_cible),
    tempo: texte(e.tempo),
    repsType: texte(e.reps_type, 'REPS'),
    tempsReposSec: entier(e.temps_repos_sec, 90),
    consigneCle: texte(e.consigne_cle),
    equipement: texte(e.equipement),
    avertissement: texte(e.avertissement),
    isBilateral: bool(e.is_bilateral),
    progressionActivee: bool(e.progression_activee),
    systemeProgression: texteOuNull(e.systeme_progression),
    repsMin: entierOuNull(e.reps_min),
    repsMax: entierOuNull(e.reps_max),
    incrementKg: nombreOuNull(e.increment_kg),
    incrementDureeSec: entier(e.increment_duree_sec, 5),
    seuilDeload: entier(e.seuil_deload, 3),
    typeExercice: texteOuNull(e.type_exercice),
    incrementPct: nombreOuNull(e.increment_pct),
    isBodyweight: bool(e.is_bodyweight),
    uuid: String(e.id),
    ...(texteOuNull(e.notes) !== null ? { notes: texteOuNull(e.notes) } : {}),
  })

  const seance = (s: Ligne): SeanceExport => ({
    id: id('seances', s.id),
    nom: texte(s.nom),
    groupesMusculaires: liste(s.groupes_musculaires),
    dureeEstimeeMin: entier(s.duree_estimee_min, 60),
    notes: texte(s.notes),
    seanceCategory: texte(s.seance_category, 'STRENGTH'),
    createdAt: horodatage(s.created_at) ?? '',
    updatedAt: horodatage(s.updated_at) ?? '',
    uuid: String(s.id),
    // Une séance supprimée gardée pour son historique est présentée archivée (hors liste)
    isArchived: bool(s.is_archived) || s.deleted_at !== null,
    deletedAt: texteOuNull(s.deleted_at),
  })

  const instance = (i: Ligne): InstanceExport => ({
    id: id('instances_seance', i.id),
    seanceId: id('seances', i.seance_id),
    date: dateSeule(i.date) ?? '',
    notes: texte(i.notes),
    isCompleted: bool(i.is_completed),
    completedAt: horodatage(i.completed_at),
    durationSeconds: entier(i.duration_seconds, 0),
    createdAt: horodatage(i.created_at) ?? '',
    uuid: String(i.id),
    startedAt: texteOuNull(i.started_at),
    pausedJson: texteOuNull(i.paused_json),
    progressionJson: texteOuNull(i.progression_json),
    // Seulement si renommée : un export sans nom propre reste identique à celui d'avant la migration 0007
    ...(texteOuNull(i.nom) !== null ? { nom: texteOuNull(i.nom) } : {}),
  })

  const serie = (s: Ligne): SerieExport => ({
    id: id('series_realisees', s.id),
    instanceSeanceId: id('instances_seance', s.instance_seance_id),
    exerciceSeanceId: id('exercices_seance', s.exercice_seance_id),
    numeroSerie: entier(s.numero_serie, 0),
    repsRealisees: entierOuNull(s.reps_realisees),
    chargeKg: nombreOuNull(s.charge_kg),
    chargeLabel: texteOuNull(s.charge_label),
    rpe: nombreOuNull(s.rpe),
    notes: texte(s.notes),
    isCompleted: bool(s.is_completed),
    uuid: String(s.id),
    validatedAt: texteOuNull(s.validated_at),
    updatedAt: texteOuNull(s.updated_at),
  })

  const customExercise = (e: Ligne): CustomExerciseExport => ({
    id: id('exercises', e.id),
    name: texte(e.name),
    description: texte(e.description),
    category: texte(e.category),
    muscleGroups: liste(e.muscle_groups),
    exerciseType: texte(e.exercise_type),
    equipment: liste(e.equipment),
    musclePrimary: texte(e.muscle_primary),
    uuid: String(e.id),
    isFavorite: bool(e.is_favorite),
    isBodyweight: bool(e.is_bodyweight),
    deletedAt: texteOuNull(e.deleted_at),
  })

  const objectif = (o: Ligne): ObjectifExport => ({
    id: id('objectifs_progression', o.id),
    seanceId: id('seances', o.seance_id),
    exerciceId: idOuNull('exercises', o.exercise_id) ?? 0,
    exerciceName: nomsExercices.get(o.exercise_id) ?? '',
    chargeCible: nombreOuNull(o.charge_cible),
    repsCible: entierOuNull(o.reps_cible),
    dureeCibleSec: entierOuNull(o.duree_cible_sec),
    compteurEchec: entier(o.compteur_echec, 0),
    derniereMaj: dateSeule(o.derniere_maj),
    uuid: String(o.id),
    nombreSeriesCible: entierOuNull(o.nombre_series_cible),
  })

  // Templates : lignes sans instance (isolation template/instance)
  const blocsTemplate = grouper(blocsExportes.filter((b) => b.instance_seance_id === null), 'seance_id')
  const lignesTemplate = grouper(lignesExportees.filter((e) => e.instance_seance_id === null), 'seance_id')
  // Instances : copies et séries rattachées par instance_seance_id
  const blocsInstance = grouper(blocsExportes.filter((b) => b.instance_seance_id !== null), 'instance_seance_id')
  const lignesInstance = grouper(lignesExportees.filter((e) => e.instance_seance_id !== null), 'instance_seance_id')
  const seriesInstance = grouper(seriesExportees, 'instance_seance_id')

  const sessions: { completed: StrengthSessionExport[]; planned: StrengthSessionExport[] } = { completed: [], planned: [] }
  for (const i of instances) {
    const session: StrengthSessionExport = {
      instance: instance(i),
      series: (seriesInstance.get(i.id) ?? []).map(serie),
      blocs: (blocsInstance.get(i.id) ?? []).map(bloc),
      exercices: (lignesInstance.get(i.id) ?? []).map(exercice),
    }
    ;(bool(i.is_completed) ? sessions.completed : sessions.planned).push(session)
  }

  const vide = { completed: [], planned: [] }
  return {
    version: '3.2',
    exportDate: maintenant.toISOString().slice(0, 23),
    ...(userId ? { webUserId: userId } : {}),
    strengthTemplates: seances.map((s) => ({
      seance: seance(s),
      // Séance supprimée : seulement de quoi rattacher l'historique, pas de modèle
      blocs: s.deleted_at === null ? (blocsTemplate.get(s.id) ?? []).map(bloc) : [],
      exercices: s.deleted_at === null ? (lignesTemplate.get(s.id) ?? []).map(exercice) : [],
    })),
    strengthSessions: sessions,
    runTemplates: [],
    runSessions: { ...vide },
    cyclingTemplates: [],
    cyclingSessions: { ...vide },
    hikingTemplates: [],
    hikingSessions: { ...vide },
    breathingSessions: [],
    customExercises: exercises.map(customExercise),
    objectifsProgression: objectifs.map(objectif),
    equipmentConfig: materiel(reglages?.equipment_json),
  }
}
