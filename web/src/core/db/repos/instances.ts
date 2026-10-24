import type { Db } from '../Db'
import { newId } from '../ids'
import type { InstanceSeance } from '../types'
import { mapInstance, type Ligne } from './mappers'

// Planifie une séance à une date (date au format ISO yyyy-MM-dd). Renvoie l'id créé.
export async function createInstance(db: Db, seanceId: string, date: string): Promise<string> {
  const id = newId()
  const maintenant = new Date().toISOString()
  await db.execute(
    `INSERT INTO instances_seance
       (id, seance_id, date, notes, is_completed, completed_at, duration_seconds, created_at, updated_at)
     VALUES (?, ?, ?, '', 0, NULL, 0, ?, ?)`,
    [id, seanceId, date, maintenant, maintenant],
  )
  return id
}

export async function getInstance(db: Db, id: string): Promise<InstanceSeance | null> {
  const ligne = await db.getOptional<Ligne>('SELECT * FROM instances_seance WHERE id = ? AND deleted_at IS NULL', [id])
  return ligne ? mapInstance(ligne) : null
}

export async function listInstances(db: Db): Promise<InstanceSeance[]> {
  const lignes = await db.getAll<Ligne>('SELECT * FROM instances_seance WHERE deleted_at IS NULL ORDER BY date, id')
  return lignes.map(mapInstance)
}
