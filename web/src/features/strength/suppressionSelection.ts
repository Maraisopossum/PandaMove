import type { Db } from '../../core/db/Db'
import { archiverSeance } from './affectation'
import { supprimerInstanceRenforcement, supprimerSeance } from './suppression'

// Suppression par sélection multiple, comme l'Android (SeanceListViewModel.deleteSeances / deleteInstances).

export interface BilanSuppression {
  /** Séances types supprimées (suppression logique, séances jouées et séries comprises) */
  supprimees: number
  /** Séances types archivées parce qu'elles avaient des séances jouées */
  archivees: number
}

/**
 * Séances types choisies : une séance NON archivée qui a des séances jouées est ARCHIVÉE (son historique est conservé) ;
 * sinon (aucune séance jouée, ou déjà archivée = purge assumée) elle est supprimée avec ses séances jouées et ses séries.
 * Une séance inconnue ou déjà supprimée est ignorée. Suppressions logiques uniquement.
 */
export async function supprimerSeancesSelection(db: Db, ids: string[]): Promise<BilanSuppression> {
  const bilan: BilanSuppression = { supprimees: 0, archivees: 0 }
  for (const id of ids) {
    const seance = await db.getOptional<{ archivee: number | null }>(
      'SELECT is_archived AS archivee FROM seances WHERE id = ? AND deleted_at IS NULL',
      [id],
    )
    if (!seance) continue
    const jouees = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM instances_seance WHERE seance_id = ? AND deleted_at IS NULL', [id])
    if (!seance.archivee && jouees.n > 0) {
      await archiverSeance(db, id)
      bilan.archivees++
    } else {
      await supprimerSeance(db, id, 'tout')
      bilan.supprimees++
    }
  }
  return bilan
}

/** Séances jouées choisies : suppression logique de chacune (lignes copiées et séries comprises). Renvoie le nombre supprimé. */
export async function supprimerInstancesSelection(db: Db, ids: string[]): Promise<number> {
  let n = 0
  for (const id of ids) {
    const vivante = await db.getOptional<{ id: string }>('SELECT id FROM instances_seance WHERE id = ? AND deleted_at IS NULL', [id])
    if (!vivante) continue
    await supprimerInstanceRenforcement(db, id)
    n++
  }
  return n
}

export interface CompteSelection {
  types: number
  archivees: number
  planifiees: number
  terminees: number
}

export interface TextesSuppression {
  titre: string
  lignes: string[]
}

const seances = (n: number, qualificatif: string, accord: string) => `${n} séance${n > 1 ? 's' : ''} ${qualificatif}${n > 1 ? accord : ''}`

/** Titre et phrases du dialogue de suppression (modèle de l'Android : « Supprimer ces N éléments ? »). */
export function textesSuppressionSelection(c: CompteSelection): TextesSuppression {
  const total = c.types + c.archivees + c.planifiees + c.terminees
  const parties = [
    c.types > 0 ? seances(c.types, 'type', 's') : null,
    c.archivees > 0 ? seances(c.archivees, 'archivée', 's') : null,
    c.planifiees > 0 ? seances(c.planifiees, 'programmée', 's') : null,
    c.terminees > 0 ? seances(c.terminees, 'terminée', 's') : null,
  ].filter((p): p is string => p !== null)
  const detail = `${parties.join(' et ')} ${total > 1 ? 'seront supprimées' : 'sera supprimée'}.`
  const lignes = [detail]
  if (c.types > 0) lignes.push('Une séance type qui a déjà des séances jouées est archivée : son historique est conservé.')
  if (c.archivees > 0) lignes.push('Une séance archivée est supprimée définitivement, avec ses séances jouées.')
  if (c.types === 0 && c.archivees === 0) lignes.push('Les séances types ne sont pas touchées.')
  return { titre: total === 1 ? 'Supprimer cet élément ?' : `Supprimer ces ${total} éléments ?`, lignes }
}
