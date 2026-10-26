import type { Db } from '../../core/db/Db'
import { newId } from '../../core/db/ids'
import { createInstance } from '../../core/db/repos/instances'
import { upsertRow } from '../../core/db/upsert'
import { dateIsoValide, ErreurSeance } from './affectation'

/** Catégorie des séances « directes » : planifiées sans modèle réutilisable, absentes de « Séances types ». */
export const CATEGORIE_SEANCE_DIRECTE = 'STRENGTH_ONESHOT'

// « Séance du 5/10 » (jour/mois sans zéro initial, comme Android).
export function nomParDefautSeanceDirecte(dateIso: string): string {
  const [, m, j] = dateIso.split('-').map(Number)
  return `Séance du ${j}/${m}`
}

// Séance directe : crée une séance STRENGTH_ONESHOT et son instance à la date donnée (équivalent d'Android
// createOneShotInstance), en une transaction. L'instance n'est pas démarrée : l'exécution s'en charge.
export async function creerSeanceDirecte(db: Db, nom: string, dateIso: string): Promise<{ seanceId: string; instanceId: string }> {
  if (!dateIsoValide(dateIso)) throw new ErreurSeance('Date invalide : choisissez une date réelle.')
  return db.writeTransaction(async (tx) => {
    const maintenant = new Date().toISOString()
    const seanceId = newId()
    await upsertRow(tx, 'seances', {
      id: seanceId,
      nom: nom.trim() || nomParDefautSeanceDirecte(dateIso),
      groupes_musculaires: '[]',
      duree_estimee_min: 60,
      notes: '',
      seance_category: CATEGORIE_SEANCE_DIRECTE,
      is_archived: 0,
      created_at: maintenant,
      updated_at: maintenant,
      deleted_at: null,
    })
    const instanceId = await createInstance(tx, seanceId, dateIso)
    return { seanceId, instanceId }
  })
}
