// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Db } from '../../../core/db/Db'
import { deterministicId } from '../../../core/db/ids'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'
import { useCatalog } from './useCatalog'

const USER = 'u1'

async function exo(db: Db, id: string, name: string, extra: Record<string, unknown> = {}) {
  await inserer(db, 'exercises', {
    id, user_id: USER, updated_at: 'u', deleted_at: null, name, category: 'OTHER', muscle_groups: '[]',
    description: '', is_favorite: 0, is_custom: 1, image_url: null, exercise_type: '', equipment: '[]',
    muscle_primary: '', is_bodyweight: 0, ...extra,
  })
}

async function monter(db: Db) {
  const rendu = renderHook(() => useCatalog({ db, userId: USER }))
  await waitFor(() => expect(rendu.result.current.charge).toBe(true))
  return rendu
}

async function base() {
  const db = createTestDb()
  await exo(db, 'a', 'Développé couché', { muscle_primary: 'PECTORAUX', muscle_groups: '["PECTORAUX","TRICEPS"]' })
  await exo(db, 'b', 'Écarté poulie', { muscle_primary: 'PECTORAUX', muscle_groups: '["PECTORAUX"]' })
  await exo(db, 'c', 'Dips', { muscle_primary: 'TRICEPS', muscle_groups: '["TRICEPS","PECTORAUX"]' })
  await exo(db, 'd', 'Curl', { muscle_primary: 'BICEPS', muscle_groups: '["BICEPS"]', is_favorite: 1 })
  await exo(db, 'e', 'Supprimé', { deleted_at: 'x' })
  return db
}

