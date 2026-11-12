import { dateIsoValide } from '../../common/dates'
import type { Db, DbLecture, DbTx } from '../Db'
import { newId } from '../ids'
import type { Ligne } from './mappers'

// Séances de cardio (migration 0008) : course et vélo ont les mêmes colonnes et le même code. Aucune de ces
// tables n'est lue par les statistiques : valider une séance cardio ne change aucun calcul du renforcement.

export type GenreCardio = 'course' | 'velo'

// Liste blanche : le nom de table interpolé dans le SQL vient TOUJOURS d'ici, jamais d'un paramètre libre.
export const TABLES_CARDIO = { course: 'seances_course', velo: 'seances_velo' } as const

// Mêmes bornes que les contraintes SQL de la migration 0008 (un rejet SQL 23514 est classé « définitif » par le
// connecteur de synchro : la ligne locale serait abandonnée en silence, d'où la validation côté client).
export const LIMITES_CARDIO = { titre: 200, consigne: 2000, detail: 100, jalon: 100, lien: 2048 } as const

export interface SeanceCardio {
  id: string
  genre: GenreCardio
  /** Jour au format yyyy-MM-dd. */
  date: string
  titre: string
  consigne: string | null
  /** Texte « durée · zone » du programme, conservé tel quel (non découpé). */
  detail: string | null
  /** Simple mention d'affichage : n'a aucun effet. */
  optionnelle: boolean
  /** Non nul = séance-jalon (course importante) ; le texte est le libellé affiché avec le drapeau. */
  jalon: string | null
  lien: string | null
  isValidated: boolean
  /** Vraie si la séance est supprimée logiquement (lisible par identifiant seulement). */
  supprimee: boolean
  createdAt: string
}

export interface SaisieSeanceCardio {
  /** Identifiant imposé (import : identifiant déterministe). Sinon un identifiant aléatoire est créé. */
  id?: string
  /** Horodatage ISO de création imposé ; sinon l'instant présent. */
  createdAt?: string
  date: string
  titre: string
  consigne?: string | null
  detail?: string | null
  optionnelle?: boolean
  jalon?: string | null
  lien?: string | null
}

/** Champs modifiables d'une séance existante. La date et l'état validé ont leurs fonctions dédiées. */
export type ChampsSeanceCardio = Partial<Pick<SaisieSeanceCardio, 'titre' | 'consigne' | 'detail' | 'optionnelle' | 'jalon' | 'lien'>>

export type CodeErreurSeanceCardio = 'introuvable' | 'validee' | 'invalide'

// Erreur destinée à l'utilisateur (message en français). `code` permet à l'appelant de choisir son propre message.
export class ErreurSeanceCardio extends Error {
  readonly code: CodeErreurSeanceCardio
  constructor(code: CodeErreurSeanceCardio, message: string) {
    super(message)
    this.name = 'ErreurSeanceCardio'
    this.code = code
  }
}

function tableDe(genre: GenreCardio): string {
  if (!Object.prototype.hasOwnProperty.call(TABLES_CARDIO, genre)) throw new Error(`Genre cardio inconnu : ${String(genre)}`)
  return TABLES_CARDIO[genre]
}

const invalide = (message: string): never => {
  throw new ErreurSeanceCardio('invalide', message)
}

// Longueur en caractères (comme char_length de Postgres), pas en unités UTF-16.
const longueur = (texte: string) => Array.from(texte).length

function nettoyer(valeur: string | null | undefined): string | null {
  const texte = valeur?.trim() ?? ''
  return texte === '' ? null : texte
}

function validerTitre(valeur: string): string {
  const titre = valeur.trim()
  if (titre === '') return invalide('Le titre est obligatoire.')
  if (longueur(titre) > LIMITES_CARDIO.titre) return invalide(`Le titre est trop long (${LIMITES_CARDIO.titre} caractères au plus).`)
  return titre
}

const LIBELLES = { consigne: 'La consigne', detail: 'Le détail', jalon: 'Le jalon', lien: 'Le lien' } as const

function validerFacultatif(nom: keyof typeof LIBELLES, valeur: string | null | undefined): string | null {
  const texte = nettoyer(valeur)
  if (texte === null) return null
  if (longueur(texte) > LIMITES_CARDIO[nom]) return invalide(`${LIBELLES[nom]} est trop long (${LIMITES_CARDIO[nom]} caractères au plus).`)
  // La validité complète d'une adresse (forme normalisée) relève de lienValide ; ici, seule la règle SQL.
  if (nom === 'lien' && !texte.startsWith('https://')) return invalide('Le lien doit commencer par https://.')
  return texte
}

function validerDate(date: string): string {
  if (!dateIsoValide(date)) return invalide('Date invalide : choisissez une date réelle au format jj/mm/aaaa.')
  return date
}

