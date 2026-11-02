import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../../../core/db/Db'
import { estEligibleCalibration, proposerCalibration } from '../../../core/progression/calibration'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'
import { appliquerDecision, evaluerEtAppliquerSilencieux, evaluerInstance } from './evaluation'
import { reevaluerApresCorrection } from './reevaluation'

const serie = (repsRealisees: number, chargeKg: number | null) => ({ repsRealisees, chargeKg, rpe: null, notes: '' })
const cible = { chargeKg: null, reps: 8, dureeSec: null }

describe('calibration (pure)', () => {
  it('éligibles : polyarticulaires et machines à charge ; pas isolation, poids de corps, durée ni type vide', () => {
    const base = { repsType: 'REPS', isBodyweight: false } as const
    expect(estEligibleCalibration({ ...base, typeExercice: 'COMPOSE_BAS' })).toBe(true)
    expect(estEligibleCalibration({ ...base, typeExercice: 'COMPOSE_HAUT' })).toBe(true)
    expect(estEligibleCalibration({ ...base, typeExercice: 'MACHINE' })).toBe(true)
    expect(estEligibleCalibration({ ...base, typeExercice: 'ISOLATION' })).toBe(false)
    expect(estEligibleCalibration({ ...base, typeExercice: null })).toBe(false)
    expect(estEligibleCalibration({ ...base, typeExercice: 'COMPOSE_HAUT', isBodyweight: true })).toBe(false)
    expect(estEligibleCalibration({ ...base, typeExercice: 'COMPOSE_HAUT', repsType: 'DURATION' })).toBe(false)
  })

  it('charge la plus lourde tenue dans la plage ; répétitions réalisées, bornées au haut de plage', () => {
    const plage = { repsMin: 6, repsMax: 10 }
    expect(proposerCalibration(plage, cible, [serie(8, 60), serie(7, 70), serie(4, 80)])).toMatchObject({
      statut: 'SUCCES', nouvelleChargeCible: 70, nouveauRepsCible: 7, calibration: true, deload: false, nouveauCompteurEchec: 0,
    })
    expect(proposerCalibration(plage, cible, [serie(14, 40)])?.nouveauRepsCible).toBe(10)
  })

  it('à charge égale, le plus de répétitions ; aucune série concluante : rien', () => {
    expect(proposerCalibration({ repsMin: 6, repsMax: 10 }, cible, [serie(6, 60), serie(9, 60)])?.nouveauRepsCible).toBe(9)
    expect(proposerCalibration({ repsMin: 6, repsMax: 10 }, cible, [serie(4, 80), serie(5, 80)])).toBeNull()
    expect(proposerCalibration({ repsMin: 6, repsMax: 10 }, cible, [serie(8, null)])).toBeNull()
  })
})

