import { comparerHorodatages } from '../../core/common/parseTimestamp'
import { normalizeSearch } from '../../core/common/normalizeSearch'
import { muscleToGroup } from '../../core/catalogue/muscleToGroup'
import type { DbLecture } from '../../core/db/Db'
import { MUSCLE_GROUPS, type MuscleGroup } from '../../core/db/types'

// Statistiques renforcement, portage de StatsViewModel.buildStrengthDetail (Android) :
// - seules les instances TERMINÉES comptent, choisies par leur date planifiée `date` (jamais completed_at) ;
// - séries terminées, non supprimées, dédoublonnées par (instance, exercice, numéro) : la ligne au
//   updated_at le plus récent gagne (à égalité, le plus grand id), comme listSeries ;
// - tonnage = Σ reps × charge ; une série DURATION (reps = secondes) vaut 0 et sort du total de reps ;
//   une série sans charge (poids du corps) vaut 0 en tonnage mais compte comme série et en reps ;
// - volume par muscle = nombre de séries terminées, rattachées au seul muscle principal de l'exercice.

export interface ResumePeriode {
  tonnageKg: number
  seancesTerminees: number
  seriesTotal: number
  repsTotal: number
}

export interface PointHistorique {
  dateIso: string
  /** Charge maximale de la séance (0 si aucune série chargée : poids du corps) */
  maxChargeKg: number
  /** Reps de la série la plus lourde (secondes si `enSecondes`) */
  reps: number
  /** Exercice DURATION : `reps` contient des secondes */
  enSecondes: boolean
}

export interface ExerciceHistorique {
  id: string
  nom: string
}

interface LigneSerie {
  id: string
  instance_seance_id: string
  exercice_seance_id: string
  numero_serie: number
  reps_realisees: number | null
  charge_kg: number | null
  is_completed: number | null
  updated_at: string | null
  date: string
  reps_type: string | null
  exercise_id: string | null
  muscle_groups: string | null
  muscle_primary: string | null
}

// Une seule lecture : toutes les séries vivantes des instances terminées de la plage, avec le type de
// reps de l'exercice d'instance et les muscles de l'exercice catalogue (jointures facultatives).
// Une série dont la ligne d'exercice d'instance est SUPPRIMÉE est ignorée : son reps_type serait
// perdu (une série DURATION compterait ses secondes comme des reps). Une ligne simplement absente
// (pas encore synchronisée) garde la série.
const SQL_SERIES = `
  SELECT sr.id, sr.instance_seance_id, sr.exercice_seance_id, sr.numero_serie, sr.reps_realisees,
         sr.charge_kg, sr.is_completed, sr.updated_at, i.date AS date, es.reps_type AS reps_type,
         e.id AS exercise_id, e.muscle_groups AS muscle_groups, e.muscle_primary AS muscle_primary
  FROM series_realisees sr
  JOIN instances_seance i ON i.id = sr.instance_seance_id
  LEFT JOIN exercices_seance es ON es.id = sr.exercice_seance_id
  LEFT JOIN exercises e ON e.id = es.exercise_id AND e.deleted_at IS NULL
  WHERE i.is_completed = 1 AND i.deleted_at IS NULL AND sr.deleted_at IS NULL AND es.deleted_at IS NULL`

// Dédoublonne puis ne garde que les séries terminées.
function seriesRetenues(lignes: LigneSerie[]): LigneSerie[] {
  const gardees = new Map<string, LigneSerie>()
  for (const l of lignes) {
    const cle = `${l.instance_seance_id}#${l.exercice_seance_id}#${l.numero_serie}`
    const existante = gardees.get(cle)
    // Comparaison par instant (formats ISO client et Postgres mélangés), pas par ordre alphabétique
    const ordre = existante ? comparerHorodatages(l.updated_at, existante.updated_at) : 1
    if (!existante || ordre > 0 || (ordre === 0 && l.id > existante.id)) gardees.set(cle, l)
  }
  return [...gardees.values()].filter((l) => l.is_completed === 1)
}

async function lireSeriesPlage(db: DbLecture, from: string, to: string): Promise<LigneSerie[]> {
  const lignes = await db.getAll<LigneSerie>(`${SQL_SERIES} AND i.date BETWEEN ? AND ?`, [from, to])
  return seriesRetenues(lignes)
}

const estDuree = (l: LigneSerie) => l.reps_type === 'DURATION'

// Arrondi au centième : absorbe le bruit des charges float32 (17.69999885559082)
const arrondi = (x: number) => Math.round(x * 100) / 100

