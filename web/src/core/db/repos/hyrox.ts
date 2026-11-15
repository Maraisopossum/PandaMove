import { dateIsoValide } from '../../common/dates'
import type { Db, DbLecture } from '../Db'
import { newId } from '../ids'
import type { Ligne } from './mappers'

// Module Hyrox (migration 0015) : objectif (date facultative), simulations chronométrées et leurs segments.
// Le catalogue des stations et les règles de calcul restent dans features/hyrox (données de référence, jamais en base).

export const TABLE_HYROX_COURSES = 'hyrox_courses'
export const TABLE_HYROX_SIMULATIONS = 'hyrox_simulations'
export const TABLE_HYROX_SEGMENTS = 'hyrox_segments'

export type CategorieHyroxDb = 'open' | 'pro'
export type GenreHyroxDb = 'homme' | 'femme'
export type FormeSimulationDb = 'complete' | 'partielle' | 'station'
export type StatutSimulation = 'en_cours' | 'terminee' | 'abandonnee'

// Mêmes bornes que les contraintes SQL de la migration 0015.
export const LIMITES_HYROX = { nom: 200, lieu: 200, notes: 2000, repartition: 2000, dureeS: 604_800, station: 50, charge: 200 } as const

export interface CourseHyrox {
  id: string
  nom: string
  lieu: string | null
  /** Jour de la course, yyyy-MM-dd ; null tant qu'aucune course n'est prévue. */
  date: string | null
  categorie: CategorieHyroxDb
  genre: GenreHyroxDb
  objectifS: number | null
  resultatS: number | null
  repartitionJson: string | null
  createdAt: string
}

export interface SaisieCourseHyrox {
  nom: string
  lieu?: string | null
  date?: string | null
  categorie: CategorieHyroxDb
  genre: GenreHyroxDb
  objectifS?: number | null
  resultatS?: number | null
  repartitionJson?: string | null
}

export interface SimulationHyrox {
  id: string
  courseId: string | null
  forme: FormeSimulationDb
  categorie: CategorieHyroxDb
  genre: GenreHyroxDb
  /** Horodatage ISO UTC du départ. */
  debutAt: string
  statut: StatutSimulation
  totalS: number | null
  reference: boolean
  notes: string | null
  createdAt: string
}

export interface SegmentHyrox {
  id: string
  simulationId: string
  rang: number
  type: 'course' | 'station'
  station: string | null
  cibleS: number | null
  reelS: number | null
  chargeLabel: string | null
}

export interface SegmentAPlanifier {
  rang: number
  type: 'course' | 'station'
  station: string | null
  cibleS: number | null
  chargeLabel: string | null
}

export class ErreurHyrox extends Error {
  readonly code: 'introuvable' | 'invalide'
  constructor(code: 'introuvable' | 'invalide', message: string) {
    super(message)
    this.name = 'ErreurHyrox'
    this.code = code
  }
}

const invalide = (message: string): never => {
  throw new ErreurHyrox('invalide', message)
}
const longueur = (texte: string) => Array.from(texte).length
const nettoyer = (v: string | null | undefined) => (v?.trim() ? v.trim() : null)
const num = (v: unknown): number | null => (v == null ? null : Number(v))
const txt = (v: unknown): string | null => (v == null ? null : String(v))

function dureeValide(libelle: string, v: number | null | undefined): number | null {
  if (v == null) return null
  if (!Number.isInteger(v) || v < 0 || v > LIMITES_HYROX.dureeS) return invalide(`${libelle} doit être un entier de secondes entre 0 et ${LIMITES_HYROX.dureeS}.`)
  return v
}

