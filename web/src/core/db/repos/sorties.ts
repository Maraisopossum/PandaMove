import { dateIsoValide } from '../../common/dates'
import type { Db, DbLecture } from '../Db'
import { newId } from '../ids'
import type { Ligne } from './mappers'

// Sorties d'endurance RÉALISÉES, course et vélo (migration 0010). Distinct des séances PLANIFIÉES (seancesCardio.ts) :
// les statistiques d'endurance se calculent ici, jamais sur les séances planifiées. Aucune statistique de renforcement
// ne lit cette table.

export const TABLE_SORTIES = 'sorties'

export type Sport = 'course' | 'velo'
export type SourceSortie = 'manuel' | 'suunto' | 'mywoosh'

// Mêmes bornes que les contraintes SQL de la migration 0010 (un rejet SQL 23514 est classé « définitif » par le
// connecteur de synchro : la ligne locale serait abandonnée en silence, d'où la validation côté client).
export const LIMITES_SORTIE = {
  titre: 200,
  notes: 2000,
  lien: 2048,
  dureeS: 604_800,
  distanceM: 10_000_000,
  deniveleM: 20_000,
  fc: { min: 30, max: 260 },
  rpe: { min: 1, max: 10 },
  puissanceMoyW: 3000,
  puissanceMaxW: 5000,
  puissanceNormW: 3000,
  cadence: 300,
} as const

export interface Sortie {
  id: string
  sport: Sport
  /** Jour local au format yyyy-MM-dd. */
  date: string
  /** Instant de départ ISO (import de fichier), sinon null. */
  debutAt: string | null
  titre: string
  dureeS: number | null
  dureeDeplacementS: number | null
  distanceM: number | null
  denivelePosM: number | null
  deniveleNegM: number | null
  fcMoy: number | null
  fcMax: number | null
  rpe: number | null
  puissanceMoyW: number | null
  puissanceMaxW: number | null
  puissanceNormW: number | null
  cadenceMoy: number | null
  enSalle: boolean
  notes: string | null
  lien: string | null
  source: SourceSortie
  empreinte: string | null
  /** Séance planifiée (du même sport) dont cette sortie est le résultat. */
  seanceId: string | null
  createdAt: string
}

// Champs que l'utilisateur ou l'import fournit ; tout ce qui est facultatif peut être omis (enregistré à null).
export interface SaisieSortie {
  /** Identifiant imposé ; sinon un identifiant aléatoire est créé. */
  id?: string
  sport: Sport
  date: string
  /** Vide : « Course » ou « Sortie vélo » est utilisé. */
  titre?: string
  debutAt?: string | null
  dureeS?: number | null
  dureeDeplacementS?: number | null
  distanceM?: number | null
  denivelePosM?: number | null
  deniveleNegM?: number | null
  fcMoy?: number | null
  fcMax?: number | null
  rpe?: number | null
  puissanceMoyW?: number | null
  puissanceMaxW?: number | null
  puissanceNormW?: number | null
  cadenceMoy?: number | null
  enSalle?: boolean
  notes?: string | null
  lien?: string | null
  source?: SourceSortie
  empreinte?: string | null
  seanceId?: string | null
}

export type CodeErreurSortie = 'introuvable' | 'invalide'

// Erreur destinée à l'utilisateur (message en français). `code` permet à l'appelant de choisir son propre message.
export class ErreurSortie extends Error {
  readonly code: CodeErreurSortie
  constructor(code: CodeErreurSortie, message: string) {
    super(message)
    this.name = 'ErreurSortie'
    this.code = code
  }
}

const invalide = (message: string): never => {
  throw new ErreurSortie('invalide', message)
}

export const TITRE_PAR_DEFAUT: Record<Sport, string> = { course: 'Course', velo: 'Sortie vélo' }

// Longueur en caractères (comme char_length de Postgres), pas en unités UTF-16.
const longueur = (texte: string) => Array.from(texte).length

function nettoyer(valeur: string | null | undefined): string | null {
  const texte = valeur?.trim() ?? ''
  return texte === '' ? null : texte
}

function textePlafonne(libelle: string, valeur: string | null | undefined, max: number): string | null {
  const texte = nettoyer(valeur)
  if (texte !== null && longueur(texte) > max) return invalide(`${libelle} est trop long (${max} caractères au plus).`)
  return texte
}

// Nombre facultatif entre min et max ; `entier` impose un entier. null / undefined : champ absent.
function nombre(libelle: string, valeur: number | null | undefined, min: number, max: number, entier: boolean): number | null {
  if (valeur == null) return null
  if (!Number.isFinite(valeur) || valeur < min || valeur > max || (entier && !Number.isInteger(valeur))) {
    return invalide(`${libelle} doit être ${entier ? 'un entier' : 'un nombre'} entre ${min} et ${max}.`)
  }
  return valeur
}

