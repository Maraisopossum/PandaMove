// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Exercise } from '../../../core/db/types'
import { useSelecteurExercices } from './useSelecteurExercices'

const exo = (id: string, name: string, musclePrimary = '', equipment = '[]'): Exercise => ({
  id, name, category: 'OTHER', muscleGroups: '[]', description: '', isFavorite: false, isCustom: false, imageUrl: null,
  exerciseType: '', equipment, musclePrimary, isBodyweight: false, updatedAt: 'u',
})
const catalogue = [exo('face', 'Face pull', 'EPAULES'), exo('elev', 'Élévations latérales', 'EPAULES'), exo('dc', 'Développé couché', 'PECTORAUX', '["Barre"]')]

function monter(ajouter = vi.fn(), categories: string[] = []) {
  return { ajouter, ...renderHook(() => useSelecteurExercices({ catalogue, categoriesPossedees: categories, ajouter })) }
}

describe('useSelecteurExercices', () => {
  it('fermé au départ ; ouvrir vise un bloc ou la liste (null = exercice libre)', () => {
    const { result } = monter()
    expect(result.current.ouvert).toBe(false)
    act(() => result.current.ouvrir('b1'))
    expect(result.current.ouvert).toBe(true)
    expect(result.current.cible).toBe('b1')
    act(() => result.current.ouvrir(null))
    expect(result.current.ouvert).toBe(true)
    expect(result.current.cible).toBeNull()
  })

  it('l’ouverture repart d’un état propre (recherche, filtres, sélection)', () => {
    const { result } = monter()
    act(() => result.current.ouvrir(null))
    act(() => result.current.setQuery('face'))
    act(() => result.current.basculer('face'))
    act(() => result.current.fermer())
    act(() => result.current.ouvrir(null))
    expect(result.current.filtre.query).toBe('')
    expect(result.current.selection).toEqual([])
  })

  it('filtre : recherche, groupe, matériel', () => {
    const { result } = monter(vi.fn(), [])
    act(() => result.current.ouvrir(null))
    expect(result.current.resultats.map((e) => e.id)).toEqual(['dc', 'elev', 'face'])
    act(() => result.current.setGroupe('EPAULES'))
    expect(result.current.resultats.map((e) => e.id)).toEqual(['elev', 'face'])
    act(() => result.current.setGroupe(null))
    act(() => result.current.basculerDisponible())
    expect(result.current.resultats.map((e) => e.id)).toEqual(['elev', 'face'])
  })

  it('confirmer envoie la sélection DANS L’ORDRE DES COCHES (pas l’ordre alphabétique) puis ferme', () => {
    const { result, ajouter } = monter()
    act(() => result.current.ouvrir('b1'))
    act(() => result.current.basculer('face'))
    act(() => result.current.basculer('elev'))
    act(() => result.current.basculer('dc'))
    act(() => result.current.basculer('elev'))
    act(() => result.current.basculer('elev'))
    expect(result.current.selection).toEqual(['face', 'dc', 'elev'])
    act(() => result.current.confirmer())
    expect(ajouter).toHaveBeenCalledWith('b1', ['face', 'dc', 'elev'])
    expect(result.current.ouvert).toBe(false)
  })

  it('confirmer sans sélection se contente de fermer', () => {
    const { result, ajouter } = monter()
    act(() => result.current.ouvrir(null))
    act(() => result.current.confirmer())
    expect(ajouter).not.toHaveBeenCalled()
    expect(result.current.ouvert).toBe(false)
  })
})
