// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import { useCalendar } from './useCalendar'

const base = { user_id: 'u1', updated_at: 'u0', deleted_at: null }
const NOW = new Date(2026, 9, 24, 15, 30) // 24 octobre 2026, heure locale
const nowFn = () => NOW

async function seance(db: Db, id: string, nom: string, extra: Record<string, unknown> = {}) {
  await inserer(db, 'seances', { ...base, id, nom, is_archived: 0, created_at: 'c', ...extra })
}
async function instance(db: Db, id: string, seanceId: string, date: string, extra: Record<string, unknown> = {}) {
  await inserer(db, 'instances_seance', { ...base, id, seance_id: seanceId, date, is_completed: 0, ...extra })
}

async function monter(db: Db, mois = { year: 2026, month: 10 }) {
  const rendu = renderHook(({ m }) => useCalendar(m, { db, nowFn }), { initialProps: { m: mois } })
  await waitFor(() => expect(rendu.result.current.chargement).toBe(false))
  return rendu
}

const jour = (r: Awaited<ReturnType<typeof monter>>, iso: string) => r.result.current.jours.find((j) => j.dateIso === iso)

describe('useCalendar — lecture', () => {
  it('base vide : grille sans événement, prochaines vide, pas d\'erreur', async () => {
    const r = await monter(createTestDb())
    expect(r.result.current.erreur).toBeNull()
    expect(r.result.current.jours).toHaveLength(35)
    expect(r.result.current.jours.every((j) => j.instances.length === 0)).toBe(true)
    expect(r.result.current.prochaines).toEqual([])
    expect(jour(r, '2026-10-24')?.estAujourdhui).toBe(true)
    expect(r.result.current.filtre).toEqual({ statut: 'toutes' })
  })

  it('une instance apparaît le jour de sa date et pas le jour de completed_at', async () => {
    const db = createTestDb()
    await seance(db, 's1', 'Pull')
    await instance(db, 'a', 's1', '2026-10-05', { is_completed: 1, completed_at: '2026-10-20T09:00:00.000Z', duration_seconds: 10 })
    const r = await monter(db)
    expect(jour(r, '2026-10-05')?.instances.map((i) => i.id)).toEqual(['a'])
    expect(jour(r, '2026-10-20')?.instances).toEqual([])
  })

  it('les jours des mois voisins visibles portent leurs instances (dansLeMois false)', async () => {
    const db = createTestDb()
    await seance(db, 's1', 'Pull')
    await instance(db, 'a', 's1', '2026-09-30')
    await instance(db, 'b', 's1', '2026-11-01')
    const r = await monter(db)
    expect(jour(r, '2026-09-30')).toMatchObject({ dansLeMois: false })
    expect(jour(r, '2026-09-30')?.instances.map((i) => i.id)).toEqual(['a'])
    expect(jour(r, '2026-11-01')?.instances.map((i) => i.id)).toEqual(['b'])
  })

  it("une séance supprimée avec « garder l'historique » garde son nom sur ses instances réalisées", async () => {
    const db = createTestDb()
    await seance(db, 's1', 'Pull', { deleted_at: 'x' })
    await instance(db, 'a', 's1', '2026-10-05', { is_completed: 1 })
    const r = await monter(db)
    expect(jour(r, '2026-10-05')?.instances[0]).toMatchObject({ nom: 'Pull', etat: 'terminee' })
  })

  it("prochaines : croissantes, sans terminées ni supprimées, indépendantes du mois affiché", async () => {
    const db = createTestDb()
    await seance(db, 's1', 'Pull')
    await instance(db, 'b', 's1', '2026-12-10')
    await instance(db, 'a', 's1', '2026-10-25')
    await instance(db, 'faite', 's1', '2026-10-26', { is_completed: 1 })
    await instance(db, 'sup', 's1', '2026-10-27', { deleted_at: 'x' })
    await instance(db, 'passee', 's1', '2026-10-01')
    const r = await monter(db, { year: 2027, month: 6 })
    expect(r.result.current.prochaines.map((i) => i.id)).toEqual(['a', 'b'])
    expect(r.result.current.jours.every((j) => j.instances.length === 0)).toBe(true)
  })

  it('change de mois quand le paramètre change', async () => {
    const db = createTestDb()
    await seance(db, 's1', 'Pull')
    await instance(db, 'n', 's1', '2026-11-10')
    const r = await monter(db)
    expect(jour(r, '2026-11-10')).toBeUndefined()
    r.rerender({ m: { year: 2026, month: 11 } })
    await waitFor(() => expect(jour(r, '2026-11-10')?.instances.map((i) => i.id)).toEqual(['n']))
  })

  it('filtres planifiées / terminées appliqués à la grille mais pas aux prochaines', async () => {
    const db = createTestDb()
    await seance(db, 's1', 'Pull')
    await instance(db, 'p', 's1', '2026-10-28')
    await instance(db, 'c', 's1', '2026-10-28', { started_at: '2026-10-28T08:00:00.000Z' })
    await instance(db, 't', 's1', '2026-10-28', { is_completed: 1 })
    const r = await monter(db)
    const ids = () => jour(r, '2026-10-28')?.instances.map((i) => i.id)
    expect(ids()).toEqual(['c', 'p', 't'])
    act(() => r.result.current.setFiltre({ statut: 'planifiees' }))
    expect(ids()).toEqual(['c', 'p']) // « planifiées » = non terminées (planifiées ou en cours)
    act(() => r.result.current.setFiltre({ statut: 'terminees' }))
    expect(ids()).toEqual(['t'])
    expect(r.result.current.filtre).toEqual({ statut: 'terminees' })
    expect(r.result.current.prochaines.map((i) => i.id)).toEqual(['c', 'p'])
  })

  it('erreur de lecture : message français, pas de rejet non géré', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const db = createTestDb()
    const casse: Db = { ...db, getAll: () => Promise.reject(new Error('boum')) }
    const r = renderHook(() => useCalendar({ year: 2026, month: 10 }, { db: casse, nowFn }))
    await waitFor(() => expect(r.result.current.erreur).toMatch(/chargement/i))
    expect(r.result.current.chargement).toBe(false)
  })
})

