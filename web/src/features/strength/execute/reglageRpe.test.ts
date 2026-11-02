import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ecrireReglageRpe, lireReglageRpe, useReglageRpe } from './reglageRpe'

describe('réglage RPE', () => {
  afterEach(() => localStorage.clear())

  it('activé par défaut', () => {
    expect(lireReglageRpe()).toBe(true)
  })

  it('se désactive et se réactive, et le hook suit le changement', () => {
    const { result } = renderHook(() => useReglageRpe())
    expect(result.current.rpeActif).toBe(true)
    act(() => result.current.changerRpe(false))
    expect(result.current.rpeActif).toBe(false)
    expect(lireReglageRpe()).toBe(false)
    act(() => ecrireReglageRpe(true))
    expect(result.current.rpeActif).toBe(true)
  })
})