function tonnage(series: LigneSerie[]): number {
  return arrondi(series.reduce((t, l) => (estDuree(l) ? t : t + (l.reps_realisees ?? 0) * (l.charge_kg ?? 0)), 0))
}

export async function tonnagePeriode(db: DbLecture, from: string, to: string): Promise<number> {
  return tonnage(await lireSeriesPlage(db, from, to))
}

export async function resumePeriode(db: DbLecture, from: string, to: string): Promise<ResumePeriode> {
  const [series, compte] = await Promise.all([
    lireSeriesPlage(db, from, to),
    db.get<{ n: number }>(
      'SELECT COUNT(*) AS n FROM instances_seance WHERE is_completed = 1 AND deleted_at IS NULL AND date BETWEEN ? AND ?',
      [from, to],
    ),
  ])
  return {
    tonnageKg: tonnage(series),
    seancesTerminees: compte.n,
    seriesTotal: series.length,
    repsTotal: series.reduce((t, l) => (estDuree(l) ? t : t + (l.reps_realisees ?? 0)), 0),
  }
}

function premierGroupe(json: string | null): string {
  try {
    const v: unknown = JSON.parse(json ?? '[]')
    return Array.isArray(v) && typeof v[0] === 'string' ? v[0] : ''
  } catch {
    return ''
  }
}

// effectivePrimary Android : muscle_groups[0] s'il est renseigné, sinon muscle_primary, sinon « Autre ».
// Le texte (code, libellé ou nom anatomique du catalogue) est rangé dans un groupe par muscleToGroup.
export function musclePrincipal(muscleGroupsJson: string | null, musclePrimary: string | null): MuscleGroup {
  const premier = premierGroupe(muscleGroupsJson).trim()
  return muscleToGroup(premier !== '' ? premier : (musclePrimary ?? ''))
}

export const volumeVide = (): Record<MuscleGroup, number> =>
  Object.fromEntries(MUSCLE_GROUPS.map((g) => [g, 0])) as Record<MuscleGroup, number>

export async function volumeParMuscle(db: DbLecture, from: string, to: string): Promise<Record<MuscleGroup, number>> {
  const volume = volumeVide()
  for (const l of await lireSeriesPlage(db, from, to)) {
    // Comme la jointure INNER d'Android (getExerciseStatsFull) : une série sans exercice catalogue est ignorée
    if (l.exercise_id === null) continue
    volume[musclePrincipal(l.muscle_groups, l.muscle_primary)] += 1
  }
  return volume
}

// Historique d'un exercice (toutes dates) : un point par date de séance, charge max et reps de la série
// la plus lourde (à charge égale, la plus longue). Android ne retient que les séries chargées ; ici une
// séance au poids du corps donne charge 0 et ses meilleures reps, pour ne pas laisser l'historique vide.
export async function historiqueExercice(db: DbLecture, exerciseId: string): Promise<PointHistorique[]> {
  const lignes = await db.getAll<LigneSerie>(`${SQL_SERIES} AND es.exercise_id = ?`, [exerciseId])
  const parDate = new Map<string, PointHistorique>()
  for (const l of seriesRetenues(lignes)) {
    const charge = l.charge_kg ?? 0
    const reps = l.reps_realisees ?? 0
    const point = parDate.get(l.date)
    if (!point || charge > point.maxChargeKg || (charge === point.maxChargeKg && reps > point.reps)) {
      parDate.set(l.date, { dateIso: l.date, maxChargeKg: arrondi(charge), reps, enSecondes: estDuree(l) })
    }
  }
  return [...parDate.values()].sort((a, b) => a.dateIso.localeCompare(b.dateIso))
}

// Exercices présents dans au moins une séance terminée (choix de l'historique), triés par nom normalisé.
export async function exercicesAvecHistorique(db: DbLecture): Promise<ExerciceHistorique[]> {
  const lignes = await db.getAll<{ id: string; nom: string }>(
    `SELECT DISTINCT e.id AS id, e.name AS nom
     FROM series_realisees sr
     JOIN instances_seance i ON i.id = sr.instance_seance_id
     JOIN exercices_seance es ON es.id = sr.exercice_seance_id
     JOIN exercises e ON e.id = es.exercise_id
     WHERE i.is_completed = 1 AND i.deleted_at IS NULL AND sr.deleted_at IS NULL AND sr.is_completed = 1
       AND es.deleted_at IS NULL AND e.deleted_at IS NULL`,
  )
  return lignes.sort((a, b) => normalizeSearch(a.nom).localeCompare(normalizeSearch(b.nom)))
}
