import type { Db } from '../../core/db/Db'
import { newId } from '../../core/db/ids'
import type { Ligne } from '../../core/db/repos/mappers'
import { upsertRow } from '../../core/db/upsert'
import { ErreurSeance } from './affectation'

// Duplique un MODÈLE de séance (séance, blocs, exercices) en UNE transaction. Piège critique du projet
// (isolation template/instance) : seules les lignes `instance_seance_id IS NULL` et non supprimées sont lues.
// Jamais copiés : instances, copies d'instance, séries réalisées, objectifs de progression (ils appartiennent
// à l'historique du modèle d'origine). Ids aléatoires (une duplication est un acte volontaire de l'utilisateur :
// deux duplications doivent donner deux séances distinctes, contrairement à la copie d'instance déterministe).
// Un exercice dont le bloc est absent ou supprimé devient libre. Renvoie l'id de la nouvelle séance.
export async function dupliquerSeance(db: Db, seanceId: string): Promise<string> {
  return db.writeTransaction(async (tx) => {
    const source = await tx.getOptional<Ligne>('SELECT * FROM seances WHERE id = ? AND deleted_at IS NULL', [seanceId])
    if (!source) throw new ErreurSeance('Séance introuvable.')
    const blocs = await tx.getAll<Ligne>(
      'SELECT * FROM blocs_seance WHERE seance_id = ? AND instance_seance_id IS NULL AND deleted_at IS NULL ORDER BY position, id',
      [seanceId],
    )
    const exercices = await tx.getAll<Ligne>(
      'SELECT * FROM exercices_seance WHERE seance_id = ? AND instance_seance_id IS NULL AND deleted_at IS NULL ORDER BY position, id',
      [seanceId],
    )
    const maintenant = new Date().toISOString()
    const idCopie = newId()

    await upsertRow(tx, 'seances', {
      ...source, id: idCopie, nom: `${String(source.nom ?? '')} (copie)`, is_archived: 0, created_at: maintenant,
      updated_at: maintenant, deleted_at: null,
    })

    const blocCopie = new Map<string, string>()
    for (const bloc of blocs) {
      const id = newId()
      blocCopie.set(String(bloc.id), id)
      await upsertRow(tx, 'blocs_seance', {
        ...bloc, id, seance_id: idCopie, instance_seance_id: null, bloc_source_id: null, updated_at: maintenant, deleted_at: null,
      })
    }
    for (const exercice of exercices) {
      const blocSource = exercice.bloc_id == null ? null : String(exercice.bloc_id)
      await upsertRow(tx, 'exercices_seance', {
        ...exercice,
        id: newId(),
        seance_id: idCopie,
        bloc_id: blocSource === null ? null : (blocCopie.get(blocSource) ?? null),
        instance_seance_id: null,
        exercice_source_id: null,
        updated_at: maintenant,
        deleted_at: null,
      })
    }
    return idCopie
  })
}