function valider(saisie: SaisieSortie): Required<Omit<SaisieSortie, 'id'>> {
  if (saisie.sport !== 'course' && saisie.sport !== 'velo') return invalide('Le sport doit être « course » ou « vélo ».')
  if (!dateIsoValide(saisie.date)) return invalide('Date invalide : choisissez une date réelle.')
  const titre = textePlafonne('Le titre', saisie.titre, LIMITES_SORTIE.titre) ?? TITRE_PAR_DEFAUT[saisie.sport]
  const lien = textePlafonne('Le lien', saisie.lien, LIMITES_SORTIE.lien)
  // La validité complète d'une adresse (forme normalisée) relève de lienValide côté écran ; ici, seule la règle SQL.
  if (lien !== null && !lien.startsWith('https://')) return invalide('Le lien doit commencer par https://.')
  const { fc, rpe } = LIMITES_SORTIE
  const fcMoy = nombre('La fréquence cardiaque moyenne', saisie.fcMoy, fc.min, fc.max, true)
  const fcMax = nombre('La fréquence cardiaque maximale', saisie.fcMax, fc.min, fc.max, true)
  if (fcMoy !== null && fcMax !== null && fcMoy > fcMax) return invalide('La fréquence cardiaque moyenne dépasse la maximale.')
  const dureeS = nombre('La durée', saisie.dureeS, 0, LIMITES_SORTIE.dureeS, true)
  const dureeDeplacementS = nombre('La durée en mouvement', saisie.dureeDeplacementS, 0, LIMITES_SORTIE.dureeS, true)
  if (dureeS !== null && dureeDeplacementS !== null && dureeDeplacementS > dureeS) {
    return invalide('La durée en mouvement dépasse la durée totale.')
  }
  const source = saisie.source ?? 'manuel'
  if (source !== 'manuel' && source !== 'suunto' && source !== 'mywoosh') return invalide('Source inconnue.')
  return {
    sport: saisie.sport,
    date: saisie.date,
    titre,
    debutAt: nettoyer(saisie.debutAt),
    dureeS,
    dureeDeplacementS,
    distanceM: nombre('La distance', saisie.distanceM, 0, LIMITES_SORTIE.distanceM, false),
    denivelePosM: nombre('Le dénivelé positif', saisie.denivelePosM, 0, LIMITES_SORTIE.deniveleM, false),
    deniveleNegM: nombre('Le dénivelé négatif', saisie.deniveleNegM, 0, LIMITES_SORTIE.deniveleM, false),
    fcMoy,
    fcMax,
    rpe: nombre('Le RPE', saisie.rpe, rpe.min, rpe.max, true),
    puissanceMoyW: nombre('La puissance moyenne', saisie.puissanceMoyW, 0, LIMITES_SORTIE.puissanceMoyW, true),
    puissanceMaxW: nombre('La puissance maximale', saisie.puissanceMaxW, 0, LIMITES_SORTIE.puissanceMaxW, true),
    puissanceNormW: nombre('La puissance normalisée', saisie.puissanceNormW, 0, LIMITES_SORTIE.puissanceNormW, true),
    cadenceMoy: nombre('La cadence', saisie.cadenceMoy, 0, LIMITES_SORTIE.cadence, true),
    enSalle: saisie.enSalle ?? false,
    notes: textePlafonne('Les notes', saisie.notes, LIMITES_SORTIE.notes),
    lien,
    source,
    empreinte: textePlafonne("L'empreinte", saisie.empreinte, 200),
    seanceId: nettoyer(saisie.seanceId),
  }
}

const num = (v: unknown): number | null => (v == null ? null : Number(v))
const txt = (v: unknown): string | null => (v == null ? null : String(v))

function mapSortie(l: Ligne): Sortie {
  const sport: Sport = l.sport === 'velo' ? 'velo' : 'course'
  return {
    id: String(l.id),
    sport,
    date: String(l.date ?? ''),
    debutAt: txt(l.debut_at),
    titre: String(l.titre ?? ''),
    dureeS: num(l.duree_s),
    dureeDeplacementS: num(l.duree_deplacement_s),
    distanceM: num(l.distance_m),
    denivelePosM: num(l.denivele_pos_m),
    deniveleNegM: num(l.denivele_neg_m),
    fcMoy: num(l.fc_moy),
    fcMax: num(l.fc_max),
    rpe: num(l.rpe),
    puissanceMoyW: num(l.puissance_moy_w),
    puissanceMaxW: num(l.puissance_max_w),
    puissanceNormW: num(l.puissance_norm_w),
    cadenceMoy: num(l.cadence_moy),
    enSalle: l.en_salle === 1,
    notes: txt(l.notes),
    lien: txt(l.lien),
    source: l.source === 'suunto' || l.source === 'mywoosh' ? l.source : 'manuel',
    empreinte: txt(l.empreinte),
    seanceId: txt(sport === 'course' ? l.seance_course_id : l.seance_velo_id),
    createdAt: String(l.created_at ?? ''),
  }
}

