// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Seance } from '../../core/db/types'
import { ErreurSeance } from './affectation'
import { useLancement } from './useLancement'

const PULL = { id: 's1', nom: 'Pull' } as Seance

afterEach(() => vi.restoreAllMocks())

describe('useLancement (démarrage direct, comme Android : aucune confirmation)', () => {
  it("lance la séance puis ouvre l'instance", async () => {
    const lancer = vi.fn(async () => 'i42')
    const ouvrirInstance = vi.fn()
    const r = renderHook(() => useLancement(lancer, ouvrirInstance))
    await act(() => r.result.current.lancer(PULL))
    expect(lancer).toHaveBeenCalledWith('s1')
    expect(ouvrirInstance).toHaveBeenCalledWith('i42')
    expect(r.result.current.enCours).toBe(false)
    expect(r.result.current.erreur).toBeNull()
  })

  it('double clic : un seul lancement, boutons désactivés pendant l’opération', async () => {
    let terminer: (id: string) => void = () => {}
    const lancer = vi.fn(() => new Promise<string>((ok) => (terminer = ok)))
    const ouvrirInstance = vi.fn()
    const r = renderHook(() => useLancement(lancer, ouvrirInstance))
    let p1: Promise<void> = Promise.resolve()
    let p2: Promise<void> = Promise.resolve()
    act(() => {
      p1 = r.result.current.lancer(PULL)
      p2 = r.result.current.lancer(PULL)
    })
    expect(r.result.current.enCours).toBe(true)
    await act(async () => {
      terminer('i1')
      await Promise.all([p1, p2])
    })
    expect(lancer).toHaveBeenCalledTimes(1)
    expect(ouvrirInstance).toHaveBeenCalledTimes(1)
  })

  it('erreur : message français conservé jusqu’au prochain essai, aucune navigation', async () => {
    const ouvrirInstance = vi.fn()
    const lancer = vi.fn().mockRejectedValueOnce(new ErreurSeance('Séance introuvable.')).mockResolvedValueOnce('i2')
    const r = renderHook(() => useLancement(lancer, ouvrirInstance))
    await act(() => r.result.current.lancer(PULL))
    expect(r.result.current.erreur).toBe('Séance introuvable.')
    expect(r.result.current.enCours).toBe(false)
    expect(ouvrirInstance).not.toHaveBeenCalled()
    // Un nouvel essai efface l'ancien message
    await act(() => r.result.current.lancer(PULL))
    expect(r.result.current.erreur).toBeNull()
    expect(ouvrirInstance).toHaveBeenCalledWith('i2')
  })

  it('panne inattendue : message générique', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = renderHook(() => useLancement(vi.fn(async () => Promise.reject(new Error('disque plein'))), vi.fn()))
    await act(() => r.result.current.lancer(PULL))
    expect(r.result.current.erreur).toBe('Le lancement de la séance a échoué. Réessayez.')
  })

  it('fermerErreur efface le message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = renderHook(() => useLancement(vi.fn(async () => Promise.reject(new Error('x'))), vi.fn()))
    await act(() => r.result.current.lancer(PULL))
    act(() => r.result.current.fermerErreur())
    expect(r.result.current.erreur).toBeNull()
  })
})
