import type { Db } from '../../core/db/Db'
import { createInstance } from '../../core/db/repos/instances'

// Erreur destinée à l'utilisateur (message en français).
export class ErreurSeance extends Error {}

// Vrai si `texte` est une vraie date du calendrier au format yyyy-MM-dd (2026-02-30 est refusé).
export function dateIsoValide(texte: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texte)
  if (!m) return false
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(annee, mois - 1, jour))
  // Date.UTC « déborde » (30 février -> 2 mars) : on vérifie que la date relue est identique.
  return d.getUTCFullYear() === annee && d.getUTCMonth() === mois - 1 && d.getUTCDate() === jour
}

// Affecte un modèle de séance à une date : crée UNE instance (non terminée). Aucune copie des
// blocs/exercices ici : elle a lieu à l'ouverture de l'exécution (isolation template/instance).
export async function assignerSeance(db: Db, seanceId: string, dateIso: string): Promise<string> {
  if (!dateIsoValide(dateIso)) throw new ErreurSeance('Date invalide : choisissez une date réelle au format jj/mm/aaaa.')
  const modele = await db.getOptional<{ id: string }>('SELECT id FROM seances WHERE id = ? AND deleted_at IS NULL', [seanceId])
  if (!modele) throw new ErreurSeance('Séance introuvable.')
  return createInstance(db, seanceId, dateIso)
}

// Archivage : la séance reste en base (is_archived = 1) mais disparaît de la liste.
export async function archiverSeance(db: Db, seanceId: string): Promise<void> {
  const modele = await db.getOptional<{ id: string }>('SELECT id FROM seances WHERE id = ? AND deleted_at IS NULL', [seanceId])
  if (!modele) throw new ErreurSeance('Séance introuvable.')
  await db.execute('UPDATE seances SET is_archived = 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), seanceId])
}
