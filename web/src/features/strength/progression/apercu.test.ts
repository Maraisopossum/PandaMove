import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../../../core/db/Db'
import { saveObjectif } from '../../../core/db/repos/objectifs'
import { mapExerciceSeance } from '../../../core/db/repos/mappers'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'
import { calculerApercus } from './apercu'

const base = { user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null }
let db: Db
beforeEach(() => {
  db = createTestDb()
})

const ligne = (extra: Record<string, unknown> = {}) =>
  mapExerciceSeance({
    id: 'e1', exercise_id: 'x1', seance_id: 's1', nombre_series_prevues: 3, reps_cibles: '8', charge_cible: '60 kg', reps_type: 'REPS',
    progression_activee: 1, systeme_progression: 'LINEAIRE', type_exercice: 'COMPOSE_BAS', increment_kg: 2.5, ...extra,
  })

describe('calculerApercus : ce que proposerait la progression en cas de succès complet', () => {
  it('une proposition par exercice en progression, selon la cible courante', async () => {
    await inserer(db, 'exercises', { ...base, id: 'x1', name: 'Squat', equipment: '["Barre olympique"]' })
    const apercus = await calculerApercus(db, 's1', [ligne(), ligne({ id: 'e2', progression_activee: 0 })], undefined)
    expect([...apercus.keys()]).toEqual(['e1'])
    expect(apercus.get('e1')?.nouvelleChargeCible).toBeGreaterThan(60)
  })

  it('l’objectif de progression prime sur la cible du modèle', async () => {
    await inserer(db, 'exercises', { ...base, id: 'x1', name: 'Squat', equipment: '[]' })
    await saveObjectif(db, {
      seanceId: 's1', exerciseId: 'x1', chargeCible: 100, repsCible: 5, dureeCibleSec: null, compteurEchec: 0, derniereMaj: '2026-10-01',
      nombreSeriesCible: null,
    })
    const apercus = await calculerApercus(db, 's1', [ligne()], undefined)
    expect(apercus.get('e1')?.nouvelleChargeCible).toBeGreaterThan(100)
  })

  it('aucun exercice en progression : table vide, sans requête', async () => {
    expect((await calculerApercus(db, 's1', [ligne({ progression_activee: 0 })], undefined)).size).toBe(0)
  })
})
