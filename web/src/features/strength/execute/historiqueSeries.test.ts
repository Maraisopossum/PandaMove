import { describe, expect, it } from 'vitest'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'
import { dernieresSeries } from './historiqueSeries'

const base = { user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null }

async function semer() {
  const db = createTestDb()
  for (const [id, date, fait] of [['i-vieille', '2026-09-01', 1], ['i-recente', '2026-10-10', 1], ['i-courante', '2026-10-24', 0], ['i-planifiee', '2026-11-01', 0]] as const) {
    await inserer(db, 'instances_seance', { ...base, id, seance_id: 's', date, notes: '', is_completed: fait, created_at: 'c' })
    await inserer(db, 'exercices_seance', { ...base, id: `es-${id}`, seance_id: 's', exercise_id: 'x1', instance_seance_id: id })
  }
  const serie = (instance: string, numero: number, reps: number, charge: number, extra: Record<string, unknown> = {}) =>
    inserer(db, 'series_realisees', {
      ...base, id: `${instance}-${numero}`, instance_seance_id: instance, exercice_seance_id: `es-${instance}`, numero_serie: numero,
      reps_realisees: reps, charge_kg: charge, is_completed: 1, notes: '', ...extra,
    })
  await serie('i-vieille', 1, 5, 40)
  await serie('i-recente', 1, 8, 60)
  await serie('i-recente', 2, 7, 62.5)
  await serie('i-recente', 3, 6, 65, { is_completed: 0 })
  await serie('i-courante', 1, 9, 70)
  return db
}

describe('dernieresSeries', () => {
  it("séries validées de la séance terminée la plus récente, hors instance courante", async () => {
    const db = await semer()
    const r = await dernieresSeries(db, 'i-courante', ['x1', 'inconnu'])
    expect(r.get('x1')).toEqual([
      { numero: 1, reps: 8, chargeKg: 60 },
      { numero: 2, reps: 7, chargeKg: 62.5 },
    ])
    expect(r.has('inconnu')).toBe(false)
  })

  it('aucun exercice : résultat vide', async () => {
    expect((await dernieresSeries(createTestDb(), 'i', [])).size).toBe(0)
  })
})
