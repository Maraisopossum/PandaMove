// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { nouveauBloc, nouvelExercice, type BlocDraft } from '../draft'
import { useAvertissementFermeture } from './useAvertissementFermeture'
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
