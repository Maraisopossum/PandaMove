import { getDb } from '../../../core/db/client'

/** Séance démarrée et non terminée (et non supprimée) : seule une séance dans cet état continue en arrière-plan. */
export async function estSeanceEnCours(id: string): Promise<boolean> {
  const lignes = await getDb().getAll<{ n: number }>(
    'SELECT COUNT(*) AS n FROM instances_seance WHERE id = ? AND started_at IS NOT NULL AND is_completed = 0 AND deleted_at IS NULL',
    [id],
  )
  return (lignes[0]?.n ?? 0) > 0
}
