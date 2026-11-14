import { comparerHorodatages } from '../../core/common/parseTimestamp'
import { normalizeSearch } from '../../core/common/normalizeSearch'
import { muscleToGroup } from '../../core/catalogue/muscleToGroup'
import type { DbLecture } from '../../core/db/Db'
import { MUSCLE_GROUPS, type MuscleGroup } from '../../core/db/types'
import { ajouterJours } from '../endurance/calculCharge'
import { lundiDe } from '../home/semaine'

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
  /** Tonnage de la séance pour cet exercice (Σ reps × charge ; 0 pour une durée). */
  volumeKg: number
  /** Meilleur 1RM estimé (Epley) de la séance, 0 sans série chargée avec reps. */
  rmEstimeKg: number
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
  exercise_nom: string | null
}

// Une seule lecture : toutes les séries vivantes des instances terminées de la plage, avec le type de
// reps de l'exercice d'instance et les muscles de l'exercice catalogue (jointures facultatives).
// Une série dont la ligne d'exercice d'instance est SUPPRIMÉE est ignorée : son reps_type serait
// perdu (une série DURATION compterait ses secondes comme des reps). Une ligne simplement absente
// (pas encore synchronisée) garde la série.
const SQL_SERIES = `
  SELECT sr.id, sr.instance_seance_id, sr.exercice_seance_id, sr.numero_serie, sr.reps_realisees,
         sr.charge_kg, sr.is_completed, sr.updated_at, i.date AS date, es.reps_type AS reps_type,
         e.id AS exercise_id, e.name AS exercise_nom, e.muscle_groups AS muscle_groups, e.muscle_primary AS muscle_primary
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

// 1RM estimé (formule d'Epley) : charge × (1 + reps / 30). Une répétition = la charge elle-même. 0 sans charge ni reps.
export function rmEstime(chargeKg: number, reps: number): number {
  if (chargeKg <= 0 || reps <= 0) return 0
  return arrondi(reps === 1 ? chargeKg : chargeKg * (1 + reps / 30))
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
    const duree = estDuree(l)
    const existant = parDate.get(l.date)
    const point: PointHistorique = existant ?? { dateIso: l.date, maxChargeKg: 0, reps: 0, enSecondes: duree, volumeKg: 0, rmEstimeKg: 0 }
    if (!existant || charge > point.maxChargeKg || (charge === point.maxChargeKg && reps > point.reps)) {
      point.maxChargeKg = arrondi(charge)
      point.reps = reps
      point.enSecondes = duree
    }
    if (!duree) {
      point.volumeKg = arrondi(point.volumeKg + reps * charge)
      point.rmEstimeKg = Math.max(point.rmEstimeKg, rmEstime(charge, reps))
    }
    parDate.set(l.date, point)
  }
  return [...parDate.values()].sort((a, b) => a.dateIso.localeCompare(b.dateIso))
}

export interface Record1RM {
  exerciseId: string
  nom: string
  /** Meilleure série par 1RM estimé : charge, répétitions, jour. */
  chargeKg: number
  reps: number
  dateIso: string
  rmEstimeKg: number
  /** Record établi dans les 14 derniers jours : « nouveau record ». */
  recent: boolean
}

const JOURS_RECORD_RECENT = 14

const joursEntre = (de: string, a: string) =>
  Math.round((Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) - Date.UTC(+de.slice(0, 4), +de.slice(5, 7) - 1, +de.slice(8, 10))) / 86_400_000)

// Records personnels : pour chaque exercice chargé, la meilleure série par 1RM estimé (toutes dates, séries terminées). À 1RM
// égal, la plus récente. Les records récents d'abord, puis par 1RM décroissant ; `limite` entrées.
export async function recordsPersonnels(db: DbLecture, aujourdhuiIso: string, limite = 4): Promise<Record1RM[]> {
  const meilleurs = new Map<string, Record1RM>()
  for (const l of seriesRetenues(await db.getAll<LigneSerie>(SQL_SERIES))) {
    if (l.exercise_id === null || estDuree(l) || l.date > aujourdhuiIso) continue
    const rm = rmEstime(l.charge_kg ?? 0, l.reps_realisees ?? 0)
    if (rm <= 0) continue
    const actuel = meilleurs.get(l.exercise_id)
    if (!actuel || rm > actuel.rmEstimeKg || (rm === actuel.rmEstimeKg && l.date > actuel.dateIso)) {
      meilleurs.set(l.exercise_id, {
        exerciseId: l.exercise_id, nom: l.exercise_nom ?? 'Exercice', chargeKg: arrondi(l.charge_kg ?? 0), reps: l.reps_realisees ?? 0,
        dateIso: l.date, rmEstimeKg: rm, recent: joursEntre(l.date, aujourdhuiIso) <= JOURS_RECORD_RECENT,
      })
    }
  }
  return [...meilleurs.values()]
    .sort((a, b) => Number(b.recent) - Number(a.recent) || (a.recent ? b.dateIso.localeCompare(a.dateIso) : b.rmEstimeKg - a.rmEstimeKg))
    .slice(0, limite)
}

export interface TonnageSemaine {
  /** Lundi de la semaine (yyyy-MM-dd). */
  debut: string
  tonnageKg: number
}

// Tonnage des `n` dernières semaines (lundi au dimanche, la semaine en cours comprise), de la plus ancienne à la plus récente.
export async function tonnageParSemaine(db: DbLecture, aujourdhuiIso: string, n = 4): Promise<TonnageSemaine[]> {
  const lundiCourant = lundiDe(aujourdhuiIso)
  const debuts = Array.from({ length: n }, (_, i) => ajouterJours(lundiCourant, -7 * (n - 1 - i)))
  const series = await lireSeriesPlage(db, debuts[0], aujourdhuiIso)
  return debuts.map((debut) => ({ debut, tonnageKg: tonnage(series.filter((l) => lundiDe(l.date) === debut)) }))
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

// ── Suggestions du renforcement : charge récente, résumés de séances jouées, bilan d'une séance ───────────────────────────────

export interface BlocTonnage {
  /** Premier et dernier jour (yyyy-MM-dd) du bloc de 7 jours. */
  debut: string
  fin: string
  tonnageKg: number
}

// Tonnage de `n` blocs de 7 jours consécutifs terminant aujourd'hui (le dernier = les 7 derniers jours, aujourd'hui compris),
// du plus ancien au plus récent. Des blocs glissants plutôt que des semaines civiles : le début de semaine ne fausse pas la comparaison.
export async function tonnageBlocs7Jours(db: DbLecture, aujourdhuiIso: string, n = 5): Promise<BlocTonnage[]> {
  const debutTotal = ajouterJours(aujourdhuiIso, -(7 * n - 1))
  const series = await lireSeriesPlage(db, debutTotal, aujourdhuiIso)
  return Array.from({ length: n }, (_, i) => {
    const fin = ajouterJours(aujourdhuiIso, -7 * (n - 1 - i))
    const debut = ajouterJours(fin, -6)
    return { debut, fin, tonnageKg: tonnage(series.filter((l) => l.date >= debut && l.date <= fin)) }
  })
}

export interface ResumeInstanceJouee {
  instanceId: string
  seanceId: string
  date: string
  tonnageKg: number
  series: number
  dureeS: number
}

interface LigneInstance {
  id: string
  seance_id: string
  date: string
  duration_seconds: number | null
}

function resumeDe(l: LigneInstance, series: LigneSerie[]): ResumeInstanceJouee {
  return { instanceId: l.id, seanceId: l.seance_id, date: l.date, tonnageKg: tonnage(series), series: series.length, dureeS: l.duration_seconds ?? 0 }
}

// Séances jouées terminées entre deux jours, avec leur tonnage et leur nombre de séries (dédoublonnage et règles de tonnage des
// statistiques). Les plus récentes d'abord.
export async function resumesInstancesTerminees(db: DbLecture, depuisIso: string, jusquaIso = '9999-12-31'): Promise<ResumeInstanceJouee[]> {
  const [instances, series] = await Promise.all([
    db.getAll<LigneInstance>(
      'SELECT id, seance_id, date, duration_seconds FROM instances_seance WHERE is_completed = 1 AND deleted_at IS NULL AND date BETWEEN ? AND ? ORDER BY date DESC, id DESC',
      [depuisIso, jusquaIso],
    ),
    lireSeriesPlage(db, depuisIso, jusquaIso),
  ])
  const parInstance = new Map<string, LigneSerie[]>()
  for (const l of series) parInstance.set(l.instance_seance_id, [...(parInstance.get(l.instance_seance_id) ?? []), l])
  return instances.map((i) => resumeDe(i, parInstance.get(i.id) ?? []))
}

export interface BilanInstance {
  courante: ResumeInstanceJouee
  /** Séance précédente du même modèle (jour antérieur), ou null. */
  precedente: ResumeInstanceJouee | null
  /** Records battus : meilleur 1RM estimé de la séance supérieur à celui de toutes les séances antérieures (au moins une avec cet exercice). */
  records: { exerciseId: string; nom: string; chargeKg: number; reps: number; rmKg: number; ancienRmKg: number }[]
}

// Comparaison d'une séance terminée avec la précédente du même modèle, et records de la séance. null si la séance n'est pas terminée.
export async function bilanInstance(db: DbLecture, instanceId: string): Promise<BilanInstance | null> {
  const inst = await db.getOptional<LigneInstance>(
    'SELECT id, seance_id, date, duration_seconds FROM instances_seance WHERE id = ? AND is_completed = 1 AND deleted_at IS NULL',
    [instanceId],
  )
  if (!inst) return null
  const seriesDe = async (id: string) => seriesRetenues(await db.getAll<LigneSerie>(`${SQL_SERIES} AND sr.instance_seance_id = ?`, [id]))
  const [seriesCourante, precedenteLigne] = await Promise.all([
    seriesDe(inst.id),
    db.getOptional<LigneInstance>(
      `SELECT id, seance_id, date, duration_seconds FROM instances_seance
       WHERE seance_id = ? AND is_completed = 1 AND deleted_at IS NULL AND date < ? ORDER BY date DESC, id DESC LIMIT 1`,
      [inst.seance_id, inst.date],
    ),
  ])
  const precedente = precedenteLigne ? resumeDe(precedenteLigne, await seriesDe(precedenteLigne.id)) : null

  // Meilleure série (par 1RM estimé) de chaque exercice catalogue de la séance
  const meilleurs = new Map<string, { nom: string; chargeKg: number; reps: number; rmKg: number }>()
  for (const l of seriesCourante) {
    if (l.exercise_id === null || estDuree(l)) continue
    const rm = rmEstime(l.charge_kg ?? 0, l.reps_realisees ?? 0)
    if (rm <= 0) continue
    const m = meilleurs.get(l.exercise_id)
    if (!m || rm > m.rmKg) meilleurs.set(l.exercise_id, { nom: l.exercise_nom ?? 'Exercice', chargeKg: arrondi(l.charge_kg ?? 0), reps: l.reps_realisees ?? 0, rmKg: rm })
  }
  const records: BilanInstance['records'] = []
  if (meilleurs.size > 0) {
    const ids = [...meilleurs.keys()]
    const avant = seriesRetenues(
      await db.getAll<LigneSerie>(`${SQL_SERIES} AND i.date < ? AND e.id IN (${ids.map(() => '?').join(', ')})`, [inst.date, ...ids]),
    )
    const ancien = new Map<string, number>()
    for (const l of avant) {
      if (l.exercise_id === null || estDuree(l)) continue
      ancien.set(l.exercise_id, Math.max(ancien.get(l.exercise_id) ?? 0, rmEstime(l.charge_kg ?? 0, l.reps_realisees ?? 0)))
    }
    for (const [exerciseId, m] of meilleurs) {
      const a = ancien.get(exerciseId) ?? 0
      if (a > 0 && m.rmKg > a) records.push({ exerciseId, ...m, ancienRmKg: a })
    }
    records.sort((x, y) => y.rmKg - y.ancienRmKg - (x.rmKg - x.ancienRmKg))
  }
  return { courante: resumeDe(inst, seriesCourante), precedente, records }
}
