// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLE_ONBOARDING, ETAPES_ONBOARDING, lireVu, marquerVu } from './onboarding'
import { useOnboarding } from './useOnboarding'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

// Stockage dont chaque accès lève (navigation privée stricte, données de site bloquées)
const stockageCasse = () =>
  ({
    getItem: () => {
      throw new Error('bloqué')
    },
    setItem: () => {
      throw new Error('bloqué')
    },
  }) as unknown as Storage

describe('onboarding (persistance)', () => {
  it('cinq étapes, chacune avec titre, texte et image onboarding_0N', () => {
    expect(ETAPES_ONBOARDING).toHaveLength(5)
    ETAPES_ONBOARDING.forEach((e, i) => {
      expect(e.titre).not.toBe('')
      expect(e.texte).not.toBe('')
      expect(e.image).toBe(`onboarding_0${i + 1}`)
    })
  })

  it('« vu » est lu et écrit dans localStorage', () => {
    expect(lireVu(() => localStorage)).toBe(false)
    marquerVu(() => localStorage)
    expect(localStorage.getItem(CLE_ONBOARDING)).toBe('1')
    expect(lireVu(() => localStorage)).toBe(true)
  })

  it('stockage indisponible : non vu, et l’écriture échoue sans lever', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(lireVu(stockageCasse)).toBe(false)
    expect(() => marquerVu(stockageCasse)).not.toThrow()
    const accesQuiLeve = () => {
      throw new Error('SecurityError')
    }
    expect(lireVu(accesQuiLeve)).toBe(false)
    expect(() => marquerVu(accesQuiLeve)).not.toThrow()
  })
})

describe('useOnboarding', () => {
  it('premier lancement : affiché, sur la première étape', () => {
    const { result } = renderHook(() => useOnboarding())
    expect(result.current.afficher).toBe(true)
    expect(result.current.index).toBe(0)
    expect(result.current.total).toBe(5)
    expect(result.current.etape).toBe(ETAPES_ONBOARDING[0])
    expect(result.current.estPremiere).toBe(true)
    expect(result.current.estDerniere).toBe(false)
  })

  it('déjà vu : non affiché', () => {
    localStorage.setItem(CLE_ONBOARDING, '1')
    expect(renderHook(() => useOnboarding()).result.current.afficher).toBe(false)
  })

  it('suivant / précédent restent dans les bornes', () => {
    const { result } = renderHook(() => useOnboarding())
    act(() => result.current.precedent())
    expect(result.current.index).toBe(0)
    for (let i = 0; i < 10; i++) act(() => result.current.suivant())
    expect(result.current.index).toBe(4)
    expect(result.current.estDerniere).toBe(true)
    act(() => result.current.precedent())
    expect(result.current.index).toBe(3)
  })

  it('« Passer » masque l’onboarding et le marque vu', () => {
    const { result } = renderHook(() => useOnboarding())
    act(() => result.current.passer())
    expect(result.current.afficher).toBe(false)
    expect(localStorage.getItem(CLE_ONBOARDING)).toBe('1')
  })

  it('terminer depuis la dernière étape le marque vu', () => {
    const { result } = renderHook(() => useOnboarding())
    for (let i = 0; i < 4; i++) act(() => result.current.suivant())
    act(() => result.current.terminer())
    expect(result.current.afficher).toBe(false)
    expect(localStorage.getItem(CLE_ONBOARDING)).toBe('1')
  })

  it('stockage indisponible : affiché, et « Passer » le masque pour la session', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result } = renderHook(() => useOnboarding({ stockage: stockageCasse }))
    expect(result.current.afficher).toBe(true)
    act(() => result.current.passer())
    expect(result.current.afficher).toBe(false)
  })

  it('clavier : flèches pour naviguer, touche ignorée sinon', () => {
    const { result } = renderHook(() => useOnboarding())
    let traite = false
    act(() => {
      traite = result.current.surTouche('ArrowRight')
    })
    expect(traite).toBe(true)
    expect(result.current.index).toBe(1)
    act(() => {
      traite = result.current.surTouche('ArrowLeft')
    })
    expect(result.current.index).toBe(0)
    act(() => {
      traite = result.current.surTouche('a')
    })
    expect(traite).toBe(false)
  })
})
