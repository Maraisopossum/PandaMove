import type { Db, DbTx } from '../../core/db/Db'
import { supprimerInstance } from '../calendar/calendrier'
import { ErreurSeance } from './affectation'
import { CATEGORIE_SEANCE_DIRECTE } from './seanceDirecte'

export type ModeSuppression = 'garder_historique' | 'tout'

export interface Historique {
  planifiees: number
  realisees: number
}

// Instances vivantes d'une séance : planifiées (is_completed = 0) et réalisées (is_completed = 1).
export async function compterHistorique(db: Db, seanceId: string): Promise<Historique> {
  const l = await db.get<{ planifiees: number | null; realisees: number | null }>(
    `SELECT
       SUM(CASE WHEN is_completed = 0 THEN 1 ELSE 0 END) AS planifiees,
       SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) AS realisees
     FROM instances_seance WHERE seance_id = ? AND deleted_at IS NULL`,
    [seanceId],
  )
  return { planifiees: l.planifiees ?? 0, realisees: l.realisees ?? 0 }
}

const pluriel = (n: number, mot: string, accord: string) => `${n} ${mot}${n > 1 ? 's' : ''} ${accord}${n > 1 ? 's' : ''}`

// Phrase du dialogue de suppression (« 1 séance planifiée et 2 séances réalisées liées à ce modèle »).
export function texteHistorique({ planifiees, realisees }: Historique): string {
  return `${pluriel(planifiees, 'séance', 'planifiée')} et ${pluriel(realisees, 'séance', 'réalisée')} liées à ce modèle`
}

// Marque supprimées (tombstone synchronisable) les lignes vivantes de `table` correspondant à `condition`.
// Les lignes déjà supprimées ne sont jamais retouchées (leur updated_at reste celui de leur suppression).
async function tombstone(tx: DbTx, table: string, condition: string, params: unknown[], maintenant: string) {
  await tx.execute(
    `UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE ${condition} AND deleted_at IS NULL`,
    [maintenant, maintenant, ...params],
  )
}

// Suppression d'une séance en UNE transaction. Jamais de DELETE : les tombstones doivent se synchroniser.
// - garder_historique : modèle (séance, blocs/exercices modèle, objectifs) + instances PLANIFIÉES avec leurs
//   lignes et séries ; les instances réalisées, leurs lignes et leurs séries sont conservées (calendrier, stats).
// - tout : idem + instances réalisées, leurs lignes et leurs séries.
// Les lignes d'autres séances ne sont jamais touchées. Séance inconnue ou déjà supprimée : erreur, rien d'écrit.
export async function supprimerSeance(db: Db, seanceId: string, mode: ModeSuppression): Promise<void> {
  await db.writeTransaction(async (tx) => {
    const vivante = await tx.getOptional<{ id: string }>('SELECT id FROM seances WHERE id = ? AND deleted_at IS NULL', [seanceId])
    if (!vivante) throw new ErreurSeance('Séance introuvable.')
    const maintenant = new Date().toISOString()

    // Instances visées : planifiées toujours, réalisées seulement en mode « tout »
    const filtreInstances = mode === 'tout' ? 'seance_id = ?' : 'seance_id = ? AND is_completed = 0'
    const instancesVisees = `(SELECT id FROM instances_seance WHERE ${filtreInstances})`

    // Enfants d'abord, puis les instances elles-mêmes (le sous-select lit encore leurs ids)
    await tombstone(tx, 'series_realisees', `instance_seance_id IN ${instancesVisees}`, [seanceId], maintenant)
    await tombstone(tx, 'blocs_seance', `instance_seance_id IN ${instancesVisees}`, [seanceId], maintenant)
    await tombstone(tx, 'exercices_seance', `instance_seance_id IN ${instancesVisees}`, [seanceId], maintenant)
    await tombstone(tx, 'instances_seance', filtreInstances, [seanceId], maintenant)

    // Modèle : lignes sans instance uniquement
    await tombstone(tx, 'blocs_seance', 'seance_id = ? AND instance_seance_id IS NULL', [seanceId], maintenant)
    await tombstone(tx, 'exercices_seance', 'seance_id = ? AND instance_seance_id IS NULL', [seanceId], maintenant)
    await tombstone(tx, 'objectifs_progression', 'seance_id = ?', [seanceId], maintenant)
    await tombstone(tx, 'seances', 'id = ?', [seanceId], maintenant)
  })
}

// Suppression logique d'une séance jouée (instance, ses copies et ses séries). Si elle appartient à une séance
// « directe » (sans modèle réutilisable) devenue sans aucune instance vivante, la séance est supprimée aussi
// (Android deleteInstances : elle n'a plus de raison d'exister). Un modèle de « Séances types » n'est jamais touché.
export async function supprimerInstanceRenforcement(db: Db, instanceId: string): Promise<void> {
  const l = await db.getOptional<{ seance_id: string }>('SELECT seance_id FROM instances_seance WHERE id = ? AND deleted_at IS NULL', [instanceId])
  if (!l) throw new ErreurSeance('Séance introuvable.')
  await supprimerInstance(db, instanceId)
  const directe = await db.getOptional<{ id: string }>(
    `SELECT s.id FROM seances s WHERE s.id = ? AND s.seance_category = ? AND s.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM instances_seance i WHERE i.seance_id = s.id AND i.deleted_at IS NULL)`,
    [l.seance_id, CATEGORIE_SEANCE_DIRECTE],
  )
  if (directe) await tombstone(db, 'seances', 'id = ?', [directe.id], new Date().toISOString())
}
