import { comparerHorodatages } from '../../common/parseTimestamp'
import { chargeLisible } from '../../progression/chargeLisible'
import type { Db, DbLecture, DbTx } from '../Db'
import { deterministicId } from '../ids'
import type { ObjectifProgression } from '../types'
import { upsertRow } from '../upsert'
import { mapObjectif, type Ligne } from './mappers'

// Objectif de progression : la clé LOGIQUE est le couple (séance modèle, exercice du catalogue).
// L'import crée des lignes aux ids dérivés des ids Android, le web aux ids (séance, exercice) : un
// même couple peut donc porter plusieurs lignes vivantes. On ne suppose jamais l'id : on lit et on
// met à jour la ligne vivante la plus récente (updated_at) du couple.

/** Champs écrits par saveObjectif (l'id et updated_at sont gérés par le dépôt). */
export type ObjectifAEcrire = Omit<ObjectifProgression, 'id' | 'updatedAt'>

const SELECT_COUPLE =
  `SELECT * FROM objectifs_progression
   WHERE seance_id = ? AND exercise_id = ? AND deleted_at IS NULL`

// La plus récente est choisie en JS par instant (comparerHorodatages) : un ORDER BY SQL sur le texte
// classerait mal une ligne synchronisée (« 2026-03-01 12:00:00+00 ») face à une ligne locale ISO.
export async function getObjectif(db: DbLecture, seanceId: string, exerciseId: string): Promise<ObjectifProgression | null> {
  const lignes = (await db.getAll<Ligne>(SELECT_COUPLE, [seanceId, exerciseId])).map(mapObjectif)
  let retenue: ObjectifProgression | null = null
  for (const o of lignes) {
    const ordre = retenue ? comparerHorodatages(o.updatedAt, retenue.updatedAt) : 1
    if (!retenue || ordre > 0 || (ordre === 0 && o.id > retenue.id)) retenue = o
  }
  return retenue
}

async function ecrire(tx: DbTx, o: ObjectifAEcrire, maintenant: string): Promise<string> {
  const existante = await getObjectif(tx, o.seanceId, o.exerciseId)
  const id = existante?.id ?? deterministicId(o.seanceId, o.exerciseId)
  await upsertRow(tx, 'objectifs_progression', {
    id,
    seance_id: o.seanceId,
    exercise_id: o.exerciseId,
    // Jamais de Float 32 bits brut en base (voir chargeLisible)
    charge_cible: o.chargeCible === null ? null : chargeLisible(o.chargeCible),
    reps_cible: o.repsCible,
    duree_cible_sec: o.dureeCibleSec,
    compteur_echec: o.compteurEchec,
    derniere_maj: o.derniereMaj,
    nombre_series_cible: o.nombreSeriesCible,
    updated_at: maintenant,
    deleted_at: null,
  })
  return id
}

// Enregistre l'objectif du couple : UPDATE de la ligne trouvée (quel que soit son id), sinon INSERT
// avec un id déterministe (deux appareils hors ligne convergent vers la même ligne). Sans ON CONFLICT
// (les tables PowerSync sont des vues). Dans une transaction fournie, ou dans sa propre transaction.
export async function saveObjectif(
  db: Db | DbTx,
  o: ObjectifAEcrire,
  maintenant: string = new Date().toISOString(),
): Promise<string> {
  if ('writeTransaction' in db) return db.writeTransaction((tx) => ecrire(tx, o, maintenant))
  return ecrire(db, o, maintenant)
}