function validerCourse(s: SaisieCourseHyrox) {
  const nom = nettoyer(s.nom)
  if (nom === null) return invalide('Donnez un nom à l’objectif.')
  if (longueur(nom) > LIMITES_HYROX.nom) return invalide(`Le nom est trop long (${LIMITES_HYROX.nom} caractères au plus).`)
  const lieu = nettoyer(s.lieu)
  if (lieu !== null && longueur(lieu) > LIMITES_HYROX.lieu) return invalide('Le lieu est trop long.')
  const date = nettoyer(s.date)
  if (date !== null && !dateIsoValide(date)) return invalide('Date invalide : choisissez une date réelle, ou laissez vide.')
  if (!['open', 'pro'].includes(s.categorie)) return invalide('Catégorie inconnue.')
  if (!['homme', 'femme'].includes(s.genre)) return invalide('Genre inconnu.')
  const repartitionJson = nettoyer(s.repartitionJson)
  if (repartitionJson !== null && longueur(repartitionJson) > LIMITES_HYROX.repartition) return invalide('La répartition est trop longue.')
  return {
    nom, lieu, date, categorie: s.categorie, genre: s.genre,
    objectifS: dureeValide('Le temps visé', s.objectifS), resultatS: dureeValide('Le résultat', s.resultatS), repartitionJson,
  }
}

const mapCourse = (l: Ligne): CourseHyrox => ({
  id: String(l.id),
  nom: String(l.nom ?? ''),
  lieu: txt(l.lieu),
  date: txt(l.date),
  categorie: l.categorie === 'pro' ? 'pro' : 'open',
  genre: l.genre === 'femme' ? 'femme' : 'homme',
  objectifS: num(l.objectif_s),
  resultatS: num(l.resultat_s),
  repartitionJson: txt(l.repartition_json),
  createdAt: String(l.created_at ?? ''),
})

const mapSimulation = (l: Ligne): SimulationHyrox => ({
  id: String(l.id),
  courseId: txt(l.course_id),
  forme: l.forme === 'partielle' || l.forme === 'station' ? l.forme : 'complete',
  categorie: l.categorie === 'pro' ? 'pro' : 'open',
  genre: l.genre === 'femme' ? 'femme' : 'homme',
  debutAt: String(l.debut_at ?? ''),
  statut: l.statut === 'terminee' || l.statut === 'abandonnee' ? l.statut : 'en_cours',
  totalS: num(l.total_s),
  reference: Number(l.reference) === 1,
  notes: txt(l.notes),
  createdAt: String(l.created_at ?? ''),
})

const mapSegment = (l: Ligne): SegmentHyrox => ({
  id: String(l.id),
  simulationId: String(l.simulation_id),
  rang: Number(l.rang),
  type: l.type === 'station' ? 'station' : 'course',
  station: txt(l.station),
  cibleS: num(l.cible_s),
  reelS: num(l.reel_s),
  chargeLabel: txt(l.charge_label),
})

// ── Objectif ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Objectif actif : le plus récemment créé. Il n'y en a qu'un à la fois dans l'interface. */
export async function lireObjectifHyrox(db: DbLecture): Promise<CourseHyrox | null> {
  const l = await db.getOptional<Ligne>('SELECT * FROM hyrox_courses WHERE deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1')
  return l ? mapCourse(l) : null
}

export async function lireCourseHyrox(db: DbLecture, id: string): Promise<CourseHyrox | null> {
  const l = await db.getOptional<Ligne>('SELECT * FROM hyrox_courses WHERE id = ? AND deleted_at IS NULL', [id])
  return l ? mapCourse(l) : null
}

const COLONNES_COURSE = ['nom', 'lieu', 'date', 'categorie', 'genre', 'objectif_s', 'resultat_s', 'repartition_json'] as const
const valeursCourse = (v: ReturnType<typeof validerCourse>) => [v.nom, v.lieu, v.date, v.categorie, v.genre, v.objectifS, v.resultatS, v.repartitionJson]

// `user_id` n'est pas écrit : le serveur le remplit avec auth.uid(), comme pour les autres tables.
export async function creerCourseHyrox(db: Db, saisie: SaisieCourseHyrox): Promise<string> {
  const v = validerCourse(saisie)
  const id = newId()
  const maintenant = new Date().toISOString()
  await db.execute(
    `INSERT INTO hyrox_courses (id, ${COLONNES_COURSE.join(', ')}, created_at, updated_at) VALUES (?, ${COLONNES_COURSE.map(() => '?').join(', ')}, ?, ?)`,
    [id, ...valeursCourse(v), maintenant, maintenant],
  )
  return id
}

