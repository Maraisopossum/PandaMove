// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Db } from '../../core/db/Db'
import { saveSettings } from '../../core/db/repos/settings'
import type { DisquesConfig, PlageConfig } from '../../core/progression/types'
import { createTestDb } from '../../test/sqliteDb'
import { useEquipment } from './useEquipment'

const USER = 'u1'

async function monter(db: Db) {
  const rendu = renderHook(() => useEquipment({ db, userId: USER }))
  await waitFor(() => expect(rendu.result.current.charge).toBe(true))
  return rendu
}

const stocke = async (db: Db) => {
  const l = await db.get<{ equipment_json: string }>('SELECT equipment_json FROM user_settings')
  return JSON.parse(l.equipment_json) as Record<string, unknown>
}

const BARRE: DisquesConfig = { barreKg: 20, disques: { '2.5': 4, '5': 2 } }
const KETTLEBELL: PlageConfig = { minKg: 8, maxKg: 24, pasKg: 4 }
const CABLE: PlageConfig = { minKg: 5, maxKg: 50, pasKg: 2.5 }

describe('useEquipment', () => {
  it('un utilisateur jamais configuré obtient un inventaire vide valide, sans écrire', async () => {
    const db = createTestDb()
    const { result } = await monter(db)
    expect(result.current.inventaire).toEqual({
      halteres: { poidsFixes: [], chargeable: null },
      barre: null,
      kettlebell: null,
      cable: null,
    })
    expect(result.current.categories).toEqual([])
    expect(result.current.pasParCategorie).toEqual({})
    const n = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM user_settings')
    expect(n.n).toBe(0)
  })

  it('tolère un equipment_json malformé', async () => {
    const db = createTestDb()
    await saveSettings(db, USER, { equipmentJson: 'pas du json' })
    const { result } = await monter(db)
    expect(result.current.inventaire.barre).toBeNull()
  })

  it('setBarre met à jour equipment_json et inventaire, sans second réglage', async () => {
    const db = createTestDb()
    const { result } = await monter(db)
    await act(() => result.current.setBarre(BARRE))
    expect(result.current.inventaire.barre).toEqual(BARRE)
    expect((await stocke(db)).barre).toEqual(BARRE)
    await act(() => result.current.setBarre({ ...BARRE, barreKg: 15 }))
    const n = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM user_settings')
    expect(n.n).toBe(1)
    // survit à un remontage
    const second = await monter(db)
    expect(second.result.current.inventaire.barre?.barreKg).toBe(15)
  })

  it('chaque setter préserve le reste de la forme stockée', async () => {
    const db = createTestDb()
    const { result } = await monter(db)
    await act(() => result.current.setBarre(BARRE))
    await act(() => result.current.setKettlebell(KETTLEBELL))
    await act(() => result.current.setCable(CABLE))
    await act(() => result.current.setHalteres({ poidsFixes: [4, 6], chargeable: BARRE }))
    await act(() => result.current.setPas('MACHINE', 5))
    await act(() => result.current.setCategories(['BARRE', 'MACHINE']))
    await act(() => result.current.setPas('RACK', 2.5))
    expect(await stocke(db)).toEqual({
      halteres: { poidsFixes: [4, 6], chargeable: BARRE },
      barre: BARRE,
      kettlebell: KETTLEBELL,
      cable: CABLE,
      selectedCategories: ['BARRE', 'MACHINE'],
      pasParCategorie: { MACHINE: 5, RACK: 2.5 },
    })
    expect(result.current.inventaire.kettlebell).toEqual(KETTLEBELL)
  })

  it("préserve un champ inconnu d'un export importé (patch fusionné)", async () => {
    const db = createTestDb()
    await saveSettings(db, USER, {
      equipmentJson: JSON.stringify({
        halteres: { poidsFixes: [10], chargeable: null }, barre: BARRE, kettlebell: null, cable: null,
        selectedCategories: ['BARRE'], pasParCategorie: { MACHINE: 5 },
      }),
    })
    const { result } = await monter(db)
    await act(() => result.current.setCable(CABLE))
    const s = await stocke(db)
    expect(s.barre).toEqual(BARRE)
    expect(s.selectedCategories).toEqual(['BARRE'])
    expect(s.pasParCategorie).toEqual({ MACHINE: 5 })
    expect(s.halteres).toEqual({ poidsFixes: [10], chargeable: null })
  })

  it('setPas enregistre le pas par catégorie et refuse une valeur invalide', async () => {
    const db = createTestDb()
    const { result } = await monter(db)
    await act(() => result.current.setPas('MACHINE', 5))
    expect(result.current.pasParCategorie).toEqual({ MACHINE: 5 })
    await expect(result.current.setPas('MACHINE', 0)).rejects.toThrow()
    await expect(result.current.setPas('MACHINE', Number.NaN)).rejects.toThrow()
    expect(result.current.pasParCategorie).toEqual({ MACHINE: 5 })
  })

  it('setCategories écarte les catégories inconnues', async () => {
    const db = createTestDb()
    const { result } = await monter(db)
    await act(() => result.current.setCategories(['BARRE', 'INCONNUE']))
    expect(result.current.categories).toEqual(['BARRE'])
  })

  it("expose les charges atteignables formatées pour l'affichage", async () => {
    const db = createTestDb()
    const { result } = await monter(db)
    await act(() => result.current.setKettlebell({ minKg: 8, maxKg: 16, pasKg: 4 }))
    await act(() => result.current.setHalteres({ poidsFixes: [Math.fround(17.7), 20], chargeable: null }))
    expect(result.current.apercu.kettlebell).toEqual(['8', '12', '16'])
    expect(result.current.apercu.halteres).toEqual(['17,7', '20'])
    expect(result.current.apercu.barre).toBeNull()
  })

  it('basculerCategorie coche et décoche sans toucher au reste', async () => {
    const db = createTestDb()
    const { result } = await monter(db)
    await act(() => result.current.setBarre(BARRE))
    await act(() => result.current.basculerCategorie('BARRE', true))
    await act(() => result.current.basculerCategorie('MACHINE', true))
    await act(() => result.current.basculerCategorie('BARRE', false))
    expect(result.current.categories).toEqual(['MACHINE'])
    expect((await stocke(db)).barre).toEqual(BARRE)
  })
})
