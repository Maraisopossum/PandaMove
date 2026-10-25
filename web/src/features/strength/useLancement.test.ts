// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Seance } from '../../core/db/types'
import { ErreurSeance } from './affectation'
import { useLancement } from './useLancement'

const PULL = { id: 's1', nom: 'Pull' } as Seance

afterEach(() => vi.restoreAllMocks())

describe('useLancement', () => {
  it('ouvrir / fermer le dialogue de confirmation', () => {
    const r = renderHook(() => useLancement(vi.fn(), vi.fn()))
    act(() => r.result.current.ouvrir(PULL))
    expect(r.result.current.cible).toBe(PULL)
    expect(r.result.current.erreur).toBeNull()
    act(() => r.result.current.fermer())
    expect(r.result.current.cible).toBeNull()
  })

  it("confirmer lance la séance puis ouvre l'instance", async () => {
    const lancer = vi.fn(async () => 'i42')
    const ouvrirInstance = vi.fn()
    const r = renderHook(() => useLancement(lancer, ouvrirInstance))
    act(() => r.result.current.ouvrir(PULL))
    await act(() => r.result.current.confirmer())
    expect(lancer).toHaveBeenCalledWith('s1')
    expect(ouvrirInstance).toHaveBeenCalledWith('i42')
    expect(r.result.current.enCours).toBe(false)
  })

  it('double clic : un seul lancement, bouton désactivé pendant l’opération', async () => {
    let terminer: (id: string) => void = () => {}
    const lancer = vi.fn(() => new Promise<string>((ok) => (terminer = ok)))
    const ouvrirInstance = vi.fn()
    const r = renderHook(() => useLancement(lancer, ouvrirInstance))
    act(() => r.result.current.ouvrir(PULL))
    let p1: Promise<void> = Promise.resolve()
    let p2: Promise<void> = Promise.resolve()
    act(() => {
      p1 = r.result.current.confirmer()
      p2 = r.result.current.confirmer()
    })
    expect(r.result.current.enCours).toBe(true)
    await act(async () => {
      terminer('i1')
      await Promise.all([p1, p2])
    })
    expect(lancer).toHaveBeenCalledTimes(1)
    expect(ouvrirInstance).toHaveBeenCalledTimes(1)
  })

  it('erreur : message français, le dialogue reste ouvert, aucune navigation', async () => {
    const ouvrirInstance = vi.fn()
    const r = renderHook(() => useLancement(vi.fn(async () => Promise.reject(new ErreurSeance('Séance introuvable.'))), ouvrirInstance))
    act(() => r.result.current.ouvrir(PULL))
    await act(() => r.result.current.confirmer())
    expect(r.result.current.erreur).toBe('Séance introuvable.')
    expect(r.result.current.cible).toBe(PULL)
    expect(r.result.current.enCours).toBe(false)
    expect(ouvrirInstance).not.toHaveBeenCalled()
  })

  it('panne inattendue : message générique', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = renderHook(() => useLancement(vi.fn(async () => Promise.reject(new Error('disque plein'))), vi.fn()))
    act(() => r.result.current.ouvrir(PULL))
    await act(() => r.result.current.confirmer())
    expect(r.result.current.erreur).toBe('Le lancement de la séance a échoué. Réessayez.')
  })
})
