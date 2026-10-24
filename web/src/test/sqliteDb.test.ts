import { describe, expect, it } from 'vitest'
import { createTestDb } from './sqliteDb'

describe('createTestDb', () => {
  it('annule la transaction si la fonction échoue', async () => {
    const db = createTestDb()
    await expect(
      db.writeTransaction(async (tx) => {
        await tx.execute(`INSERT INTO seances (id, nom) VALUES ('a', 'x')`)
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(await db.getAll('SELECT id FROM seances')).toHaveLength(0)
  })

  it('valide la transaction réussie', async () => {
    const db = createTestDb()
    await db.writeTransaction(async (tx) => {
      await tx.execute(`INSERT INTO seances (id, nom) VALUES ('a', 'x')`)
    })
    expect(await db.getAll('SELECT id FROM seances')).toHaveLength(1)
  })
})