const texteOuNull = (valeur: string | number | null | undefined) => (valeur == null ? null : String(valeur))

function mapSeanceCardio(genre: GenreCardio, l: Ligne): SeanceCardio {
  return {
    id: String(l.id),
    genre,
    date: String(l.date ?? ''),
    titre: String(l.titre ?? ''),
    consigne: texteOuNull(l.consigne),
    detail: texteOuNull(l.detail),
    optionnelle: l.optionnelle === 1,
    jalon: texteOuNull(l.jalon),
    lien: texteOuNull(l.lien),
    isValidated: l.is_validated === 1,
    supprimee: l.deleted_at != null,
    createdAt: String(l.created_at ?? ''),
  }
}

// Séances vivantes dont la date est dans [du, au] (bornes comprises), triées par date puis identifiant.
export async function lirePlage(db: DbLecture, genre: GenreCardio, du: string, au: string): Promise<SeanceCardio[]> {
  const table = tableDe(genre)
  const lignes = await db.getAll<Ligne>(
    `SELECT * FROM ${table} WHERE deleted_at IS NULL AND date >= ? AND date <= ? ORDER BY date, id`,
    [du, au],
  )
  return lignes.map((l) => mapSeanceCardio(genre, l))
}

// Prochaines séances : à partir d'aujourd'hui (compris), vivantes et non validées, triées, limitées.
export async function lireProchaines(db: DbLecture, genre: GenreCardio, aujourdhuiIso: string, limite: number): Promise<SeanceCardio[]> {
  const table = tableDe(genre)
  const lignes = await db.getAll<Ligne>(
    `SELECT * FROM ${table}
     WHERE deleted_at IS NULL AND COALESCE(is_validated, 0) = 0 AND date >= ? ORDER BY date, id LIMIT ?`,
    [aujourdhuiIso, limite],
  )
  return lignes.map((l) => mapSeanceCardio(genre, l))
}

// Une séance par identifiant, MÊME supprimée logiquement (l'import ne recrée jamais une séance supprimée).
// Renvoie null uniquement si la ligne n'a jamais existé.
export async function lireParId(db: DbLecture, genre: GenreCardio, id: string): Promise<SeanceCardio | null> {
  const table = tableDe(genre)
  const ligne = await db.getOptional<Ligne>(`SELECT * FROM ${table} WHERE id = ?`, [id])
  return ligne ? mapSeanceCardio(genre, ligne) : null
}

// Crée une séance (non validée) et renvoie son identifiant. Un seul INSERT : accepte aussi une transaction
// appelante (l'import insère toutes ses séances dans une seule transaction). `user_id` n'est pas écrit : le
// serveur le remplit avec auth.uid(), comme pour les instances de séance.
export async function creer(db: Db | DbTx, genre: GenreCardio, saisie: SaisieSeanceCardio): Promise<string> {
  const table = tableDe(genre)
  const date = validerDate(saisie.date)
  const titre = validerTitre(saisie.titre)
  const consigne = validerFacultatif('consigne', saisie.consigne)
  const detail = validerFacultatif('detail', saisie.detail)
  const jalon = validerFacultatif('jalon', saisie.jalon)
  const lien = validerFacultatif('lien', saisie.lien)
  const id = saisie.id ?? newId()
  const maintenant = new Date().toISOString()
  await db.execute(
    `INSERT INTO ${table}
       (id, titre, consigne, detail, date, optionnelle, jalon, lien, is_validated, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [id, titre, consigne, detail, date, saisie.optionnelle ? 1 : 0, jalon, lien, saisie.createdAt ?? maintenant, maintenant],
  )
  return id
}

// Rétablit une séance supprimée (suppression logique levée) avec le contenu de `saisie`, non validée. Sert à l'import du
// programme : une séance supprimée à la main ne revient pas à un import ordinaire, seulement à ce rétablissement explicite.
export async function retablir(db: Db | DbTx, genre: GenreCardio, id: string, saisie: SaisieSeanceCardio): Promise<void> {
  const table = tableDe(genre)
  await db.execute(
    `UPDATE ${table}
        SET titre = ?, consigne = ?, detail = ?, date = ?, optionnelle = ?, jalon = ?, lien = ?, is_validated = 0, deleted_at = NULL, updated_at = ?
      WHERE id = ? AND deleted_at IS NOT NULL`,
    [
      validerTitre(saisie.titre), validerFacultatif('consigne', saisie.consigne), validerFacultatif('detail', saisie.detail), validerDate(saisie.date),
      saisie.optionnelle ? 1 : 0, validerFacultatif('jalon', saisie.jalon), validerFacultatif('lien', saisie.lien), new Date().toISOString(), id,
    ],
  )
}

// Relit la séance DANS la transaction d'écriture : un état arrivé entre-temps (validation reçue par synchro)
// est ainsi vu au moment d'écrire, pas seulement à l'affichage.
async function lireVivante(tx: DbLecture, table: string, id: string): Promise<{ is_validated: number | null }> {
  const ligne = await tx.getOptional<{ is_validated: number | null }>(
    `SELECT is_validated FROM ${table} WHERE id = ? AND deleted_at IS NULL`,
    [id],
  )
  if (!ligne) throw new ErreurSeanceCardio('introuvable', 'Séance introuvable.')
  return ligne
}

const CHAMPS_MODIFIABLES = ['titre', 'consigne', 'detail', 'optionnelle', 'jalon', 'lien'] as const

// Modifie les champs fournis (les autres sont conservés). La date et l'état validé ne changent pas ici.
// Une séance validée reste modifiable. Les champs sont validés avant d'ouvrir la transaction.
export async function modifier(db: Db, genre: GenreCardio, id: string, champs: ChampsSeanceCardio): Promise<void> {
  const table = tableDe(genre)
  const valeurs: Record<string, string | number | null> = {}
  for (const nom of CHAMPS_MODIFIABLES) {
    const brut = champs[nom]
    if (brut === undefined) continue
    if (nom === 'titre') valeurs.titre = validerTitre(brut as string)
    else if (nom === 'optionnelle') valeurs.optionnelle = brut ? 1 : 0
    else valeurs[nom] = validerFacultatif(nom, brut as string | null)
  }
  await db.writeTransaction(async (tx) => {
    await lireVivante(tx, table, id)
    const noms = Object.keys(valeurs)
    if (noms.length === 0) return
    await tx.execute(
      `UPDATE ${table} SET ${noms.map((n) => `${n} = ?`).join(', ')}, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
      [...noms.map((n) => valeurs[n]), new Date().toISOString(), id],
    )
  })
}