describe('calibration à la première séance (base en mémoire)', () => {
  const commun = { user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null }
  let db: Db

  async function instance(id: string, date: string, reps: number[], charges: number[], extraEx: Record<string, unknown> = {}) {
    await inserer(db, 'instances_seance', {
      ...commun, id, seance_id: 's1', date, notes: '', is_completed: 1, completed_at: `${date}T11:00:00.000Z`,
      duration_seconds: 2700, created_at: 'c', started_at: `${date}T10:15:00.000Z`, progression_json: null,
    })
    await inserer(db, 'exercices_seance', {
      ...commun, id: `e-${id}`, seance_id: 's1', instance_seance_id: id, exercise_id: 'x1', bloc_id: null, position: 0,
      nombre_series_prevues: 3, reps_cibles: '8', charge_cible: '', reps_type: 'REPS', temps_repos_sec: 90,
      progression_activee: 1, systeme_progression: 'DOUBLE', reps_min: 6, reps_max: 10, increment_kg: 2.5,
      increment_duree_sec: 5, seuil_deload: 3, type_exercice: 'COMPOSE_HAUT', increment_pct: null, is_bodyweight: 0, is_bilateral: 0,
      ...extraEx,
    })
    for (let n = 0; n < reps.length; n++) {
      await inserer(db, 'series_realisees', {
        ...commun, id: `${id}-s${n}`, instance_seance_id: id, exercice_seance_id: `e-${id}`, numero_serie: n + 1,
        reps_realisees: reps[n], charge_kg: charges[n], rpe: null, notes: '', is_completed: 1,
      })
    }
  }

  const objectif = () =>
    db.getOptional<{ charge_cible: number | null; reps_cible: number | null; compteur_echec: number }>(
      'SELECT charge_cible, reps_cible, compteur_echec FROM objectifs_progression WHERE seance_id = ? AND deleted_at IS NULL', ['s1'],
    )
  const marqueur = async (id: string) =>
    JSON.parse((await db.get<{ progression_json: string | null }>('SELECT progression_json FROM instances_seance WHERE id = ?', [id])).progression_json ?? 'null') as {
      decisions: Record<string, string>; bases?: Record<string, { calibration?: boolean; regle?: number }>
    } | null

  beforeEach(async () => {
    db = createTestDb()
    await inserer(db, 'seances', { ...commun, id: 's1', nom: 'Haut du corps', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
    await inserer(db, 'exercises', { ...commun, id: 'x1', name: 'Développé couché', equipment: '["Barre"]', is_bodyweight: 0 })
  })

  it('première séance sans objectif : proposition de calibration à valider, jamais un échec ni un deload', async () => {
    await instance('i1', '2026-10-01', [4, 8, 7], [80, 60, 70])
    const [e] = await evaluerInstance(db, 'i1', 'u1')
    expect(e.proposition).toMatchObject({ statut: 'SUCCES', calibration: true, nouvelleChargeCible: 70, nouveauRepsCible: 7, deload: false })
    expect(e.aValider).toBe(true)
  })

  it('rien n’est écrit à la fin de séance ; « Oui » écrit l’objectif et une base marquée calibration', async () => {
    await instance('i1', '2026-10-01', [8, 8, 8], [60, 60, 60])
    await db.writeTransaction((tx) => evaluerEtAppliquerSilencieux(tx, 'i1', { userId: 'u1', maintenantMs: Date.parse('2026-10-01T12:00:00Z') }))
    expect(await objectif()).toBeNull()
    const [e] = await evaluerInstance(db, 'i1', 'u1')
    await db.writeTransaction((tx) => appliquerDecision(tx, 'i1', e, { type: 'accepter' }, Date.parse('2026-10-01T12:00:00Z')))
    expect(await objectif()).toMatchObject({ charge_cible: 60, reps_cible: 8, compteur_echec: 0 })
    const m = await marqueur('i1')
    expect(m?.decisions['e-i1']).toBe('acceptee')
    expect(m?.bases?.['e-i1']).toMatchObject({ calibration: true })
  })

  it('exercice non joué ou séries non concluantes : aucune proposition, rien à écrire', async () => {
    await instance('i1', '2026-10-01', [], [])
    expect(await evaluerInstance(db, 'i1', 'u1')).toEqual([])
    await instance('i2', '2026-10-08', [3, 4], [100, 100])
    expect(await evaluerInstance(db, 'i2', 'u1')).toEqual([])
  })

  it('exercice d’isolation ou sans type : évaluation normale, pas de calibration', async () => {
    await instance('i1', '2026-10-01', [8, 8, 8], [20, 20, 20], { type_exercice: 'ISOLATION', charge_cible: '20 kg' })
    const [e] = await evaluerInstance(db, 'i1', 'u1')
    expect(e.proposition.calibration).toBeUndefined()
  })

  it('séance suivante : plus de calibration, évaluation normale avec l’objectif écrit', async () => {
    await instance('i1', '2026-10-01', [8, 8, 8], [60, 60, 60])
    const [e1] = await evaluerInstance(db, 'i1', 'u1')
    await db.writeTransaction((tx) => appliquerDecision(tx, 'i1', e1, { type: 'accepter' }, Date.parse('2026-10-01T12:00:00Z')))
    await instance('i2', '2026-10-08', [9, 9, 9], [60, 60, 60], { charge_cible: '60 kg' })
    const [e2] = await evaluerInstance(db, 'i2', 'u1')
    expect(e2.proposition.calibration).toBeUndefined()
    expect(e2.proposition).toMatchObject({ statut: 'SUCCES', nouvelleChargeCible: 60, nouveauRepsCible: 10 })
  })

  it('correction d’une séance calibrée : la calibration est recalculée, jamais une évaluation normale', async () => {
    await instance('i1', '2026-10-01', [8, 8, 8], [60, 60, 60])
    const [e] = await evaluerInstance(db, 'i1', 'u1')
    await db.writeTransaction((tx) => appliquerDecision(tx, 'i1', e, { type: 'accepter' }, Date.parse('2026-10-01T12:00:00Z')))
    expect(await objectif()).toMatchObject({ charge_cible: 60 })
    // Correction : les séries étaient en fait à 70 kg
    await db.execute("UPDATE series_realisees SET charge_kg = 70 WHERE instance_seance_id = 'i1'")
    const changements = await reevaluerApresCorrection(db, 'i1', { userId: 'u1', maintenantMs: Date.parse('2026-10-02T09:00:00Z') })
    expect(changements).toEqual([{ exerciceId: 'e-i1', nom: 'Développé couché', effet: 'a_redecider' }])
    // L'ancien objectif est retiré, la décision est à reprendre au bilan avec la nouvelle charge
    expect(await objectif()).toBeNull()
    const [apres] = await evaluerInstance(db, 'i1', 'u1')
    expect(apres.proposition).toMatchObject({ calibration: true, nouvelleChargeCible: 70 })
  })
})
