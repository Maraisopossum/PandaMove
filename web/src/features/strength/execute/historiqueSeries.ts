import type { DbLecture } from '../../../core/db/Db'
import type { SerieHisto } from './lignesSeries'

interface Ligne {
  exercise_id: string
  instance_seance_id: string
  date: string
  numero_serie: number
  reps_realisees: number | null
  charge_kg: number | null
  updated_at: string
}

// Séries de la séance TERMINÉE la plus récente (hors instance courante) de chaque exercice du catalogue :
// sert à pré-remplir les lignes « comme la dernière fois ». Séries validées et vivantes seulement ; une
// série dont la ligne d'exercice d'instance est supprimée est ignorée.
export async function dernieresSeries(
  db: DbLecture,
  instanceId: string,
  exerciseIds: string[],
): Promise<Map<string, SerieHisto[]>> {
  const resultat = new Map<string, SerieHisto[]>()
  if (exerciseIds.length === 0) return resultat
  const lignes = await db.getAll<Ligne>(
    `SELECT es.exercise_id AS exercise_id, sr.instance_seance_id AS instance_seance_id, i.date AS date,
            sr.numero_serie AS numero_serie, sr.reps_realisees AS reps_realisees, sr.charge_kg AS charge_kg,
            sr.updated_at AS updated_at
     FROM series_realisees sr
     JOIN instances_seance i ON i.id = sr.instance_seance_id
     JOIN exercices_seance es ON es.id = sr.exercice_seance_id
     WHERE sr.deleted_at IS NULL AND sr.is_completed = 1 AND es.deleted_at IS NULL
       AND i.deleted_at IS NULL AND i.is_completed = 1 AND i.id <> ?
       AND es.exercise_id IN (${exerciseIds.map(() => '?').join(', ')})`,
    [instanceId, ...exerciseIds],
  )
  // Instance la plus récente par exercice (date puis id pour départager)
  const meilleure = new Map<string, Ligne>()
  for (const l of lignes) {
    const m = meilleure.get(l.exercise_id)
    if (!m || l.date > m.date || (l.date === m.date && l.instance_seance_id > m.instance_seance_id)) meilleure.set(l.exercise_id, l)
  }
  for (const [exerciseId, ref] of meilleure) {
    const parNumero = new Map<number, Ligne>()
    for (const l of lignes) {
      if (l.exercise_id !== exerciseId || l.instance_seance_id !== ref.instance_seance_id) continue
      const existante = parNumero.get(l.numero_serie)
      if (!existante || l.updated_at > existante.updated_at) parNumero.set(l.numero_serie, l)
    }
    resultat.set(
      exerciseId,
      [...parNumero.values()]
        .sort((a, b) => a.numero_serie - b.numero_serie)
        .map((l) => ({ numero: l.numero_serie, reps: l.reps_realisees, chargeKg: l.charge_kg })),
    )
  }
  return resultat
}
