import type { Db } from '../Db'
import { deterministicId, newId } from '../ids'
import { upsertRow } from '../upsert'
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

// Démarre l'exécution : started_at n'est écrit qu'une fois (un second appel garde la première valeur).
export async function demarrerInstance(db: Db, id: string, startedAtIso: string): Promise<void> {
  await db.execute(
    'UPDATE instances_seance SET started_at = ?, updated_at = ? WHERE id = ? AND started_at IS NULL AND deleted_at IS NULL',
    [startedAtIso, startedAtIso, id],
  )
}

// Remplace la liste des pauses (JSON sérialisé par sessionClock) d'une instance non terminée.
export async function enregistrerPauses(db: Db, id: string, pausedJson: string, maintenantIso: string): Promise<void> {
  await db.execute(
    'UPDATE instances_seance SET paused_json = ?, updated_at = ? WHERE id = ? AND is_completed = 0 AND deleted_at IS NULL',
    [pausedJson, maintenantIso, id],
  )
}

// Termine l'instance. Idempotent : une instance déjà terminée n'est plus modifiée.
export async function terminerInstance(
  db: Db,
  id: string,
  fin: { completedAt: string; durationSeconds: number; pausedJson: string },
): Promise<void> {
  await db.execute(
    `UPDATE instances_seance SET is_completed = 1, completed_at = ?, duration_seconds = ?, paused_json = ?, updated_at = ?
     WHERE id = ? AND is_completed = 0 AND deleted_at IS NULL`,
    [fin.completedAt, fin.durationSeconds, fin.pausedJson, fin.completedAt, id],
  )
}

export class ErreurInstance extends Error {}

// Copie les blocs et exercices du modèle de la séance vers l'instance (équivalent web de la
// copie « lazy » d'InstanceExecuteViewModel). Une seule transaction ; idempotente :
// - garde : si l'instance possède déjà des lignes (copie précédente ou import), on ne fait rien ;
// - ids déterministes (instanceId + id source) : deux appareils hors ligne produisent les mêmes
//   clés primaires, donc aucun doublon après synchro.
// Seules les lignes du modèle (instance_seance_id IS NULL, non supprimées) sont lues et jamais modifiées.
// Les séries réalisées et objectifs de progression ne sont pas copiés.
export async function copyTemplateToInstance(db: Db, instanceId: string): Promise<void> {
  await db.writeTransaction(async (tx) => {
    const instance = await tx.getOptional<{ seance_id: string }>(
      'SELECT seance_id FROM instances_seance WHERE id = ? AND deleted_at IS NULL',
      [instanceId],
    )
    if (!instance) throw new ErreurInstance('Instance introuvable')
    const seance = await tx.getOptional<{ id: string }>('SELECT id FROM seances WHERE id = ? AND deleted_at IS NULL', [
      instance.seance_id,
    ])
    if (!seance) throw new ErreurInstance("La séance de cette instance est introuvable ou supprimée")

    const dejaCopie = await tx.getOptional<{ one: number }>(
      `SELECT 1 AS one FROM blocs_seance WHERE instance_seance_id = ? AND deleted_at IS NULL
       UNION ALL
       SELECT 1 AS one FROM exercices_seance WHERE instance_seance_id = ? AND deleted_at IS NULL`,
      [instanceId, instanceId],
    )
    if (dejaCopie) return

    const blocs = await tx.getAll<Ligne>(
      'SELECT * FROM blocs_seance WHERE seance_id = ? AND instance_seance_id IS NULL AND deleted_at IS NULL ORDER BY position, id',
      [instance.seance_id],
    )
    const exercices = await tx.getAll<Ligne>(
      'SELECT * FROM exercices_seance WHERE seance_id = ? AND instance_seance_id IS NULL AND deleted_at IS NULL ORDER BY position, id',
      [instance.seance_id],
    )
    const maintenant = new Date().toISOString()

    // Blocs d'abord : les exercices référencent l'id du bloc copié.
    const idBlocCopie = new Map<string, string>()
    for (const bloc of blocs) {
      const idSource = String(bloc.id)
      const id = deterministicId(instanceId, idSource)
      idBlocCopie.set(idSource, id)
      await upsertRow(tx, 'blocs_seance', {
        ...bloc, id, instance_seance_id: instanceId, bloc_source_id: idSource, updated_at: maintenant,
      })
    }
    for (const exercice of exercices) {
      const idSource = String(exercice.id)
      const blocSource = exercice.bloc_id == null ? null : String(exercice.bloc_id)
      await upsertRow(tx, 'exercices_seance', {
        ...exercice,
        id: deterministicId(instanceId, idSource),
        bloc_id: blocSource === null ? null : (idBlocCopie.get(blocSource) ?? null),
        instance_seance_id: instanceId,
        exercice_source_id: idSource,
        updated_at: maintenant,
      })
    }
  })
}