// Déplace une séance. Une séance validée ne se déplace pas (même règle que le renforcement, par cohérence
// d'interface) : il faut d'abord la dévalider. Les contrôles précèdent l'écriture.
export async function deplacer(db: Db, genre: GenreCardio, id: string, date: string): Promise<void> {
  const table = tableDe(genre)
  validerDate(date)
  await db.writeTransaction(async (tx) => {
    const ligne = await lireVivante(tx, table, id)
    if (ligne.is_validated === 1) throw new ErreurSeanceCardio('validee', 'Dévalidez la séance pour la déplacer.')
    await tx.execute(`UPDATE ${table} SET date = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`, [
      date, new Date().toISOString(), id,
    ])
  })
}

// Valide ou dévalide une séance (sans date de validation : la date de la séance ne change pas).
export async function definirValidation(db: Db, genre: GenreCardio, id: string, validee: boolean): Promise<void> {
  const table = tableDe(genre)
  await db.writeTransaction(async (tx) => {
    await lireVivante(tx, table, id)
    await tx.execute(`UPDATE ${table} SET is_validated = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`, [
      validee ? 1 : 0, new Date().toISOString(), id,
    ])
  })
}

// Nombre de séances de cardio programmées, c'est-à-dire vivantes et non validées (course et vélo, toutes dates).
export async function compterProgrammees(db: DbLecture): Promise<number> {
  let total = 0
  for (const genre of ['course', 'velo'] as const) {
    const l = await db.getOptional<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tableDe(genre)} WHERE deleted_at IS NULL AND is_validated = 0`)
    total += Number(l?.n ?? 0)
  }
  return total
}

// Supprime (suppression logique) toutes les séances de cardio programmées, course et vélo, en une transaction.
// Les séances validées (faites) sont conservées. Renvoie le nombre de séances supprimées.
export async function supprimerProgrammees(db: Db): Promise<number> {
  return db.writeTransaction(async (tx) => {
    const maintenant = new Date().toISOString()
    let total = 0
    for (const genre of ['course', 'velo'] as const) {
      const table = tableDe(genre)
      const l = await tx.getOptional<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE deleted_at IS NULL AND is_validated = 0`)
      total += Number(l?.n ?? 0)
      await tx.execute(`UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL AND is_validated = 0`, [maintenant, maintenant])
    }
    return total
  })
}

// Suppression logique (tombstone synchronisable), jamais un DELETE. Une séance validée peut être supprimée.
export async function supprimer(db: Db, genre: GenreCardio, id: string): Promise<void> {
  const table = tableDe(genre)
  await db.writeTransaction(async (tx) => {
    await lireVivante(tx, table, id)
    const maintenant = new Date().toISOString()
    await tx.execute(`UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`, [
      maintenant, maintenant, id,
    ])
  })
}
