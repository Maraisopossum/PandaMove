import { AppSchema } from '../schema'
import type { Db, DbLecture } from '../Db'
import type { BlocSeance, ExerciceSeance, Seance } from '../types'
import { mapBloc, mapExerciceSeance, mapSeance, type Ligne } from './mappers'

// Séances « modèle » (non supprimées, archivées comprises : l'écran filtre selon son besoin).
export async function listSeanceTemplates(db: Db): Promise<Seance[]> {
  const lignes = await db.getAll<Ligne>('SELECT * FROM seances WHERE deleted_at IS NULL ORDER BY nom')
  return lignes.map(mapSeance)
}

// Arbre d'une séance. instanceId null => lignes du modèle uniquement (instance_seance_id IS NULL) ;
// sinon uniquement les lignes copiées pour cette instance (isolation template/instance).
// Les enfants sont toujours triés par position (l'ordre n'est jamais garanti sans tri explicite).
export async function getSeanceTree(
  db: DbLecture,
  seanceId: string,
  instanceId: string | null,
): Promise<{ blocs: BlocSeance[]; exercices: ExerciceSeance[] }> {
  const filtre =
    instanceId === null ? 'instance_seance_id IS NULL' : 'instance_seance_id = ?'
  const params = instanceId === null ? [seanceId] : [seanceId, instanceId]
  const blocs = await db.getAll<Ligne>(
    `SELECT * FROM blocs_seance WHERE seance_id = ? AND ${filtre} AND deleted_at IS NULL ORDER BY position, id`,
    params,
  )
  const exercices = await db.getAll<Ligne>(
    `SELECT * FROM exercices_seance WHERE seance_id = ? AND ${filtre} AND deleted_at IS NULL ORDER BY position, id`,
    params,
  )
  return { blocs: blocs.map(mapBloc), exercices: exercices.map(mapExerciceSeance) }
}

const TABLES = new Set(AppSchema.tables.map((t) => t.name))

// Suppression logique : la ligne reste comme tombstone et se synchronise (updated_at rafraîchi).
export async function softDelete(db: Db, table: string, id: string): Promise<void> {
  if (!TABLES.has(table)) throw new Error(`Table inconnue : ${table}`)
  const maintenant = new Date().toISOString()
  await db.execute(`UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?`, [maintenant, maintenant, id])
}

// Nom d'une séance, MÊME SI elle a été supprimée logiquement : le calendrier et les statistiques
// en ont besoin pour libeller l'historique conservé après une suppression « garder l'historique ».
// Renvoie null uniquement si la ligne n'a jamais existé.
export async function lireNomSeance(db: DbLecture, seanceId: string): Promise<string | null> {
  const ligne = await db.getOptional<{ nom: string }>('SELECT nom FROM seances WHERE id = ?', [seanceId])
  return ligne ? ligne.nom : null
}
