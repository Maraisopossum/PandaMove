// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../../core/db/Db'
import { saveSettings } from '../../core/db/repos/settings'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import { CLE_PERIODE } from './periode'
import { useStats } from './useStats'

const b = { user_id: 'u1', updated_at: '2026-01-01T00:00:00Z', deleted_at: null }
const USER = '11111111-1111-4111-8111-111111111111'
const nowFn = () => new Date(2026, 9, 24, 15, 0)

let db: Db

async function seanceTerminee(id: string, date: string, reps: number, charge: number) {
  await inserer(db, 'instances_seance', { ...b, id, seance_id: 's1', date, is_completed: 1, duration_seconds: 1800 })
  await inserer(db, 'exercices_seance', {
    ...b, id: `es-${id}`, seance_id: 's1', exercise_id: 'ex-dc', instance_seance_id: id, position: 0, reps_type: 'REPS',
  })
  await inserer(db, 'series_realisees', {
    ...b, id: `sr-${id}`, instance_seance_id: id, exercice_seance_id: `es-${id}`, numero_serie: 1,
    reps_realisees: reps, charge_kg: charge, is_completed: 1,
  })
}

beforeEach(async () => {
  localStorage.clear()
  db = createTestDb()
  await inserer(db, 'exercises', {
    ...b, id: 'ex-dc', name: 'Développé couché', category: 'CHEST', muscle_groups: '["PECTORAUX"]', muscle_primary: '',
  })
  await seanceTerminee('i1', '2026-10-20', 10, 50) // dans les 7 derniers jours : 500
  await seanceTerminee('i2', '2026-09-01', 10, 40) // dans les 3 derniers mois seulement : 400
})

afterEach(() => localStorage.clear())

describe('useStats', () => {
  it('charge la période par défaut (30 jours) puis recharge quand la période change, et la retient', async () => {
    const { result } = renderHook(() => useStats({ db, nowFn }))
    await waitFor(() => expect(result.current.chargement).toBe(false))
    expect(result.current.periode).toBe('30j')
    expect(result.current.resume).toEqual({ tonnageKg: 500, seancesTerminees: 1, seriesTotal: 1, repsTotal: 10 })
    expect(result.current.groupes[0]).toMatchObject({ groupe: 'PECTORAUX', series: 1 })

    act(() => result.current.choisirPeriode('3m'))
    await waitFor(() => expect(result.current.resume.tonnageKg).toBe(900))
    expect(result.current.chargement).toBe(false)
    expect(localStorage.getItem(CLE_PERIODE)).toBe('3m')
  })

  it('reprend la période enregistrée', async () => {
    localStorage.setItem(CLE_PERIODE, '7j')
    const { result } = renderHook(() => useStats({ db, nowFn }))
    await waitFor(() => expect(result.current.chargement).toBe(false))
    expect(result.current.periode).toBe('7j')
    expect(result.current.resume.tonnageKg).toBe(500)
  })

  it('choisit le premier exercice et charge son historique ; lit la variante du panda', async () => {
    await saveSettings(db, USER, { pandaVariant: 'female' })
    const { result } = renderHook(() => useStats({ db, nowFn, userId: USER }))
    await waitFor(() => expect(result.current.historique).toHaveLength(2))
    expect(result.current.exercices).toEqual([{ id: 'ex-dc', nom: 'Développé couché' }])
    expect(result.current.exerciceId).toBe('ex-dc')
    expect(result.current.historique.map((p) => p.maxChargeKg)).toEqual([40, 50])
    await waitFor(() => expect(result.current.variante).toBe('female'))
  })

  it('bascule face / dos', async () => {
    const { result } = renderHook(() => useStats({ db, nowFn }))
    await waitFor(() => expect(result.current.chargement).toBe(false))
    expect(result.current.vue).toBe('face')
    act(() => result.current.setVue('dos'))
    expect(result.current.vue).toBe('dos')
  })

  it('base vide : état vide, aucun exercice, sans erreur', async () => {
    db = createTestDb()
    const { result } = renderHook(() => useStats({ db, nowFn }))
    await waitFor(() => expect(result.current.chargement).toBe(false))
    expect(result.current.vide).toBe(true)
    expect(result.current.erreur).toBeNull()
    expect(result.current.exercices).toEqual([])
    expect(result.current.historique).toEqual([])
  })
})