describe('useCalendar — actions', () => {
  async function avecDonnees() {
    const db = createTestDb()
    await seance(db, 's1', 'Pull')
    await instance(db, 'p', 's1', '2026-10-28')
    await instance(db, 't', 's1', '2026-10-05', { is_completed: 1 })
    return { db, r: await monter(db) }
  }

  it('deplacer met à jour la date et rafraîchit grille et prochaines', async () => {
    const { r } = await avecDonnees()
    await act(() => r.result.current.deplacer('p', '2026-10-30'))
    expect(jour(r, '2026-10-28')?.instances).toEqual([])
    expect(jour(r, '2026-10-30')?.instances.map((i) => i.id)).toEqual(['p'])
    expect(r.result.current.prochaines[0].dateIso).toBe('2026-10-30')
    expect(r.result.current.erreur).toBeNull()
  })

  it("deplacer vers une date impossible : erreur française dans `erreur`, pas de rejet, rien d'écrit", async () => {
    const { db, r } = await avecDonnees()
    await act(() => r.result.current.deplacer('p', '2026-02-30'))
    expect(r.result.current.erreur).toMatch(/date invalide/i)
    expect((await db.get<{ date: string }>("SELECT date FROM instances_seance WHERE id = 'p'")).date).toBe('2026-10-28')
  })

  it('deplacer une terminée : erreur', async () => {
    const { r } = await avecDonnees()
    await act(() => r.result.current.deplacer('t', '2026-10-06'))
    expect(r.result.current.erreur).toMatch(/terminée/i)
    expect(jour(r, '2026-10-05')?.instances.map((i) => i.id)).toEqual(['t'])
  })

  it('une action réussie efface l\'erreur précédente', async () => {
    const { r } = await avecDonnees()
    await act(() => r.result.current.deplacer('p', 'nope'))
    expect(r.result.current.erreur).not.toBeNull()
    await act(() => r.result.current.deplacer('p', '2026-10-29'))
    expect(r.result.current.erreur).toBeNull()
  })

  it('supprimerInstance retire la séance de la grille et des prochaines', async () => {
    const { r } = await avecDonnees()
    await act(() => r.result.current.supprimerInstance('p'))
    expect(jour(r, '2026-10-28')?.instances).toEqual([])
    expect(r.result.current.prochaines).toEqual([])
    await act(() => r.result.current.supprimerInstance('t'))
    expect(jour(r, '2026-10-05')?.instances).toEqual([])
    await act(() => r.result.current.supprimerInstance('t'))
    expect(r.result.current.erreur).toMatch(/introuvable/i)
  })

  it('échec technique d\'écriture : message générique français', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { db } = await avecDonnees()
    const casse: Db = { ...db, writeTransaction: () => Promise.reject(new Error('boum')) }
    const r = renderHook(() => useCalendar({ year: 2026, month: 10 }, { db: casse, nowFn }))
    await waitFor(() => expect(r.result.current.chargement).toBe(false))
    await act(() => r.result.current.supprimerInstance('p'))
    expect(r.result.current.erreur).toMatch(/échoué/i)
  })
})
