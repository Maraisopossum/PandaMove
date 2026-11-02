import type { DbLecture } from '../../../core/db/Db'
import type { ObjectifProgression } from '../../../core/db/types'
import { estEligibleCalibration } from '../../../core/progression/calibration'
import type { ExerciceConfig } from '../../../core/progression/engine'

/**
 * Première séance de cet exercice dans ce modèle : aucune autre séance de ce modèle, antérieure à `avantIso`, n'a de
 * série validée pour lui. L'instance évaluée est exclue. Se déduit des données : aucun drapeau à stocker, donc
 * identique à l'ouverture, à la fin de séance et au recalcul après correction.
 */
export async function estPremiereSeance(db: DbLecture, seanceId: string, exerciseId: string, instanceId: string, avantIso: string): Promise<boolean> {
  const ligne = await db.getOptional<{ n: number }>(
    `SELECT COUNT(*) AS n FROM series_realisees sr
     JOIN exercices_seance es ON es.id = sr.exercice_seance_id
     JOIN instances_seance i ON i.id = es.instance_seance_id
     WHERE i.seance_id = ? AND es.exercise_id = ? AND sr.is_completed = 1 AND sr.deleted_at IS NULL
       AND i.deleted_at IS NULL AND i.id != ? AND COALESCE(i.completed_at, i.date) < ?`,
    [seanceId, exerciseId, instanceId, avantIso],
  )
  return (ligne?.n ?? 0) === 0
}

/** Exercice à calibrer : gros exercice, sans objectif de progression, jamais joué dans ce modèle. */
export async function aCalibrer(
  db: DbLecture,
  es: Pick<ExerciceConfig, 'typeExercice' | 'repsType' | 'isBodyweight'> & { exerciseId: string },
  objectif: ObjectifProgression | null,
  seanceId: string,
  instanceId: string,
  avantIso: string,
): Promise<boolean> {
  return objectif === null && estEligibleCalibration(es) && (await estPremiereSeance(db, seanceId, es.exerciseId, instanceId, avantIso))
}
