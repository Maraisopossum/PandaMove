import type { Db } from '../Db'
import type { Exercise } from '../types'
import { mapExercise, type Ligne } from './mappers'

// Catalogue d'exercices (non supprimés), triés par nom.
export async function listExercises(db: Db): Promise<Exercise[]> {
  const lignes = await db.getAll<Ligne>('SELECT * FROM exercises WHERE deleted_at IS NULL ORDER BY name')
  return lignes.map(mapExercise)
}