// Colonnes écrites, dans l'ordre des paramètres (hors id, created_at, updated_at).
const COLONNES = [
  'sport', 'date', 'debut_at', 'duree_s', 'duree_deplacement_s', 'distance_m', 'denivele_pos_m', 'denivele_neg_m',
  'fc_moy', 'fc_max', 'rpe', 'puissance_moy_w', 'puissance_max_w', 'puissance_norm_w', 'cadence_moy', 'en_salle',
  'titre', 'notes', 'lien', 'source', 'empreinte', 'seance_course_id', 'seance_velo_id',
] as const

function valeurs(v: ReturnType<typeof valider>): unknown[] {
  return [
    v.sport, v.date, v.debutAt, v.dureeS, v.dureeDeplacementS, v.distanceM, v.denivelePosM, v.deniveleNegM,
    v.fcMoy, v.fcMax, v.rpe, v.puissanceMoyW, v.puissanceMaxW, v.puissanceNormW, v.cadenceMoy, v.enSalle ? 1 : 0,
    v.titre, v.notes, v.lien, v.source, v.empreinte,
    v.sport === 'course' ? v.seanceId : null,
    v.sport === 'velo' ? v.seanceId : null,
  ]
}

// ── Lecture ─────────────────────────────────────────────────────────────────────────────────────────────────────

// Sorties vivantes, les plus récentes d'abord (date, puis instant d'enregistrement). `sport` absent : les deux sports.
export async function lireSorties(db: DbLecture, options: { sport?: Sport; limite?: number } = {}): Promise<Sortie[]> {
  const filtre = options.sport ? 'AND sport = ?' : ''
  const params: unknown[] = options.sport ? [options.sport] : []
  let limite = ''
  if (options.limite !== undefined) {
    limite = 'LIMIT ?'
    params.push(options.limite)
  }
  const lignes = await db.getAll<Ligne>(
    `SELECT * FROM sorties WHERE deleted_at IS NULL ${filtre} ORDER BY date DESC, created_at DESC, id DESC ${limite}`,
    params,
  )
  return lignes.map(mapSortie)
}

export async function lireSortie(db: DbLecture, id: string): Promise<Sortie | null> {
  const ligne = await db.getOptional<Ligne>('SELECT * FROM sorties WHERE id = ? AND deleted_at IS NULL', [id])
  return ligne ? mapSortie(ligne) : null
}

// Sortie vivante portant cette empreinte (anti-doublon d'import), ou null.
export async function lireParEmpreinte(db: DbLecture, empreinte: string): Promise<Sortie | null> {
  const ligne = await db.getOptional<Ligne>('SELECT * FROM sorties WHERE empreinte = ? AND deleted_at IS NULL', [empreinte])
  return ligne ? mapSortie(ligne) : null
}

// ── Écriture ────────────────────────────────────────────────────────────────────────────────────────────────────

// `user_id` n'est pas écrit : le serveur le remplit avec auth.uid(), comme pour les autres tables.
export async function creerSortie(db: Db, saisie: SaisieSortie): Promise<string> {
  const v = valider(saisie)
  const id = saisie.id ?? newId()
  const maintenant = new Date().toISOString()
  await db.execute(
    `INSERT INTO sorties (id, ${COLONNES.join(', ')}, created_at, updated_at)
     VALUES (?, ${COLONNES.map(() => '?').join(', ')}, ?, ?)`,
    [id, ...valeurs(v), maintenant, maintenant],
  )
  return id
}

// Remplace tous les champs de la sortie par ceux de la saisie (le formulaire envoie toujours l'ensemble).
export async function modifierSortie(db: Db, id: string, saisie: SaisieSortie): Promise<void> {
  const v = valider(saisie)
  await db.writeTransaction(async (tx) => {
    if (!(await lireSortie(tx, id))) throw new ErreurSortie('introuvable', 'Sortie introuvable.')
    await tx.execute(`UPDATE sorties SET ${COLONNES.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ? AND deleted_at IS NULL`, [
      ...valeurs(v), new Date().toISOString(), id,
    ])
  })
}

// Suppression logique (tombstone synchronisable), jamais un DELETE.
export async function supprimerSortie(db: Db, id: string): Promise<void> {
  await db.writeTransaction(async (tx) => {
    if (!(await lireSortie(tx, id))) throw new ErreurSortie('introuvable', 'Sortie introuvable.')
    const maintenant = new Date().toISOString()
    await tx.execute('UPDATE sorties SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [maintenant, maintenant, id])
  })
}
