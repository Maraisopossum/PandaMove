import { describe, expect, it, vi } from 'vitest'
import { createTestDb } from '../../test/sqliteDb'
import { cleDrapeauCatalogue, installerAutomatiquement, type StockageDrapeau } from './installationAuto'

function stockageMemoire(): StockageDrapeau & { valeurs: Map<string, string> } {
  const valeurs = new Map<string, string>()
  return { valeurs, lire: (c) => valeurs.get(c) ?? null, ecrire: (c, v) => void valeurs.set(c, v) }
}
const compte = async (db: ReturnType<typeof createTestDb>) => (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM exercises')).n

describe('installerAutomatiquement', () => {
  it('attend la synchro, installe une fois, pose le drapeau', async () => {
    const db = createTestDb()
    const stockage = stockageMemoire()
    const ordre: string[] = []
    const attendreSynchro = vi.fn(async () => { ordre.push(`synchro:${await compte(db)}`) })
    const r = await installerAutomatiquement({ db, userId: 'u1', attendreSynchro, stockage })
    expect(r).toMatchObject({ ajoutes: 166 })
    expect(ordre).toEqual(['synchro:0'])
    expect(stockage.valeurs.get(cleDrapeauCatalogue('u1'))).toBe('1')
    expect(await installerAutomatiquement({ db, userId: 'u1', attendreSynchro, stockage })).toBeNull()
    expect(attendreSynchro).toHaveBeenCalledTimes(1)
  })

  it("ne fait rien si le catalogue est déjà là (arrivé par synchro), et pose le drapeau", async () => {
    const db = createTestDb()
    const stockage = stockageMemoire()
    await installerAutomatiquement({ db, userId: 'u1', attendreSynchro: async () => {}, stockage: stockageMemoire() })
    const r = await installerAutomatiquement({ db, userId: 'u1', attendreSynchro: async () => {}, stockage })
    expect(r).toBeNull()
    expect(stockage.valeurs.has(cleDrapeauCatalogue('u1'))).toBe(true)
    expect(await compte(db)).toBe(166)
  })

  it("ne pose pas le drapeau si l'installation échoue", async () => {
    const db = createTestDb()
    const stockage = stockageMemoire()
    await expect(
      installerAutomatiquement({ db, userId: 'u1', attendreSynchro: async () => { throw new Error('hors ligne') }, stockage }),
    ).rejects.toThrow('hors ligne')
    expect(stockage.valeurs.size).toBe(0)
  })
})
