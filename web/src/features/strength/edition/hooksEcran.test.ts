// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'
import { nouveauBloc, nouvelExercice, type BlocDraft } from '../draft'
import { useAvertissementFermeture } from './useAvertissementFermeture'
import { useEchauffement } from './useEchauffement'
import { useSuppressionBloc } from './useSuppressionBloc'

const blocAvec = (n: number): BlocDraft => ({
  ...nouveauBloc('b1', 'SUPERSET'),
  exercices: Array.from({ length: n }, (_, i) => nouvelExercice(`e${i}`, { id: 'x', name: 'X', muscles: [], equipment: [], isBodyweight: false }, 'SUPERSET')),
})

describe('useSuppressionBloc', () => {
  it('un bloc vide est supprimé tout de suite', () => {
    const supprimer = vi.fn()
    const { result } = renderHook(() => useSuppressionBloc(supprimer))
    act(() => result.current.demander(blocAvec(0)))
    expect(supprimer).toHaveBeenCalledWith('b1')
    expect(result.current.enAttente).toBeNull()
  })

  it('un bloc garni demande confirmation : annuler ne supprime rien, confirmer supprime', () => {
    const supprimer = vi.fn()
    const { result } = renderHook(() => useSuppressionBloc(supprimer))
    act(() => result.current.demander(blocAvec(2)))
    expect(supprimer).not.toHaveBeenCalled()
    expect(result.current.enAttente?.id).toBe('b1')
    act(() => result.current.annuler())
    expect(result.current.enAttente).toBeNull()
    expect(supprimer).not.toHaveBeenCalled()
    act(() => result.current.demander(blocAvec(2)))
    act(() => result.current.confirmer())
    expect(supprimer).toHaveBeenCalledWith('b1')
    expect(result.current.enAttente).toBeNull()
  })
})

describe('useAvertissementFermeture', () => {
  const evenement = () => {
    const e = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(e)
    return e
  }

  it('demande confirmation à la fermeture de l’onglet seulement s’il y a des modifications', () => {
    const { rerender } = renderHook(({ modifie }) => useAvertissementFermeture(modifie), { initialProps: { modifie: false } })
    expect(evenement().defaultPrevented).toBe(false)
    rerender({ modifie: true })
    expect(evenement().defaultPrevented).toBe(true)
    rerender({ modifie: false })
    expect(evenement().defaultPrevented).toBe(false)
  })

  it('retire son écouteur au démontage', () => {
    const { unmount } = renderHook(() => useAvertissementFermeture(true))
    unmount()
    expect(evenement().defaultPrevented).toBe(false)
  })
})

describe('useEchauffement', () => {
  async function base() {
    const db = createTestDb()
    await inserer(db, 'seances', {
      id: 'w', user_id: 'u', updated_at: 'u', deleted_at: null, nom: 'Mobilité', groupes_musculaires: '[]', duree_estimee_min: 5, notes: '',
      seance_category: 'WARMUP_MOBILITY', created_at: 'c', is_archived: 0,
    })
    await inserer(db, 'exercises', {
      id: 'x', user_id: 'u', updated_at: 'u', deleted_at: null, name: 'Rotations', category: 'OTHER', muscle_groups: '[]', description: '',
      is_favorite: 0, is_custom: 0, image_url: null, exercise_type: '', equipment: '[]', muscle_primary: '', is_bodyweight: 0,
    })
    await inserer(db, 'exercices_seance', {
      id: 'l', user_id: 'u', updated_at: 'u', deleted_at: null, seance_id: 'w', exercise_id: 'x', bloc_id: null, position: 0,
      nombre_series_prevues: 2, reps_cibles: '10', instance_seance_id: null,
    })
    return db
  }

  it('ouvrir charge les modèles ; choisir insère le bloc et ferme', async () => {
    const db = await base()
    const catalogue = [{ id: 'x', name: 'Rotations', category: 'OTHER', muscleGroups: '[]', description: '', isFavorite: false, isCustom: false, imageUrl: null, exerciseType: '', equipment: '[]', musclePrimary: '', isBodyweight: false, updatedAt: 'u' }]
    const inserer_ = vi.fn()
    const { result } = renderHook(() => useEchauffement({ db, catalogue, inserer: inserer_ }))
    expect(result.current.ouvert).toBe(false)
    act(() => result.current.ouvrir())
    expect(result.current.ouvert).toBe(true)
    expect(result.current.modeles).toBeNull()
    await waitFor(() => expect(result.current.modeles?.map((m) => m.nom)).toEqual(['Mobilité']))
    await act(async () => {
      await result.current.choisir('w')
    })
    expect(inserer_).toHaveBeenCalledTimes(1)
    const bloc = inserer_.mock.calls[0][0] as BlocDraft
    expect(bloc).toMatchObject({ nom: 'Mobilité', type: 'ECHAUFFEMENT' })
    expect(bloc.exercices.map((e) => e.exerciseNom)).toEqual(['Rotations'])
    expect(result.current.ouvert).toBe(false)
  })

  it('un échec de lecture est signalé en français', async () => {
    const db = await base()
    const casse = { ...db, getAll: () => Promise.reject(new Error('boum')) }
    const erreurConsole = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { result } = renderHook(() => useEchauffement({ db: casse, catalogue: [], inserer: vi.fn() }))
    act(() => result.current.ouvrir())
    await waitFor(() => expect(result.current.erreur).toBe('Les échauffements n’ont pas pu être chargés.'))
    erreurConsole.mockRestore()
  })
})