export async function modifierCourseHyrox(db: Db, id: string, saisie: SaisieCourseHyrox): Promise<void> {
  const v = validerCourse(saisie)
  await db.writeTransaction(async (tx) => {
    if (!(await lireCourseHyrox(tx, id))) throw new ErreurHyrox('introuvable', 'Objectif introuvable.')
    await tx.execute(`UPDATE hyrox_courses SET ${COLONNES_COURSE.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ? AND deleted_at IS NULL`, [...valeursCourse(v), new Date().toISOString(), id])
  })
}

export async function supprimerCourseHyrox(db: Db, id: string): Promise<void> {
  await db.writeTransaction(async (tx) => {
    if (!(await lireCourseHyrox(tx, id))) throw new ErreurHyrox('introuvable', 'Objectif introuvable.')
    const maintenant = new Date().toISOString()
    await tx.execute('UPDATE hyrox_courses SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [maintenant, maintenant, id])
  })
}

// ── Simulations ───────────────────────────────────────────────────────────────────────────────────────────────────────

export interface DepartSimulation {
  courseId?: string | null
  forme: FormeSimulationDb
  categorie: CategorieHyroxDb
  genre: GenreHyroxDb
  segments: readonly SegmentAPlanifier[]
  /** Horodatage ISO UTC du départ ; maintenant par défaut. */
  debutAt?: string
}

/** Crée la simulation (en cours) et tous ses segments, encore sans temps réel. */
export async function demarrerSimulation(db: Db, depart: DepartSimulation): Promise<string> {
  if (depart.segments.length === 0 || depart.segments.length > 16) return invalide('Une simulation compte de 1 à 16 segments.')
  const id = newId()
  const maintenant = new Date().toISOString()
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO hyrox_simulations (id, course_id, forme, categorie, genre, debut_at, statut, reference, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'en_cours', 0, ?, ?)`,
      [id, depart.courseId ?? null, depart.forme, depart.categorie, depart.genre, depart.debutAt ?? maintenant, maintenant, maintenant],
    )
    for (const s of depart.segments) {
      if (!Number.isInteger(s.rang) || s.rang < 1 || s.rang > 16) return invalide('Rang de segment invalide.')
      await tx.execute(
        `INSERT INTO hyrox_segments (id, simulation_id, rang, type, station, cible_s, charge_label, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId(), id, s.rang, s.type, s.station, dureeValide('La cible', s.cibleS), nettoyer(s.chargeLabel), maintenant, maintenant],
      )
    }
  })
  return id
}

export async function lireSimulation(db: DbLecture, id: string): Promise<SimulationHyrox | null> {
  const l = await db.getOptional<Ligne>('SELECT * FROM hyrox_simulations WHERE id = ? AND deleted_at IS NULL', [id])
  return l ? mapSimulation(l) : null
}

/** Simulations vivantes, la plus récente d'abord. */
export async function lireSimulations(db: DbLecture): Promise<SimulationHyrox[]> {
  return (await db.getAll<Ligne>('SELECT * FROM hyrox_simulations WHERE deleted_at IS NULL ORDER BY debut_at DESC, id DESC')).map(mapSimulation)
}

export async function lireSimulationEnCours(db: DbLecture): Promise<SimulationHyrox | null> {
  const l = await db.getOptional<Ligne>("SELECT * FROM hyrox_simulations WHERE deleted_at IS NULL AND statut = 'en_cours' ORDER BY debut_at DESC, id DESC LIMIT 1")
  return l ? mapSimulation(l) : null
}

export async function lireSegments(db: DbLecture, simulationId: string): Promise<SegmentHyrox[]> {
  return (await db.getAll<Ligne>('SELECT * FROM hyrox_segments WHERE simulation_id = ? AND deleted_at IS NULL ORDER BY rang', [simulationId])).map(mapSegment)
}

