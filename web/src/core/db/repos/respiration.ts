import { dateIsoValide } from '../../common/dates'
import type { Db, DbLecture } from '../Db'
import { newId } from '../ids'
import type { Ligne } from './mappers'

// Module Respiration (migration 0009) : méthodes personnalisées et historique des séances terminées. Les quatre méthodes
// intégrées vivent dans le code (features/respiration/methodes.ts), pas en base. Aucune statistique ne lit ces tables.

export const TABLES_RESPIRATION = { methodes: 'methodes_respiration', seances: 'seances_respiration' } as const

// Mêmes bornes que les contraintes SQL de la migration 0009 (un rejet SQL 23514 est classé « définitif » par le
// connecteur de synchro : la ligne locale serait abandonnée en silence, d'où la validation côté client).
// `cyclesDefaut` (méthode) : 120 au plus ; `cyclesSeance` : une séance de 90 min sur une méthode rapide dépasse 120 cycles.
export const LIMITES_RESPIRATION = { nom: 100, emoji: 16, phaseSec: 60, cyclesDefaut: 120, cyclesSeance: 1000, dureeSec: 86_400 } as const

export interface MethodePerso {
  id: string
  nom: string
  emoji: string
  inspireSec: number
  /** 0 = pas de rétention poumons pleins. */
  retentionPleineSec: number
  expireSec: number
  /** 0 = pas de rétention poumons vides. */
  retentionVideSec: number
  cyclesDefaut: number
}

export type SaisieMethode = Omit<MethodePerso, 'id'>

export interface SeanceRespiration {
  id: string
  /** Méthode intégrée (« 4_7_8 ») ou id d'une méthode personnalisée (peut avoir été supprimée depuis). */
  methodeId: string
  /** Nom de la méthode au moment de la séance. */
  methodeNom: string
  cycles: number
  dureeSec: number
  /** Jour au format yyyy-MM-dd. */
  date: string
}

export interface SaisieSeanceRespiration extends Omit<SeanceRespiration, 'id'> {
  /** Identifiant imposé ; sinon un identifiant aléatoire est créé. */
  id?: string
}

export type CodeErreurRespiration = 'introuvable' | 'invalide'

// Erreur destinée à l'utilisateur (message en français). `code` permet à l'appelant de choisir son propre message.
export class ErreurRespiration extends Error {
  readonly code: CodeErreurRespiration
  constructor(code: CodeErreurRespiration, message: string) {
    super(message)
    this.name = 'ErreurRespiration'
    this.code = code
  }
}

const invalide = (message: string): never => {
  throw new ErreurRespiration('invalide', message)
}

// Longueur en caractères (comme char_length de Postgres), pas en unités UTF-16.
const longueur = (texte: string) => Array.from(texte).length

function texteBorne(libelle: string, valeur: string, max: number): string {
  const texte = valeur.trim()
  if (texte === '') return invalide(`${libelle} est obligatoire.`)
  if (longueur(texte) > max) return invalide(`${libelle} est trop long (${max} caractères au plus).`)
  return texte
}

function entierBorne(libelle: string, valeur: number, min: number, max: number): number {
  if (!Number.isInteger(valeur) || valeur < min || valeur > max) return invalide(`${libelle} doit être un entier entre ${min} et ${max}.`)
  return valeur
}

function validerMethode(saisie: SaisieMethode): SaisieMethode {
  const { phaseSec, cyclesDefaut } = LIMITES_RESPIRATION
  return {
    nom: texteBorne('Le nom', saisie.nom, LIMITES_RESPIRATION.nom),
    emoji: texteBorne("L'emoji", saisie.emoji, LIMITES_RESPIRATION.emoji),
    inspireSec: entierBorne("La durée d'inspiration", saisie.inspireSec, 1, phaseSec),
    retentionPleineSec: entierBorne('La rétention poumons pleins', saisie.retentionPleineSec, 0, phaseSec),
    expireSec: entierBorne("La durée d'expiration", saisie.expireSec, 1, phaseSec),
    retentionVideSec: entierBorne('La rétention poumons vides', saisie.retentionVideSec, 0, phaseSec),
    cyclesDefaut: entierBorne('Le nombre de cycles', saisie.cyclesDefaut, 1, cyclesDefaut),
  }
}

function mapMethode(l: Ligne): MethodePerso {
  return {
    id: String(l.id),
    nom: String(l.nom ?? ''),
    emoji: String(l.emoji ?? ''),
    inspireSec: Number(l.inspire_sec ?? 0),
    retentionPleineSec: Number(l.retention_pleine_sec ?? 0),
    expireSec: Number(l.expire_sec ?? 0),
    retentionVideSec: Number(l.retention_vide_sec ?? 0),
    cyclesDefaut: Number(l.cycles_defaut ?? 1),
  }
}

