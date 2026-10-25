// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../../core/db/Db'
import { deterministicId } from '../../../core/db/ids'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'
import { useExecute } from './useExecute'

// Actions propres à la séance jouée : renommer l'instance, note par exercice, abandon sans trace.
const base = { user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null }
const T0 = Date.parse('2026-10-24T10:00:00.000Z')
const E1 = deterministicId('i1', 'e1')

const horloge = () => T0 // référence stable (sinon l'effet d'ouverture redémarre à chaque rendu)
let db: Db
beforeEach(async () => {
  db = createTestDb()
  await inserer(db, 'seances', { ...base, id: 's1', nom: 'Haut du corps', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
  await inserer(db, 'exercises', { ...base, id: 'x1', name: 'Développé couché', is_bodyweight: 0 })
  await inserer(db, 'exercices_seance', {
    ...base, id: 'e1', seance_id: 's1', exercise_id: 'x1', position: 0, nombre_series_prevues: 3, reps_cibles: '8', charge_cible: '60 kg',
    reps_type: 'REPS', temps_repos_sec: 90, instance_seance_id: null,
  })
  await inserer(db, 'instances_seance', {
    ...base, id: 'i1', seance_id: 's1', date: '2026-10-24', notes: '', is_completed: 0, completed_at: null, duration_seconds: 0, created_at: 'c',
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function monter() {
  const rendu = renderHook(() => useExecute('i1', { db, nowFn: horloge, tickMs: 1_000_000 }))
  await waitFor(() => expect(rendu.result.current.chargement).toBe(false))
  return rendu
}

describe('useExecute : renommer la séance en cours', () => {
  it("écrit le nom sur l'instance, jamais sur le modèle, et l'affiche aussitôt", async () => {
    const r = await monter()
    expect(r.result.current.nomSeance).toBe('Haut du corps')
    let ok = false
    await act(async () => {
      ok = await r.result.current.renommer('  Haut du corps — lourd ')
    })
    expect(ok).toBe(true)
    expect(r.result.current.nomSeance).toBe('Haut du corps — lourd')
    expect((await db.get<{ nom: string }>("SELECT nom FROM seances WHERE id = 's1'")).nom).toBe('Haut du corps')
    expect((await db.get<{ nom: string }>("SELECT nom FROM instances_seance WHERE id = 'i1'")).nom).toBe('Haut du corps — lourd')
  })

  it('un nom vide rétablit le nom du modèle', async () => {
    const r = await monter()
    await act(async () => void (await r.result.current.renommer('Autre')))
    await act(async () => void (await r.result.current.renommer('   ')))
    expect(r.result.current.nomSeance).toBe('Haut du corps')
  })

  it('refuse sur une séance terminée', async () => {
    await db.execute("UPDATE instances_seance SET is_completed = 1, completed_at = '2026-10-24T11:00:00.000Z' WHERE id = 'i1'")
    const r = await monter()
    let ok = true
    await act(async () => {
      ok = await r.result.current.renommer('Autre')
    })
    expect(ok).toBe(false)
    expect((await db.get<{ nom: string | null }>("SELECT nom FROM instances_seance WHERE id = 'i1'")).nom).toBeNull()
  })
})

describe('useExecute : note par exercice', () => {
  it('enregistre la note sur la ligne d’instance et la remonte dans la vue', async () => {
    const r = await monter()
    await act(async () => void (await r.result.current.noterExercice(E1, 'Épaule gênante')))
    expect(r.result.current.exercices.find((e) => e.id === E1)?.ligne.notes).toBe('Épaule gênante')
    expect((await db.get<{ notes: string | null }>("SELECT notes FROM exercices_seance WHERE id = 'e1'")).notes).toBeNull()
  })
})

describe('useExecute : quitter sans enregistrer', () => {
  it('remet la séance à l’état planifié quand aucune série n’est validée', async () => {
    const r = await monter()
    await act(async () => void (await r.result.current.demarrer()))
    expect(r.result.current.demarre).toBe(true)
    let ok = false
    await act(async () => {
      ok = await r.result.current.abandonnerDemarrage()
    })
    expect(ok).toBe(true)
    expect(r.result.current.demarre).toBe(false)
  })
})