/** Segments chronométrés de toutes les simulations terminées ou abandonnées (pour les records). */
export async function lireSegmentsMesures(db: DbLecture): Promise<SegmentHyrox[]> {
  const lignes = await db.getAll<Ligne>(
    `SELECT g.* FROM hyrox_segments g JOIN hyrox_simulations s ON s.id = g.simulation_id
     WHERE g.deleted_at IS NULL AND s.deleted_at IS NULL AND s.statut IN ('terminee', 'abandonnee') AND g.reel_s IS NOT NULL ORDER BY s.debut_at, g.rang`,
  )
  return lignes.map(mapSegment)
}

/** Enregistre le temps réel d'un segment (en secondes). */
export async function enregistrerSegment(db: Db, simulationId: string, rang: number, reelS: number): Promise<void> {
  const reel = dureeValide('Le temps du segment', Math.round(reelS))
  await db.writeTransaction(async (tx) => {
    const sim = await lireSimulation(tx, simulationId)
    if (!sim) throw new ErreurHyrox('introuvable', 'Simulation introuvable.')
    await tx.execute('UPDATE hyrox_segments SET reel_s = ?, updated_at = ? WHERE simulation_id = ? AND rang = ? AND deleted_at IS NULL', [reel, new Date().toISOString(), simulationId, rang])
  })
}

/** Clôt la simulation : le total est la somme des temps des segments chronométrés. */
export async function cloreSimulation(db: Db, simulationId: string, statut: 'terminee' | 'abandonnee'): Promise<void> {
  await db.writeTransaction(async (tx) => {
    if (!(await lireSimulation(tx, simulationId))) throw new ErreurHyrox('introuvable', 'Simulation introuvable.')
    const somme = await tx.getOptional<Ligne>('SELECT COALESCE(SUM(reel_s), 0) AS total FROM hyrox_segments WHERE simulation_id = ? AND deleted_at IS NULL AND reel_s IS NOT NULL', [simulationId])
    await tx.execute('UPDATE hyrox_simulations SET statut = ?, total_s = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [statut, Number(somme?.total ?? 0), new Date().toISOString(), simulationId])
  })
}

/** Une seule référence à la fois : la désigner retire la précédente. */
export async function definirReference(db: Db, simulationId: string, reference: boolean): Promise<void> {
  await db.writeTransaction(async (tx) => {
    if (!(await lireSimulation(tx, simulationId))) throw new ErreurHyrox('introuvable', 'Simulation introuvable.')
    const maintenant = new Date().toISOString()
    if (reference) await tx.execute('UPDATE hyrox_simulations SET reference = 0, updated_at = ? WHERE reference = 1 AND deleted_at IS NULL AND id <> ?', [maintenant, simulationId])
    await tx.execute('UPDATE hyrox_simulations SET reference = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [reference ? 1 : 0, maintenant, simulationId])
  })
}

export async function modifierNotesSimulation(db: Db, simulationId: string, notes: string): Promise<void> {
  const n = nettoyer(notes)
  if (n !== null && longueur(n) > LIMITES_HYROX.notes) return invalide(`Les notes sont trop longues (${LIMITES_HYROX.notes} caractères au plus).`)
  await db.writeTransaction(async (tx) => {
    if (!(await lireSimulation(tx, simulationId))) throw new ErreurHyrox('introuvable', 'Simulation introuvable.')
    await tx.execute('UPDATE hyrox_simulations SET notes = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [n, new Date().toISOString(), simulationId])
  })
}

/** Suppression logique de la simulation et de ses segments. */
export async function supprimerSimulation(db: Db, simulationId: string): Promise<void> {
  await db.writeTransaction(async (tx) => {
    if (!(await lireSimulation(tx, simulationId))) throw new ErreurHyrox('introuvable', 'Simulation introuvable.')
    const maintenant = new Date().toISOString()
    await tx.execute('UPDATE hyrox_segments SET deleted_at = ?, updated_at = ? WHERE simulation_id = ? AND deleted_at IS NULL', [maintenant, maintenant, simulationId])
    await tx.execute('UPDATE hyrox_simulations SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [maintenant, maintenant, simulationId])
  })
}
