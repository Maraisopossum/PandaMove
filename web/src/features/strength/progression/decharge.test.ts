import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../../../core/db/Db'
import { evaluerExercice } from '../../../core/progression/engine'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'
import { dechargeDue, referenceDecharge } from './decharge'
import { evaluerInstance } from './evaluation'

const SEMAINE = 7 * 24 * 3600 * 1000
const T = Date.parse('2026-09-01T10:00:00.000Z')

describe('horloge de la décharge planifiée (pure)', () => {
  it('référence : la décision de décharge la plus récente, à défaut la première séance, null sans historique', () => {
    expect(referenceDecharge([])).toBeNull()
    expect(referenceDecharge([{ instantMs: T + 2 * SEMAINE, decisionDecharge: false }, { instantMs: T, decisionDecharge: false }])).toBe(T)
    expect(
      referenceDecharge([
        { instantMs: T, decisionDecharge: false },
        { instantMs: T + 3 * SEMAINE, decisionDecharge: true },
        { instantMs: T + 5 * SEMAINE, decisionDecharge: false },
      ]),
    ).toBe(T + 3 * SEMAINE)
  })

  it('due au bout de N semaines pleines, jamais si désactivée ou sans historique', () => {
    const passages = [{ instantMs: T, decisionDecharge: false }]
    expect(dechargeDue(passages, T + 4 * SEMAINE - 1, 4)).toBe(false)
    expect(dechargeDue(passages, T + 4 * SEMAINE, 4)).toBe(true)
    expect(dechargeDue(passages, T + 40 * SEMAINE, 0)).toBe(false)
    expect(dechargeDue([], T + 40 * SEMAINE, 4)).toBe(false)
  })
})

describe('moteur : succès avec décharge échue', () => {
  const config = {
    repsType: 'REPS', systemeProgression: 'LINEAIRE', repsMin: null, repsMax: null, incrementKg: 2.5, incrementDureeSec: 5,
    seuilDeload: 3, typeExercice: null, incrementPct: null, isBodyweight: false, nombreSeriesPrevues: 3,
  } as const
  const cible = { chargeKg: 60, reps: 8, dureeSec: null }
  const reussies = [8, 8, 8].map((repsRealisees) => ({ repsRealisees, chargeKg: 60, rpe: null, notes: '' }))

  it('sans décharge échue : montée normale', () => {
    const p = evaluerExercice(config, cible, 0, reussies, false)
    expect(p.deload).toBe(false)
    expect(p.nouvelleChargeCible).toBe(62.5)
  })

  it('avec décharge échue : -10 % proposé, marqué planifié, statut de succès conservé', () => {
    const p = evaluerExercice(config, cible, 0, reussies, false, null, null, true)
    expect(p).toMatchObject({ statut: 'SUCCES', deload: true, dechargePlanifiee: true, nouvelleChargeCible: 55, nouveauCompteurEchec: 0 })
  })

  it('un échec reste un échec : la décharge planifiée ne s’applique qu’à un succès', () => {
    const rates = [7, 7, 7].map((repsRealisees) => ({ repsRealisees, chargeKg: 60, rpe: null, notes: '' }))
    const p = evaluerExercice(config, cible, 0, rates, false, null, null, true)
    expect(p.dechargePlanifiee).toBeUndefined()
    expect(p.deload).toBe(false)
  })
})

describe('évaluation d’une instance avec décharge planifiée', () => {
  const commun = { user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null }
  let db: Db

  async function instance(id: string, date: string, progression: string | null) {
    await inserer(db, 'instances_seance', {
      ...commun, id, seance_id: 's1', date, notes: '', is_completed: 1, completed_at: `${date}T11:00:00.000Z`,
      duration_seconds: 2700, created_at: 'c', started_at: `${date}T10:15:00.000Z`, progression_json: progression,
    })
    await inserer(db, 'exercices_seance', {
      ...commun, id: `e-${id}`, seance_id: 's1', instance_seance_id: id, exercise_id: 'x1', bloc_id: null, position: 0,
      nombre_series_prevues: 3, reps_cibles: '8', charge_cible: '60 kg', reps_type: 'REPS', temps_repos_sec: 90,
      progression_activee: 1, systeme_progression: 'LINEAIRE', reps_min: null, reps_max: null, increment_kg: 2.5,
      increment_duree_sec: 5, seuil_deload: 3, type_exercice: null, increment_pct: null, is_bodyweight: 0, is_bilateral: 0,
    })
    for (let n = 1; n <= 3; n++) {
      await inserer(db, 'series_realisees', {
        ...commun, id: `${id}-s${n}`, instance_seance_id: id, exercice_seance_id: `e-${id}`, numero_serie: n,
        reps_realisees: 8, charge_kg: 60, rpe: null, notes: '', is_completed: 1,
      })
    }
  }

  beforeEach(async () => {
    db = createTestDb()
    await inserer(db, 'seances', { ...commun, id: 's1', nom: 'Haut du corps', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
    await inserer(db, 'exercises', { ...commun, id: 'x1', name: 'Développé couché', equipment: '["Barre"]', is_bodyweight: 0 })
  })

  const proposition = async (id: string, semaines: number) => (await evaluerInstance(db, id, 'u1', undefined, semaines))[0].proposition

  it('désactivée (0) ou trop tôt : montée normale ; échue : décharge proposée', async () => {
    await instance('i1', '2026-09-01', null)
    await instance('i2', '2026-09-22', null)
    await instance('i3', '2026-10-06', null)
    expect((await proposition('i3', 0)).deload).toBe(false)
    expect((await proposition('i3', 8)).deload).toBe(false)
    expect(await proposition('i3', 4)).toMatchObject({ deload: true, dechargePlanifiee: true })
  })

  it('une décision de décharge antérieure remet l’horloge à zéro ; la décision de l’instance évaluée est ignorée', async () => {
    const decharge = JSON.stringify({
      evaluee: true,
      decisions: { 'e-i2': 'refusee' },
      bases: {
        'e-i2': {
          cible: { chargeKg: 60, reps: 8, dureeSec: null }, avant: null,
          ecrit: { chargeCible: 60, repsCible: 8, dureeCibleSec: null, compteurEchec: 0, nombreSeriesCible: null, derniereMaj: '2026-09-22' },
          proposition: { statut: 'SUCCES', chargeCible: 54, repsCible: 8, dureeCibleSec: null, compteurEchec: 0, nombreSeries: null, deload: true },
          seriesAvant: null, seriesApres: null,
        },
      },
    })
    await instance('i1', '2026-09-01', null)
    await instance('i2', '2026-09-22', decharge)
    await instance('i3', '2026-10-06', null)
    // i3 : 2 semaines après la décharge refusée d'i2 → pas échue pour 4 semaines
    expect((await proposition('i3', 4)).deload).toBe(false)
    // i2 : sa propre décision est ignorée, l'horloge part d'i1 (3 semaines) → pas échue à 4, échue à 3
    expect((await proposition('i2', 4)).deload).toBe(false)
    expect((await proposition('i2', 3)).deload).toBe(true)
  })
})
