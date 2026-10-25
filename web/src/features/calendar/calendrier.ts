import type { Db, DbLecture, DbTx } from '../../core/db/Db'
import type { Ligne } from '../../core/db/repos/mappers'
import { lireNomSeance } from '../../core/db/repos/seances'
import { listSeries } from '../../core/db/repos/series'
import { dateIsoValide } from '../strength/affectation'
import type { InstanceVue } from './types'

// Erreur destinée à l'utilisateur (message en français).
export class ErreurCalendrier extends Error {}

export const NOM_SEANCE_INCONNUE = 'Séance (supprimée)'

// Transforme une ligne d'instance en vue : nom (même si la séance est supprimée, pour l'historique
// conservé), état et, pour les séances démarrées ou terminées, durée et nombre de séries terminées.
export async function instanceEnVue(db: DbLecture, l: Ligne): Promise<InstanceVue> {
  const id = String(l.id)
  const seanceId = String(l.seance_id)
  const terminee = l.is_completed === 1
  const etat = terminee ? 'terminee' : l.started_at != null ? 'en_cours' : 'planifiee'
  const vue: InstanceVue = {
    id,
    seanceId,
    nom: (await lireNomSeance(db, seanceId)) ?? NOM_SEANCE_INCONNUE,
    dateIso: String(l.date),
    etat,
  }
  if (terminee) vue.dureeSec = Number(l.duration_seconds ?? 0)
  if (etat !== 'planifiee') vue.nbSeries = (await listSeries(db, id)).filter((s) => s.isCompleted).length
  return vue
}

// Instances vivantes dont la date PLANIFIÉE (colonne date, jamais completed_at) est dans [debutIso, finIso].
export async function lireInstancesPlage(db: DbLecture, debutIso: string, finIso: string): Promise<InstanceVue[]> {
  const lignes = await db.getAll<Ligne>(
    'SELECT * FROM instances_seance WHERE deleted_at IS NULL AND date >= ? AND date <= ? ORDER BY date, id',
    [debutIso, finIso],
  )
  return Promise.all(lignes.map((l) => instanceEnVue(db, l)))
}

// Prochaines séances : à partir d'aujourd'hui, non terminées (planifiées ou en cours), indépendamment du mois affiché.
export async function lireProchaines(db: DbLecture, aujourdhuiIso: string, limite: number): Promise<InstanceVue[]> {
  const lignes = await db.getAll<Ligne>(
    `SELECT * FROM instances_seance
     WHERE deleted_at IS NULL AND is_completed = 0 AND date >= ? ORDER BY date, id LIMIT ?`,
    [aujourdhuiIso, limite],
  )
  return Promise.all(lignes.map((l) => instanceEnVue(db, l)))
}

// Déplace UNE instance. Une instance terminée ne se déplace pas : sa date ancre les statistiques.
// Les contrôles précèdent l'écriture (rien n'est écrit en cas d'erreur).
export async function deplacerInstance(db: Db, instanceId: string, dateIso: string): Promise<void> {
  if (!dateIsoValide(dateIso)) throw new ErreurCalendrier('Date invalide : choisissez une date réelle au format jj/mm/aaaa.')
  await db.writeTransaction(async (tx) => {
    const l = await tx.getOptional<{ is_completed: number | null }>(
      'SELECT is_completed FROM instances_seance WHERE id = ? AND deleted_at IS NULL',
      [instanceId],
    )
    if (!l) throw new ErreurCalendrier('Séance introuvable.')
    if (l.is_completed === 1) throw new ErreurCalendrier("Une séance terminée ne peut pas être déplacée : sa date sert aux statistiques.")
    await tx.execute('UPDATE instances_seance SET date = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [
      dateIso, new Date().toISOString(), instanceId,
    ])
  })
}

// Marque supprimées (tombstone synchronisable) les lignes vivantes de `table` rattachées à l'instance.
async function tombstone(tx: DbTx, table: string, colonne: string, instanceId: string, maintenant: string) {
  await tx.execute(
    `UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE ${colonne} = ? AND deleted_at IS NULL`,
    [maintenant, maintenant, instanceId],
  )
}

// Suppression logique d'une instance (planifiée, en cours ou terminée) avec ses lignes copiées et ses séries,
// en UNE transaction. Jamais de DELETE ; modèle de séance et autres instances ne sont pas touchés.
export async function supprimerInstance(db: Db, instanceId: string): Promise<void> {
  await db.writeTransaction(async (tx) => {
    const vivante = await tx.getOptional<{ id: string }>('SELECT id FROM instances_seance WHERE id = ? AND deleted_at IS NULL', [instanceId])
    if (!vivante) throw new ErreurCalendrier('Séance introuvable.')
    const maintenant = new Date().toISOString()
    await tombstone(tx, 'series_realisees', 'instance_seance_id', instanceId, maintenant)
    await tombstone(tx, 'blocs_seance', 'instance_seance_id', instanceId, maintenant)
    await tombstone(tx, 'exercices_seance', 'instance_seance_id', instanceId, maintenant)
    await tombstone(tx, 'instances_seance', 'id', instanceId, maintenant)
  })
}
