// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import { dateIsoValide } from './affectation'
import { useSeanceList } from './useSeanceList'

async function seance(db: Db, id: string, nom: string, extra: Record<string, unknown> = {}) {
  await inserer(db, 'seances', {
    id, user_id: 'u1', updated_at: 'u', deleted_at: null, nom, groupes_musculaires: '["DOS","BICEPS"]',
    duree_estimee_min: 45, notes: '', seance_category: 'STRENGTH', created_at: 'c', is_archived: 0, ...extra,
  })
}

async function exo(db: Db, id: string, seanceId: string, instanceId: string | null = null, extra: Record<string, unknown> = {}) {
  await inserer(db, 'exercices_seance', {
    id, user_id: 'u1', updated_at: 'u', deleted_at: null, seance_id: seanceId, exercise_id: 'x', position: 0,
    instance_seance_id: instanceId, ...extra,
  })
}

async function base() {
  const db = createTestDb()
  await seance(db, 's1', 'Pull')
  await seance(db, 's2', 'Push', { groupes_musculaires: '["PECTORAUX"]' })
  await seance(db, 's3', 'Archivée', { is_archived: 1 })
  await seance(db, 's4', 'Supprimée', { deleted_at: 'x' })
  await seance(db, 's5', 'Course', { seance_category: 'RUNNING' })
  await exo(db, 'e1', 's1')
  await exo(db, 'e2', 's1')
  await exo(db, 'e3', 's1', 'inst') // ligne d'instance : ne compte pas
  await exo(db, 'e4', 's1', null, { deleted_at: 'x' }) // supprimée : ne compte pas
  await exo(db, 'e5', 's2')
  return db
}

async function monter(db: Db) {
  const rendu = renderHook(() => useSeanceList({ db }))
  await waitFor(() => expect(rendu.result.current.charge).toBe(true))
  return rendu
}

describe('dateIsoValide', () => {
  it('accepte uniquement de vraies dates yyyy-MM-dd', () => {
    expect(dateIsoValide('2026-10-24')).toBe(true)
    expect(dateIsoValide('2024-02-29')).toBe(true)
    expect(dateIsoValide('2026-02-29')).toBe(false)
    expect(dateIsoValide('2026-02-30')).toBe(false)
    expect(dateIsoValide('2026-13-01')).toBe(false)
    expect(dateIsoValide('2026-00-10')).toBe(false)
    expect(dateIsoValide('2026-4-5')).toBe(false)
    expect(dateIsoValide('24/10/2026')).toBe(false)
    expect(dateIsoValide('')).toBe(false)
    expect(dateIsoValide('2026-10-24T10:00')).toBe(false)
  })
})

