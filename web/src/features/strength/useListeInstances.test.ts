// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import { useListeInstances } from './useListeInstances'

const base = { user_id: 'u1', updated_at: 'u0', deleted_at: null }

async function semer(db: Db) {
  await inserer(db, 'seances', { ...base, id: 's1', nom: 'Pull', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
  await inserer(db, 'instances_seance', { ...base, id: 'p', seance_id: 's1', date: '2026-10-30', is_completed: 0 })
  await inserer(db, 'instances_seance', { ...base, id: 't', seance_id: 's1', date: '2026-10-01', is_completed: 1, duration_seconds: 60 })
}

afterEach(() => vi.restoreAllMocks())

describe('useListeInstances', () => {
  it('programmées : seules les non terminées', async () => {
    const db = createTestDb()
    await semer(db)
    const r = renderHook(() => useListeInstances('programmees', { db }))
    expect(r.result.current.chargement).toBe(true)
    await waitFor(() => expect(r.result.current.chargement).toBe(false))
    expect(r.result.current.erreur).toBeNull()
    expect(r.result.current.instances.map((i) => i.id)).toEqual(['p'])
  })

  it('terminées : seules les terminées', async () => {
    const db = createTestDb()
    await semer(db)
    const r = renderHook(() => useListeInstances('terminees', { db }))
    await waitFor(() => expect(r.result.current.chargement).toBe(false))
    expect(r.result.current.instances.map((i) => i.id)).toEqual(['t'])
  })

  it("échec de lecture : message français ; « recharger » efface l'erreur et relit", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const db = createTestDb()
    await semer(db)
    let panne = true
    const fragile: Db = {
      ...db,
      getAll: (sql, params) => (panne ? Promise.reject(new Error('base HS')) : db.getAll(sql, params)),
    }
    const r = renderHook(() => useListeInstances('programmees', { db: fragile }))
    await waitFor(() => expect(r.result.current.erreur).toBe('Le chargement des séances a échoué.'))
    expect(r.result.current.chargement).toBe(false)
    expect(r.result.current.instances).toEqual([])

    panne = false
    await act(() => r.result.current.recharger())
    expect(r.result.current.erreur).toBeNull()
    expect(r.result.current.instances.map((i) => i.id)).toEqual(['p'])
  })
})
