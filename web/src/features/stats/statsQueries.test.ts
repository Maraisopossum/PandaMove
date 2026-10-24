import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../../core/db/Db'
import { MUSCLE_GROUPS } from '../../core/db/types'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import {
  exercicesAvecHistorique, historiqueExercice, resumePeriode, tonnagePeriode, volumeParMuscle,
} from './statsQueries'

const b = { user_id: 'u1', updated_at: '2026-01-01T00:00:00Z', deleted_at: null }

async function exercice(db: Db, id: string, name: string, muscleGroups: string[], musclePrimary = '') {
  await inserer(db, 'exercises', {
    ...b, id, name, category: 'OTHER', muscle_groups: JSON.stringify(muscleGroups), muscle_primary: musclePrimary,
    is_favorite: 0, is_custom: 1, is_bodyweight: 0,
  })
}

async function instance(db: Db, id: string, date: string, isCompleted: boolean, extra: Record<string, unknown> = {}) {
  await inserer(db, 'instances_seance', {
    ...b, id, seance_id: 's1', date, is_completed: isCompleted ? 1 : 0, duration_seconds: 3000, ...extra,
  })
}

async function exSeance(db: Db, id: string, instanceId: string, exerciseId: string, repsType = 'REPS') {
  await inserer(db, 'exercices_seance', {
    ...b, id, seance_id: 's1', exercise_id: exerciseId, instance_seance_id: instanceId, position: 0, reps_type: repsType,
  })
}

let n = 0
async function serie(
  db: Db, instanceId: string, exSeanceId: string, numero: number, reps: number | null, charge: number | null,
  extra: Record<string, unknown> = {},
) {
  n += 1
  await inserer(db, 'series_realisees', {
    ...b, id: `sr-${String(n).padStart(3, '0')}`, instance_seance_id: instanceId, exercice_seance_id: exSeanceId,
    numero_serie: numero, reps_realisees: reps, charge_kg: charge, is_completed: 1, notes: '', ...extra,
  })
}

// Jeu de données commun : septembre (1 séance), octobre (1 séance terminée + bruit à exclure)
async function fixture(db: Db) {
  await inserer(db, 'seances', { ...b, id: 's1', nom: 'Haut', is_archived: 0, created_at: 'c' })
  // Muscle principal = premier de muscle_groups ; à défaut muscle_primary (effectivePrimary Android)
  await exercice(db, 'ex-dc', 'Développé couché', ['PECTORAUX', 'TRICEPS', 'EPAULES'], 'PECTORAUX')
  await exercice(db, 'ex-sq', 'Squat', [], 'QUADRICEPS')
  await exercice(db, 'ex-gain', 'Gainage', ['ABDOMINAUX', 'OBLIQUES'])
  await exercice(db, 'ex-tr', 'Tractions', ['DOS', 'BICEPS'])

  // Planifiée en septembre, terminée en octobre : compte en septembre (date), jamais par completed_at
  await instance(db, 'i-sep', '2026-09-28', true, { completed_at: '2026-10-02T18:00:00Z' })
  await exSeance(db, 'es-sep-dc', 'i-sep', 'ex-dc')
  await serie(db, 'i-sep', 'es-sep-dc', 1, 10, 60) // 600
  await serie(db, 'i-sep', 'es-sep-dc', 2, 8, 65) // 520

  await instance(db, 'i-oct', '2026-10-10', true, { completed_at: '2026-10-10T19:00:00Z' })
  await exSeance(db, 'es-oct-dc', 'i-oct', 'ex-dc')
  await exSeance(db, 'es-oct-sq', 'i-oct', 'ex-sq')
  await exSeance(db, 'es-oct-gain', 'i-oct', 'ex-gain', 'DURATION')
  await exSeance(db, 'es-oct-tr', 'i-oct', 'ex-tr')
  // Doublon (deux appareils) : seule la ligne au updated_at le plus récent compte (9 × 72 = 648)
  await serie(db, 'i-oct', 'es-oct-dc', 1, 10, 70, { updated_at: '2026-10-10T19:00:00Z' })
  await serie(db, 'i-oct', 'es-oct-dc', 1, 9, 72, { updated_at: '2026-10-10T19:05:00Z' })
  await serie(db, 'i-oct', 'es-oct-dc', 2, 8, 75) // 600
  await serie(db, 'i-oct', 'es-oct-dc', 3, 8, 80, { is_completed: 0 }) // non terminée : exclue
  await serie(db, 'i-oct', 'es-oct-sq', 1, 5, 100) // 500
  await serie(db, 'i-oct', 'es-oct-sq', 2, 5, 200, { deleted_at: '2026-10-11T00:00:00Z' }) // supprimée
  // DURATION : reps = secondes -> 0 en tonnage et hors du total de reps (mais compte comme série)
  await serie(db, 'i-oct', 'es-oct-gain', 1, 60, 10)
  await serie(db, 'i-oct', 'es-oct-gain', 2, 45, null)
  // Poids du corps : 0 en tonnage, mais série et reps comptées
  await serie(db, 'i-oct', 'es-oct-tr', 1, 8, null)

  // Instance non terminée (séries pourtant cochées) et instance supprimée : exclues
  await instance(db, 'i-plan', '2026-10-12', false)
  await exSeance(db, 'es-plan-dc', 'i-plan', 'ex-dc')
  await serie(db, 'i-plan', 'es-plan-dc', 1, 10, 100)
  await instance(db, 'i-del', '2026-10-11', true, { deleted_at: '2026-10-12T00:00:00Z' })
  await exSeance(db, 'es-del-dc', 'i-del', 'ex-dc')
  await serie(db, 'i-del', 'es-del-dc', 1, 10, 100)
}