describe('useSeanceList', () => {
  it('liste les modèles de renforcement vivants et non archivés, avec leur nombre d\'exercices', async () => {
    const { result } = await monter(await base())
    expect(result.current.seances.map((s) => s.nom)).toEqual(['Pull', 'Push'])
    expect(result.current.nbExercices).toEqual({ s1: 2, s2: 1 })
    expect(result.current.erreur).toBeNull()
  })

  it('archiver retire la séance de la liste sans la supprimer', async () => {
    const db = await base()
    const { result } = await monter(db)
    await act(() => result.current.archiver('s1'))
    expect(result.current.seances.map((s) => s.id)).toEqual(['s2'])
    const l = await db.get<{ is_archived: number; deleted_at: string | null; updated_at: string }>(
      'SELECT is_archived, deleted_at, updated_at FROM seances WHERE id = ?', ['s1'],
    )
    expect(l.is_archived).toBe(1)
    expect(l.deleted_at).toBeNull()
    expect(l.updated_at).not.toBe('u')
    const n = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM exercices_seance WHERE seance_id = ? AND deleted_at IS NULL', ['s1'])
    expect(n.n).toBe(3)
  })

  it('archiver une séance inconnue expose une erreur sans rien casser', async () => {
    const { result } = await monter(await base())
    await act(() => result.current.archiver('nope'))
    expect(result.current.erreur).toMatch(/introuvable/i)
    expect(result.current.seances).toHaveLength(2)
  })

  it('assigner crée une instance à la date donnée, non terminée, sans copier le modèle', async () => {
    const db = await base()
    const { result } = await monter(db)
    let id = ''
    await act(async () => {
      id = await result.current.assigner('s1', '2026-11-03')
    })
    const inst = await db.get<Record<string, unknown>>('SELECT * FROM instances_seance WHERE id = ?', [id])
    expect(inst).toMatchObject({ seance_id: 's1', date: '2026-11-03', is_completed: 0 })
    // Aucune copie template -> instance à l'affectation (faite à l'ouverture de l'exécution)
    const copies = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM exercices_seance WHERE instance_seance_id = ?', [id])
    expect(copies.n).toBe(0)
    const modele = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM exercices_seance WHERE seance_id = ? AND instance_seance_id IS NULL', ['s1'])
    expect(modele.n).toBe(3)
  })

  it('assigner rejette dates invalides ou impossibles avec un message français', async () => {
    const db = await base()
    const { result } = await monter(db)
    for (const date of ['2026-02-30', '2026-13-01', '24/10/2026', '', '2026-10-24T08:00']) {
      await expect(result.current.assigner('s1', date), date).rejects.toThrow(/date/i)
    }
    const n = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM instances_seance')
    expect(n.n).toBe(0)
  })

  it('assigner rejette une séance inconnue ou supprimée', async () => {
    const db = await base()
    const { result } = await monter(db)
    await expect(result.current.assigner('nope', '2026-11-03')).rejects.toThrow(/introuvable/i)
    await expect(result.current.assigner('s4', '2026-11-03')).rejects.toThrow(/introuvable/i)
    const n = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM instances_seance')
    expect(n.n).toBe(0)
  })

  it("rafraîchit la liste après une écriture : un nouveau montage voit l'état persisté", async () => {
    const db = await base()
    const premier = await monter(db)
    await act(() => premier.result.current.archiver('s2'))
    premier.unmount()
    const second = await monter(db)
    expect(second.result.current.seances.map((s) => s.id)).toEqual(['s1'])
  })

  it('supprimer retire la séance de la liste (suppression logique) ; compterHistorique renvoie les effectifs', async () => {
    const db = await base()
    for (const [id, fait] of [['ip', 0], ['ic', 1]] as const) {
      await inserer(db, 'instances_seance', {
        id, user_id: 'u1', updated_at: 'u', deleted_at: null, seance_id: 's1', date: 'd', is_completed: fait,
      })
    }
    const { result } = await monter(db)
    expect(await result.current.compterHistorique('s1')).toEqual({ planifiees: 1, realisees: 1 })
    let ok = false
    await act(async () => {
      ok = await result.current.supprimer('s1', 'garder_historique')
    })
    expect(ok).toBe(true)
    expect(result.current.seances.map((s) => s.id)).toEqual(['s2'])
    const l = await db.get<{ deleted_at: string | null }>('SELECT deleted_at FROM seances WHERE id = ?', ['s1'])
    expect(l.deleted_at).not.toBeNull()
    const ic = await db.get<{ deleted_at: string | null }>('SELECT deleted_at FROM instances_seance WHERE id = ?', ['ic'])
    expect(ic.deleted_at).toBeNull()
  })

  it('supprimer une séance inconnue expose un message français, sans rejet non géré', async () => {
    const { result } = await monter(await base())
    let ok = true
    await act(async () => {
      ok = await result.current.supprimer('nope', 'tout')
    })
    expect(ok).toBe(false)
    expect(result.current.erreur).toMatch(/introuvable/i)
    expect(result.current.seances).toHaveLength(2)
  })

  it('une panne inattendue de suppression donne un message générique', async () => {
    const db = await base()
    const casse: Db = { ...db, writeTransaction: () => Promise.reject(new Error('boum')) }
    const rendu = renderHook(() => useSeanceList({ db: casse }))
    await waitFor(() => expect(rendu.result.current.charge).toBe(true))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await act(async () => {
      await rendu.result.current.supprimer('s1', 'tout')
    })
    expect(rendu.result.current.erreur).toBe('La suppression a échoué.')
  })

  it('compterHistorique en échec renvoie null et expose une erreur', async () => {
    const db = await base()
    const casse: Db = { ...db, get: () => Promise.reject(new Error('x')) }
    const rendu = renderHook(() => useSeanceList({ db: casse }))
    await waitFor(() => expect(rendu.result.current.charge).toBe(true))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let c: unknown = 'x'
    await act(async () => {
      c = await rendu.result.current.compterHistorique('s1')
    })
    expect(c).toBeNull()
    expect(rendu.result.current.erreur).toBe("Le décompte de l'historique a échoué.")
  })
})