function mapSeance(l: Ligne): SeanceRespiration {
  return {
    id: String(l.id),
    methodeId: String(l.methode_id ?? ''),
    methodeNom: String(l.methode_nom ?? ''),
    cycles: Number(l.cycles ?? 0),
    dureeSec: Number(l.duree_sec ?? 0),
    date: String(l.date ?? ''),
  }
}

// ── Méthodes personnalisées ─────────────────────────────────────────────────────────────────────────────────────

// Méthodes vivantes, dans l'ordre de création.
export async function lireMethodes(db: DbLecture): Promise<MethodePerso[]> {
  const lignes = await db.getAll<Ligne>('SELECT * FROM methodes_respiration WHERE deleted_at IS NULL ORDER BY created_at, id')
  return lignes.map(mapMethode)
}

export async function lireMethode(db: DbLecture, id: string): Promise<MethodePerso | null> {
  const ligne = await db.getOptional<Ligne>('SELECT * FROM methodes_respiration WHERE id = ? AND deleted_at IS NULL', [id])
  return ligne ? mapMethode(ligne) : null
}

// `user_id` n'est pas écrit : le serveur le remplit avec auth.uid(), comme pour les autres tables.
export async function creerMethode(db: Db, saisie: SaisieMethode): Promise<string> {
  const m = validerMethode(saisie)
  const id = newId()
  const maintenant = new Date().toISOString()
  await db.execute(
    `INSERT INTO methodes_respiration
       (id, nom, emoji, inspire_sec, retention_pleine_sec, expire_sec, retention_vide_sec, cycles_defaut, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, m.nom, m.emoji, m.inspireSec, m.retentionPleineSec, m.expireSec, m.retentionVideSec, m.cyclesDefaut, maintenant, maintenant],
  )
  return id
}

export async function modifierMethode(db: Db, id: string, saisie: SaisieMethode): Promise<void> {
  const m = validerMethode(saisie)
  await db.writeTransaction(async (tx) => {
    if (!(await lireMethode(tx, id))) throw new ErreurRespiration('introuvable', 'Méthode introuvable.')
    await tx.execute(
      `UPDATE methodes_respiration
         SET nom = ?, emoji = ?, inspire_sec = ?, retention_pleine_sec = ?, expire_sec = ?, retention_vide_sec = ?,
             cycles_defaut = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [m.nom, m.emoji, m.inspireSec, m.retentionPleineSec, m.expireSec, m.retentionVideSec, m.cyclesDefaut, new Date().toISOString(), id],
    )
  })
}

// Suppression logique (tombstone synchronisable), jamais un DELETE. L'historique de la méthode est conservé.
export async function supprimerMethode(db: Db, id: string): Promise<void> {
  await db.writeTransaction(async (tx) => {
    if (!(await lireMethode(tx, id))) throw new ErreurRespiration('introuvable', 'Méthode introuvable.')
    const maintenant = new Date().toISOString()
    await tx.execute('UPDATE methodes_respiration SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [
      maintenant, maintenant, id,
    ])
  })
}

// ── Historique ──────────────────────────────────────────────────────────────────────────────────────────────────

// Séances vivantes, les plus récentes d'abord (date, puis instant d'enregistrement), limitées.
export async function lireSeances(db: DbLecture, limite: number): Promise<SeanceRespiration[]> {
  const lignes = await db.getAll<Ligne>(
    'SELECT * FROM seances_respiration WHERE deleted_at IS NULL ORDER BY date DESC, created_at DESC, id DESC LIMIT ?',
    [limite],
  )
  return lignes.map(mapSeance)
}

export async function enregistrerSeance(db: Db, saisie: SaisieSeanceRespiration): Promise<string> {
  const methodeId = texteBorne("L'identifiant de la méthode", saisie.methodeId, 100)
  const methodeNom = texteBorne('Le nom de la méthode', saisie.methodeNom, LIMITES_RESPIRATION.nom)
  const cycles = entierBorne('Le nombre de cycles', saisie.cycles, 1, LIMITES_RESPIRATION.cyclesSeance)
  const dureeSec = entierBorne('La durée', saisie.dureeSec, 1, LIMITES_RESPIRATION.dureeSec)
  if (!dateIsoValide(saisie.date)) invalide('Date invalide.')
  const id = saisie.id ?? newId()
  const maintenant = new Date().toISOString()
  await db.execute(
    `INSERT INTO seances_respiration (id, methode_id, methode_nom, cycles, duree_sec, date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, methodeId, methodeNom, cycles, dureeSec, saisie.date, maintenant, maintenant],
  )
  return id
}

export async function supprimerSeance(db: Db, id: string): Promise<void> {
  await db.writeTransaction(async (tx) => {
    const ligne = await tx.getOptional<Ligne>('SELECT id FROM seances_respiration WHERE id = ? AND deleted_at IS NULL', [id])
    if (!ligne) throw new ErreurRespiration('introuvable', 'Séance introuvable.')
    const maintenant = new Date().toISOString()
    await tx.execute('UPDATE seances_respiration SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [
      maintenant, maintenant, id,
    ])
  })
}