const zeros = () => Object.fromEntries(MUSCLE_GROUPS.map((g) => [g, 0]))

describe('statsQueries', () => {
  let db: Db
  beforeEach(async () => {
    db = createTestDb()
    await fixture(db)
  })

  it('tonnage : Σ reps × charge des séries terminées, dédoublonnées, hors DURATION et poids du corps', async () => {
    expect(await tonnagePeriode(db, '2026-10-01', '2026-10-31')).toBe(648 + 600 + 500)
    expect(await tonnagePeriode(db, '2026-09-01', '2026-10-31')).toBe(1120 + 1748)
  })

  it('filtre par date planifiée : planifiée en septembre, terminée en octobre -> comptée en septembre seulement', async () => {
    expect(await tonnagePeriode(db, '2026-09-01', '2026-09-30')).toBe(1120)
    const oct = await resumePeriode(db, '2026-10-01', '2026-10-31')
    expect(oct.seancesTerminees).toBe(1)
    const sep = await resumePeriode(db, '2026-09-01', '2026-09-30')
    expect(sep).toEqual({ tonnageKg: 1120, seancesTerminees: 1, seriesTotal: 2, repsTotal: 18 })
  })

  it('résumé : séries (DURATION comprises) et reps (DURATION exclues), doublon compté une fois', async () => {
    expect(await resumePeriode(db, '2026-10-01', '2026-10-31')).toEqual({
      tonnageKg: 1748, seancesTerminees: 1, seriesTotal: 6, repsTotal: 9 + 8 + 5 + 8,
    })
  })

  it('à updated_at égal, la ligne au plus grand id gagne', async () => {
    const d = createTestDb()
    await exercice(d, 'ex', 'Curl', ['BICEPS'])
    await instance(d, 'i', '2026-10-01', true)
    await exSeance(d, 'es', 'i', 'ex')
    await inserer(d, 'series_realisees', {
      ...b, id: 'a', instance_seance_id: 'i', exercice_seance_id: 'es', numero_serie: 1, reps_realisees: 10, charge_kg: 10, is_completed: 1,
    })
    await inserer(d, 'series_realisees', {
      ...b, id: 'b', instance_seance_id: 'i', exercice_seance_id: 'es', numero_serie: 1, reps_realisees: 10, charge_kg: 12, is_completed: 1,
    })
    expect(await tonnagePeriode(d, '2026-10-01', '2026-10-01')).toBe(120)
  })

  it('la ligne la plus récente non terminée annule une ligne plus ancienne terminée', async () => {
    const d = createTestDb()
    await exercice(d, 'ex', 'Curl', ['BICEPS'])
    await instance(d, 'i', '2026-10-01', true)
    await exSeance(d, 'es', 'i', 'ex')
    await serie(d, 'i', 'es', 1, 10, 10, { updated_at: '2026-10-01T10:00:00Z' })
    await serie(d, 'i', 'es', 1, 10, 10, { updated_at: '2026-10-01T11:00:00Z', is_completed: 0 })
    expect(await resumePeriode(d, '2026-10-01', '2026-10-01')).toEqual({
      tonnageKg: 0, seancesTerminees: 1, seriesTotal: 0, repsTotal: 0,
    })
  })

  it('volume par muscle : nombre de séries terminées par muscle principal (règle Android), 16 clés', async () => {
    const v = await volumeParMuscle(db, '2026-10-01', '2026-10-31')
    expect(v).toEqual({ ...zeros(), PECTORAUX: 2, QUADRICEPS: 1, ABDOMINAUX: 2, DOS: 1 })
    expect(Object.keys(v).sort()).toEqual([...MUSCLE_GROUPS].sort())
  })

  it('volume par muscle : un muscle inconnu ou vide tombe dans AUTRE', async () => {
    await exercice(db, 'ex-x', 'Mystère', [' '], '')
    await exercice(db, 'ex-y', 'Mollets debout', ['mollets'])
    await instance(db, 'i-x', '2026-08-01', true)
    await exSeance(db, 'es-x', 'i-x', 'ex-x')
    await exSeance(db, 'es-y', 'i-x', 'ex-y')
    await serie(db, 'i-x', 'es-x', 1, 10, 10)
    await serie(db, 'i-x', 'es-y', 1, 10, 10)
    expect(await volumeParMuscle(db, '2026-08-01', '2026-08-31')).toEqual({ ...zeros(), AUTRE: 1, MOLLETS: 1 })
  })

  it('historique : max de charge et reps associées par date de séance, de la plus ancienne à la plus récente', async () => {
    expect(await historiqueExercice(db, 'ex-dc')).toEqual([
      { dateIso: '2026-09-28', maxChargeKg: 65, reps: 8, enSecondes: false },
      { dateIso: '2026-10-10', maxChargeKg: 75, reps: 8, enSecondes: false },
    ])
  })

  it('historique : poids du corps -> charge 0 et meilleures reps ; DURATION -> secondes', async () => {
    expect(await historiqueExercice(db, 'ex-tr')).toEqual([{ dateIso: '2026-10-10', maxChargeKg: 0, reps: 8, enSecondes: false }])
    expect(await historiqueExercice(db, 'ex-gain')).toEqual([{ dateIso: '2026-10-10', maxChargeKg: 10, reps: 60, enSecondes: true }])
  })

  it('exercices avec historique : ceux des séances terminées, triés par nom', async () => {
    expect(await exercicesAvecHistorique(db)).toEqual([
      { id: 'ex-dc', nom: 'Développé couché' },
      { id: 'ex-gain', nom: 'Gainage' },
      { id: 'ex-sq', nom: 'Squat' },
      { id: 'ex-tr', nom: 'Tractions' },
    ])
  })
})

describe('statsQueries sur base vide', () => {
  it('renvoie 0, des zéros et un historique vide sans exception', async () => {
    const db = createTestDb()
    expect(await tonnagePeriode(db, '2026-01-01', '2026-12-31')).toBe(0)
    expect(await volumeParMuscle(db, '2026-01-01', '2026-12-31')).toEqual(zeros())
    expect(await historiqueExercice(db, 'inconnu')).toEqual([])
    expect(await exercicesAvecHistorique(db)).toEqual([])
    expect(await resumePeriode(db, '2026-01-01', '2026-12-31')).toEqual({
      tonnageKg: 0, seancesTerminees: 0, seriesTotal: 0, repsTotal: 0,
    })
  })
})
