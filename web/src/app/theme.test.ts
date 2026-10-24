// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLE_THEME, resoudreSombre, useDarkMode } from './theme'

function simulerPreference(sombre: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: sombre && q.includes('dark') }))
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('resoudreSombre', () => {
  it("le choix mémorisé l'emporte sur la préférence système", () => {
    expect(resoudreSombre('dark', false)).toBe(true)
    expect(resoudreSombre('light', true)).toBe(false)
  })
  it('sans choix mémorisé (ou valeur inconnue), suit la préférence système', () => {
    expect(resoudreSombre(null, true)).toBe(true)
    expect(resoudreSombre('valeur inconnue', false)).toBe(false)
  })
})

describe('useDarkMode', () => {
  it('démarre sur la préférence système', () => {
    simulerPreference(true)
    const { result } = renderHook(() => useDarkMode())
    expect(result.current.dark).toBe(true)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it("setDark change l'état, l'attribut du document et la mémoire locale", () => {
    simulerPreference(false)
    const { result } = renderHook(() => useDarkMode())
    expect(result.current.dark).toBe(false)
    act(() => result.current.setDark(true))
    expect(result.current.dark).toBe(true)
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(CLE_THEME)).toBe('dark')
  })

  it('relit le choix mémorisé au montage', () => {
    simulerPreference(true)
    localStorage.setItem(CLE_THEME, 'light')
    const { result } = renderHook(() => useDarkMode())
    expect(result.current.dark).toBe(false)
  })

  it('fonctionne quand localStorage lève une erreur', () => {
    simulerPreference(false)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('indisponible')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('indisponible')
    })
    const { result } = renderHook(() => useDarkMode())
    act(() => result.current.setDark(true))
    expect(result.current.dark).toBe(true)
  })

  it('ne plante pas sans matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { result } = renderHook(() => useDarkMode())
    expect(result.current.dark).toBe(false)
  })
})
