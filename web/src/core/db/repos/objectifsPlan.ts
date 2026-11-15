import { dateIsoValide } from '../../common/dates'
import type { Db, DbLecture } from '../Db'
import { deterministicId, newId } from '../ids'
import type { Ligne } from './mappers'

// Objectifs et jalons des plans d'endurance (migration 0014). Les jalons inscrits dans les séances de cardio restent la source du
// plan : cette table accueille les objectifs saisis à la main et le résultat d'un jalon.

export const TABLE_OBJECTIFS_PLAN = 'objectifs_plan'

export type DisciplineObjectif = 'course' | 'velo' | 'hyrox'
export type PrioriteObjectif = 'A' | 'B' | 'C'
export type StatutObjectif = 'prevu' | 'fait' | 'abandonne'

export const DISCIPLINES: readonly DisciplineObjectif[] = ['course', 'velo', 'hyrox']
export const PRIORITES: readonly PrioriteObjectif[] = ['A', 'B', 'C']

// Mêmes bornes que les contraintes SQL de la migration 0014 (un rejet 23514 serait classé « définitif » par le connecteur de synchro).
export const LIMITES_OBJECTIF = { nom: 200, notes: 2000, distanceM: 10_000_000, dureeS: 604_800 } as const

export interface ObjectifPlan {
  id: string
  nom: string
  discipline: DisciplineObjectif
  /** Jour de l'échéance, yyyy-MM-dd. */
  date: string
  distanceM: number | null
  /** Temps visé en secondes. */
  cibleS: number | null
  priorite: PrioriteObjectif
  statut: StatutObjectif
  /** Temps réel en secondes, après la course. */
  resultatS: number | null
  /** Séance de cardio-jalon dont l'objectif reprend le jalon. */
  seanceId: string | null
  notes: string | null
  createdAt: string
}

export interface SaisieObjectif {
  id?: string
  nom: string
  discipline: DisciplineObjectif
  date: string
  distanceM?: number | null
  cibleS?: number | null
  priorite?: PrioriteObjectif
  statut?: StatutObjectif
  resultatS?: number | null
  seanceId?: string | null
  notes?: string | null
}

export class ErreurObjectif extends Error {
  readonly code: 'introuvable' | 'invalide'
  constructor(code: 'introuvable' | 'invalide', message: string) {
    super(message)
    this.name = 'ErreurObjectif'
    this.code = code
  }
}

const invalide = (message: string): never => {
  throw new ErreurObjectif('invalide', message)
}

const longueur = (texte: string) => Array.from(texte).length
const nettoyer = (v: string | null | undefined) => (v?.trim() ? v.trim() : null)

function entierBorne(libelle: string, v: number | null | undefined, max: number): number | null {
  if (v == null) return null
  if (!Number.isInteger(v) || v < 0 || v > max) return invalide(`${libelle} doit être un entier entre 0 et ${max}.`)
  return v
}

function valider(s: SaisieObjectif) {
  const nom = nettoyer(s.nom)
  if (nom === null) return invalide('Donnez un nom à l’objectif.')
  if (longueur(nom) > LIMITES_OBJECTIF.nom) return invalide(`Le nom est trop long (${LIMITES_OBJECTIF.nom} caractères au plus).`)
  if (!DISCIPLINES.includes(s.discipline)) return invalide('Discipline inconnue.')
  if (!dateIsoValide(s.date)) return invalide('Date invalide : choisissez une date réelle.')
  const priorite = s.priorite ?? 'B'
  if (!PRIORITES.includes(priorite)) return invalide('Priorité inconnue.')
  const statut = s.statut ?? 'prevu'
  if (!['prevu', 'fait', 'abandonne'].includes(statut)) return invalide('Statut inconnu.')
  const notes = nettoyer(s.notes)
  if (notes !== null && longueur(notes) > LIMITES_OBJECTIF.notes) return invalide(`Les notes sont trop longues (${LIMITES_OBJECTIF.notes} caractères au plus).`)
  let distanceM: number | null = null
  if (s.distanceM != null) {
    if (!Number.isFinite(s.distanceM) || s.distanceM < 0 || s.distanceM > LIMITES_OBJECTIF.distanceM) return invalide('La distance est hors limites.')
    distanceM = s.distanceM
  }
  return {
    nom, discipline: s.discipline, date: s.date, distanceM,
    cibleS: entierBorne('Le temps visé', s.cibleS, LIMITES_OBJECTIF.dureeS), priorite, statut,
    resultatS: entierBorne('Le résultat', s.resultatS, LIMITES_OBJECTIF.dureeS), seanceId: nettoyer(s.seanceId), notes,
  }
}

