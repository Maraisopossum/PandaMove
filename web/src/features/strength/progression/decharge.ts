import { parseTimestamp } from '../../../core/common/parseTimestamp'
import type { DbLecture } from '../../../core/db/Db'
import { lireProgression } from '../../../core/progression/marqueur'

// Décharge planifiée : tous les N semaines sans décharge, la prochaine progression d'un exercice devient une
// proposition de décharge (le deload existant, -10 %), à valider comme toute proposition (Oui / Non / Ajuster).
// Aucune colonne en plus : l'horloge se déduit des séances terminées (début = première séance terminée qui contient
// l'exercice ; remise à zéro = dernière décision enregistrée sur une proposition de décharge, quelle qu'elle soit).

const MS_PAR_SEMAINE = 7 * 24 * 3600 * 1000

/** Une séance terminée qui contient l'exercice : son instant et, si elle porte une décision de décharge, true. */
export interface PassageExercice {
  instantMs: number
  decisionDecharge: boolean
}

/** Instant de référence : la décision de décharge la plus récente, à défaut la première séance. Null sans historique. */
export function referenceDecharge(passages: PassageExercice[]): number | null {
  if (passages.length === 0) return null
  const decharges = passages.filter((p) => p.decisionDecharge).map((p) => p.instantMs)
  return decharges.length > 0 ? Math.max(...decharges) : Math.min(...passages.map((p) => p.instantMs))
}

/** Vrai si au moins `intervalleSemaines` semaines se sont écoulées depuis la référence (0 : désactivée). */
export function dechargeDue(passages: PassageExercice[], maintenantMs: number, intervalleSemaines: number): boolean {
  if (intervalleSemaines <= 0) return false
  const reference = referenceDecharge(passages)
  return reference !== null && maintenantMs - reference >= intervalleSemaines * MS_PAR_SEMAINE
}

interface LigneInstance {
  id: string
  date: string | null
  completed_at: string | null
  progression_json: string | null
}

/**
 * Séances terminées de ce modèle (hors celle en cours d'évaluation) qui contiennent l'exercice. L'instance
 * évaluée est exclue : sa propre décision ne doit pas remettre l'horloge à zéro quand on la recalcule.
 */
export async function passagesExercice(db: DbLecture, seanceId: string, exerciseId: string, instanceExclueId: string): Promise<PassageExercice[]> {
  const instances = await db.getAll<LigneInstance>(
    `SELECT id, date, completed_at, progression_json FROM instances_seance
     WHERE seance_id = ? AND is_completed = 1 AND deleted_at IS NULL AND id != ?`,
    [seanceId, instanceExclueId],
  )
  const passages: PassageExercice[] = []
  for (const instance of instances) {
    const lignes = await db.getAll<{ id: string }>(
      'SELECT id FROM exercices_seance WHERE instance_seance_id = ? AND exercise_id = ? AND deleted_at IS NULL',
      [instance.id, exerciseId],
    )
    if (lignes.length === 0) continue
    const instantMs = parseTimestamp(instance.completed_at) ?? parseTimestamp(instance.date)
    if (instantMs === null) continue
    const etat = lireProgression(instance.progression_json)
    const decisionDecharge = lignes.some((l) => etat?.decisions[l.id] !== undefined && etat.bases?.[l.id]?.proposition.deload === true)
    passages.push({ instantMs, decisionDecharge })
  }
  return passages
}
