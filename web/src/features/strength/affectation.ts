import { dateIsoValide } from '../../core/common/dates'
import type { Db } from '../../core/db/Db'
import { createInstance, demarrerInstance } from '../../core/db/repos/instances'
import { aujourdhuiIso } from './saisie'

// Erreur destinée à l'utilisateur (message en français).
export class ErreurSeance extends Error {}

// Définie dans core/common/dates (module neutre, partagé avec le calendrier) ; ré-exportée ici pour que les
// fichiers du renforcement qui l'importent depuis ce module restent inchangés.
export { dateIsoValide }

// Affecte un modèle de séance à une date : crée UNE instance (non terminée). Aucune copie des
// blocs/exercices ici : elle a lieu à l'ouverture de l'exécution (isolation template/instance).
export async function assignerSeance(db: Db, seanceId: string, dateIso: string): Promise<string> {
  if (!dateIsoValide(dateIso)) throw new ErreurSeance('Date invalide : choisissez une date réelle au format jj/mm/aaaa.')
  const modele = await db.getOptional<{ id: string }>('SELECT id FROM seances WHERE id = ? AND deleted_at IS NULL', [seanceId])
  if (!modele) throw new ErreurSeance('Séance introuvable.')
  return createInstance(db, seanceId, dateIso)
}

// « Lancer maintenant » depuis la liste des séances types : instance à la date LOCALE du jour, démarrée
// tout de suite (chrono lancé). Si une instance non terminée de ce modèle existe déjà aujourd'hui, elle est
// reprise (démarrée si besoin, heure de départ conservée sinon) au lieu d'en créer une seconde.
// La création passe par assignerSeance (contrôles de date et de modèle) ; la copie du modèle reste faite
// à l'ouverture de l'exécution. Renvoie l'id de l'instance à ouvrir.
export async function lancerSeanceMaintenant(db: Db, seanceId: string, maintenant: Date): Promise<string> {
  const modele = await db.getOptional<{ id: string }>('SELECT id FROM seances WHERE id = ? AND deleted_at IS NULL', [seanceId])
  if (!modele) throw new ErreurSeance('Séance introuvable.')
  const dateIso = aujourdhuiIso(maintenant)
  // Priorité à une instance déjà démarrée, puis à la plus ancienne
  const existante = await db.getOptional<{ id: string }>(
    `SELECT id FROM instances_seance
     WHERE seance_id = ? AND date = ? AND is_completed = 0 AND deleted_at IS NULL
     ORDER BY started_at IS NULL, created_at, id LIMIT 1`,
    [seanceId, dateIso],
  )
  const id = existante?.id ?? (await assignerSeance(db, seanceId, dateIso))
  await demarrerInstance(db, id, maintenant.toISOString())
  return id
}

// Archivage : la séance reste en base (is_archived = 1) mais disparaît de la liste.
export async function archiverSeance(db: Db, seanceId: string): Promise<void> {
  const modele = await db.getOptional<{ id: string }>('SELECT id FROM seances WHERE id = ? AND deleted_at IS NULL', [seanceId])
  if (!modele) throw new ErreurSeance('Séance introuvable.')
  await db.execute('UPDATE seances SET is_archived = 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), seanceId])
}

// Désarchivage : la séance revient dans « Séances types » (inverse d'archiverSeance).
export async function desarchiverSeance(db: Db, seanceId: string): Promise<void> {
  const modele = await db.getOptional<{ id: string }>('SELECT id FROM seances WHERE id = ? AND deleted_at IS NULL', [seanceId])
  if (!modele) throw new ErreurSeance('Séance introuvable.')
  await db.execute('UPDATE seances SET is_archived = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), seanceId])
}
