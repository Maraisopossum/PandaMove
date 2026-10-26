import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../../test/sqliteDb'
import type { Db } from './Db'
import { upsertRow } from './upsert'

let db: Db
beforeEach(() => {
  db = createTestDb()
})

const base = { user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null }

describe('upsertRow', () => {
  it('insère une ligne absente', async () => {
    const r = await db.writeTransaction((tx) => upsertRow(tx, 'exercises', { id: 'e1', ...base, name: 'Squat' }))
    expect(r).toBe('inserted')
    expect(await db.getAll('SELECT id, name FROM exercises')).toEqual([{ id: 'e1', name: 'Squat' }])
  })

  it('met à jour une ligne existante sans en créer une seconde', async () => {
    await db.writeTransaction((tx) => upsertRow(tx, 'exercises', { id: 'e1', ...base, name: 'Squat' }))
    const r = await db.writeTransaction((tx) => upsertRow(tx, 'exercises', { id: 'e1', ...base, name: 'Front squat' }))
    expect(r).toBe('updated')
    expect(await db.getAll('SELECT id, name FROM exercises')).toEqual([{ id: 'e1', name: 'Front squat' }])
  })

  it('refuse une table inconnue', async () => {
    await expect(db.writeTransaction((tx) => upsertRow(tx, 'nimporte; DROP TABLE x', { id: 'a' }))).rejects.toThrow(
      /Table inconnue/,
    )
  })

  it('refuse une colonne inconnue avec un message clair et n\'écrit rien', async () => {
    await expect(
      db.writeTransaction((tx) => upsertRow(tx, 'exercises', { id: 'e1', ...base, name: 'x', pirate: 1 })),
    ).rejects.toThrow(/Colonne inconnue « pirate » pour la table exercises/)
    expect(await db.getAll('SELECT id FROM exercises')).toEqual([])
  })

  it('exige un id', async () => {
    await expect(db.writeTransaction((tx) => upsertRow(tx, 'exercises', { ...base }))).rejects.toThrow(/id/)
  })
})