describe('useCatalog', () => {
  it('liste par nom normalisé (accents ignorés) sans les supprimés', async () => {
    const { result } = await monter(await base())
    expect(result.current.exercices.map((e) => e.name)).toEqual(['Curl', 'Développé couché', 'Dips', 'Écarté poulie'])
  })

  it('la recherche ignore accents et casse', async () => {
    const { result } = await monter(await base())
    act(() => result.current.setFiltre({ ...result.current.filtre, query: 'DEVELOPPE' }))
    expect(result.current.exercices.map((e) => e.id)).toEqual(['a'])
    act(() => result.current.setFiltre({ ...result.current.filtre, query: 'ecarte' }))
    expect(result.current.exercices.map((e) => e.id)).toEqual(['b'])
  })

  it('le filtre muscle retient le muscle principal OU un des groupes', async () => {
    const { result } = await monter(await base())
    act(() => result.current.setFiltre({ ...result.current.filtre, muscle: 'TRICEPS' }))
    // a : TRICEPS dans les groupes ; c : en principal ; b : non
    expect(result.current.exercices.map((e) => e.id).sort()).toEqual(['a', 'c'])
    act(() => result.current.setFiltre({ ...result.current.filtre, muscle: 'PECTORAUX' }))
    // c : PECTORAUX seulement dans les groupes ; b : en principal
    expect(result.current.exercices.map((e) => e.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('favorisSeulement ne garde que les favoris', async () => {
    const { result } = await monter(await base())
    act(() => result.current.setFiltre({ ...result.current.filtre, favorisSeulement: true }))
    expect(result.current.exercices.map((e) => e.id)).toEqual(['d'])
  })

  it('toggleFavori persiste et survit à un nouveau montage', async () => {
    const db = await base()
    const premier = await monter(db)
    await act(() => premier.result.current.toggleFavori('a'))
    expect(premier.result.current.exercices.find((e) => e.id === 'a')?.isFavorite).toBe(true)
    premier.unmount()
    const second = await monter(db)
    expect(second.result.current.exercices.find((e) => e.id === 'a')?.isFavorite).toBe(true)
    await act(() => second.result.current.toggleFavori('a'))
    expect(second.result.current.exercices.find((e) => e.id === 'a')?.isFavorite).toBe(false)
  })

  it("creerPersonnalise écrit is_custom=1 avec l'id déterministe de l'import", async () => {
    const db = await base()
    const { result } = await monter(db)
    await act(() =>
      result.current.creerPersonnalise({ name: '  Tirage Vertical ', muscleGroups: ['DOS'], musclePrimary: 'DOS' }),
    )
    const id = deterministicId(`${USER}:exercises`, 'tirage vertical')
    const ligne = await db.get<Record<string, unknown>>('SELECT * FROM exercises WHERE id = ?', [id])
    expect(ligne).toMatchObject({
      is_custom: 1, user_id: USER, name: 'Tirage Vertical', muscle_primary: 'DOS',
      muscle_groups: '["DOS"]', category: 'OTHER', deleted_at: null,
    })
    expect(result.current.exercices.some((e) => e.id === id)).toBe(true)
  })

  it('creerPersonnalise refuse un nom vide', async () => {
    const { result } = await monter(await base())
    await expect(result.current.creerPersonnalise({ name: '   ', muscleGroups: [] })).rejects.toThrow(/nom/i)
  })

  it('creerPersonnalise refuse un doublon de nom normalisé', async () => {
    const db = await base()
    const { result } = await monter(db)
    await expect(result.current.creerPersonnalise({ name: 'DEVELOPPE   couche', muscleGroups: [] })).rejects.toThrow(
      /existe déjà/,
    )
    const n = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM exercises')
    expect(n.n).toBe(5)
  })

  it('creerPersonnalise refuse de remplacer un exercice vivant renommé (même id déterministe)', async () => {
    const db = createTestDb()
    const id = deterministicId(`${USER}:exercises`, 'squat')
    // Importé « Squat » (id X) puis renommé « Back squat »
    await exo(db, id, 'Back squat', { is_favorite: 1 })
    const { result } = await monter(db)
    await expect(result.current.creerPersonnalise({ name: 'Squat', muscleGroups: [] })).rejects.toThrow(/existe déjà/)
    const l = await db.get<{ name: string }>('SELECT name FROM exercises WHERE id = ?', [id])
    expect(l.name).toBe('Back squat')
  })

  it('un exercice supprimé libère son nom (ressuscité, pas dupliqué)', async () => {
    const db = createTestDb()
    const id = deterministicId(`${USER}:exercises`, 'squat')
    await exo(db, id, 'Squat', { deleted_at: 'x' })
    const { result } = await monter(db)
    await act(() => result.current.creerPersonnalise({ name: 'Squat', muscleGroups: [] }))
    const lignes = await db.getAll<{ deleted_at: string | null }>('SELECT deleted_at FROM exercises')
    expect(lignes).toEqual([{ deleted_at: null }])
  })

  it("supprimer masque l'exercice (suppression logique)", async () => {
    const db = await base()
    const { result } = await monter(db)
    await act(() => result.current.supprimer('a'))
    expect(result.current.exercices.some((e) => e.id === 'a')).toBe(false)
    const l = await db.get<{ deleted_at: string | null }>('SELECT deleted_at FROM exercises WHERE id = ?', ['a'])
    expect(l.deleted_at).not.toBeNull()
  })

  it("modifier met à jour les champs et refuse le nom d'un autre exercice", async () => {
    const db = await base()
    const { result } = await monter(db)
    await act(() =>
      result.current.modifier('a', { name: 'Développé incliné', muscleGroups: ['PECTORAUX'], musclePrimary: 'PECTORAUX', description: 'x' }),
    )
    expect(result.current.exercices.find((e) => e.id === 'a')).toMatchObject({ name: 'Développé incliné', description: 'x' })
    await expect(result.current.modifier('a', { name: 'dips', muscleGroups: [] })).rejects.toThrow(/existe déjà/)
    // Garder son propre nom (casse différente) reste permis
    await act(() => result.current.modifier('a', { name: 'DÉVELOPPÉ INCLINÉ', muscleGroups: [] }))
  })
})

describe('useCatalog — catalogue de base', () => {
  it("installe le catalogue de base, affiche le résultat en français et masque l'action", async () => {
    const db = createTestDb()
    const { result } = await monter(db)
    await waitFor(() => expect(result.current.baseInstallee).toBe(false))
    await act(async () => { await result.current.installerBase() })
    expect(result.current.operation.message).toBe('166 exercices ajoutés, 0 corrigé.')
    expect(result.current.operation.erreur).toBeNull()
    expect(result.current.baseInstallee).toBe(true)
    expect(result.current.exercices).toHaveLength(166)
  })

  it('corrige les groupes musculaires et recharge la liste', async () => {
    const db = createTestDb()
    await exo(db, 'z', 'Mon exo', { muscle_groups: '["Grand dorsal"]' })
    const { result } = await monter(db)
    await act(async () => { await result.current.corrigerGroupes() })
    expect(result.current.operation.message).toBe('1 exercice corrigé.')
    expect(result.current.exercices[0].musclePrimary).toBe('DOS')
  })

  it("expose une erreur en français quand l'écriture échoue", async () => {
    const db = createTestDb()
    const { result } = await monter(db)
    const casse: Db = { ...db, getAll: db.getAll.bind(db), get: db.get.bind(db), getOptional: db.getOptional.bind(db), execute: db.execute.bind(db), writeTransaction: () => Promise.reject(new Error('boom')) }
    const rendu = renderHook(() => useCatalog({ db: casse, userId: USER }))
    await waitFor(() => expect(rendu.result.current.charge).toBe(true))
    await act(async () => { await rendu.result.current.corrigerGroupes() })
    expect(rendu.result.current.operation.erreur).toBe('La correction a échoué. Réessayez.')
    expect(rendu.result.current.operation.enCours).toBe(false)
    void result
  })
})
