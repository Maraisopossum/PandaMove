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

  describe('garde de compatibilité avec les vues PowerSync', () => {
    const interdits: [string, string][] = [
      ['ON CONFLICT', `INSERT INTO seances (id, nom) VALUES ('a', 'x') ON CONFLICT(id) DO UPDATE SET nom = 'y'`],
      ['RETURNING', `INSERT INTO seances (id, nom) VALUES ('a', 'x') RETURNING id`],
      ['UPDATE ... FROM', `UPDATE seances SET nom = s2.nom FROM seances s2 WHERE seances.id = 'a'`],
    ]

    for (const [nom, sql] of interdits) {
      it(`rejette ${nom} (execute, lectures et transaction)`, async () => {
        const db = createTestDb()
        await expect(db.execute(sql)).rejects.toThrow(/vues/)
        await expect(db.getAll(sql)).rejects.toThrow(/vues/)
        await expect(db.get(sql)).rejects.toThrow(/vues/)
        await expect(db.getOptional(sql)).rejects.toThrow(/vues/)
        await expect(db.writeTransaction((tx) => tx.execute(sql))).rejects.toThrow(/vues/)
        await expect(db.writeTransaction((tx) => tx.getAll(sql))).rejects.toThrow(/vues/)
      })
    }

    it('accepte INSERT, UPDATE et SELECT simples, et un UPDATE avec sous-select', async () => {
      const db = createTestDb()
      await db.execute(`INSERT INTO seances (id, nom, notes) VALUES ('a', 'x', 'n')`)
      await db.execute(`UPDATE seances SET nom = ? WHERE id = ?`, ['y', 'a'])
      await db.execute(`UPDATE seances SET notes = (SELECT nom FROM seances WHERE id = 'a') WHERE id = 'a'`)
      await db.execute(`UPDATE seances SET nom = 'z' WHERE id IN (SELECT id FROM seances)`)
      expect(await db.getAll('SELECT nom, notes FROM seances')).toEqual([{ nom: 'z', notes: 'y' }])
    })
  })
})