const num = (v: unknown): number | null => (v == null ? null : Number(v))
const txt = (v: unknown): string | null => (v == null ? null : String(v))

function mapObjectifPlan(l: Ligne): ObjectifPlan {
  return {
    id: String(l.id),
    nom: String(l.nom ?? ''),
    discipline: l.discipline === 'velo' || l.discipline === 'hyrox' ? l.discipline : 'course',
    date: String(l.date ?? ''),
    distanceM: num(l.distance_m),
    cibleS: num(l.cible_s),
    priorite: l.priorite === 'A' || l.priorite === 'C' ? l.priorite : 'B',
    statut: l.statut === 'fait' || l.statut === 'abandonne' ? l.statut : 'prevu',
    resultatS: num(l.resultat_s),
    seanceId: txt(l.seance_id),
    notes: txt(l.notes),
    createdAt: String(l.created_at ?? ''),
  }
}

/** Objectifs vivants, par date croissante. */
export async function lireObjectifsPlan(db: DbLecture): Promise<ObjectifPlan[]> {
  const lignes = await db.getAll<Ligne>('SELECT * FROM objectifs_plan WHERE deleted_at IS NULL ORDER BY date, id')
  return lignes.map(mapObjectifPlan)
}

export async function lireObjectifPlan(db: DbLecture, id: string): Promise<ObjectifPlan | null> {
  const l = await db.getOptional<Ligne>('SELECT * FROM objectifs_plan WHERE id = ? AND deleted_at IS NULL', [id])
  return l ? mapObjectifPlan(l) : null
}

export async function lireObjectifDeSeance(db: DbLecture, seanceId: string): Promise<ObjectifPlan | null> {
  const l = await db.getOptional<Ligne>('SELECT * FROM objectifs_plan WHERE seance_id = ? AND deleted_at IS NULL ORDER BY date, id LIMIT 1', [seanceId])
  return l ? mapObjectifPlan(l) : null
}

/** Identifiant de l'objectif repris d'un jalon : stable d'un appareil à l'autre, donc sans doublon. */
export const idObjectifDeJalon = (userId: string, seanceId: string) => deterministicId(userId, `objectif-jalon|${seanceId}`)

const COLONNES = ['nom', 'discipline', 'date', 'distance_m', 'cible_s', 'priorite', 'statut', 'resultat_s', 'seance_id', 'notes'] as const
const valeurs = (v: ReturnType<typeof valider>) => [v.nom, v.discipline, v.date, v.distanceM, v.cibleS, v.priorite, v.statut, v.resultatS, v.seanceId, v.notes]

// `user_id` n'est pas écrit : le serveur le remplit avec auth.uid(), comme pour les autres tables.
export async function creerObjectifPlan(db: Db, saisie: SaisieObjectif): Promise<string> {
  const v = valider(saisie)
  const id = saisie.id ?? newId()
  const maintenant = new Date().toISOString()
  await db.execute(
    `INSERT INTO objectifs_plan (id, ${COLONNES.join(', ')}, created_at, updated_at) VALUES (?, ${COLONNES.map(() => '?').join(', ')}, ?, ?)`,
    [id, ...valeurs(v), maintenant, maintenant],
  )
  return id
}

/** Remplace tous les champs de l'objectif par ceux de la saisie. */
export async function modifierObjectifPlan(db: Db, id: string, saisie: SaisieObjectif): Promise<void> {
  const v = valider(saisie)
  await db.writeTransaction(async (tx) => {
    if (!(await lireObjectifPlan(tx, id))) throw new ErreurObjectif('introuvable', 'Objectif introuvable.')
    await tx.execute(`UPDATE objectifs_plan SET ${COLONNES.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ? AND deleted_at IS NULL`, [...valeurs(v), new Date().toISOString(), id])
  })
}

/** Suppression logique (tombstone synchronisable), jamais un DELETE. */
export async function supprimerObjectifPlan(db: Db, id: string): Promise<void> {
  await db.writeTransaction(async (tx) => {
    if (!(await lireObjectifPlan(tx, id))) throw new ErreurObjectif('introuvable', 'Objectif introuvable.')
    const maintenant = new Date().toISOString()
    await tx.execute('UPDATE objectifs_plan SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [maintenant, maintenant, id])
  })
}
