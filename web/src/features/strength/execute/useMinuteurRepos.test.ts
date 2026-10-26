// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { InfoRepos } from './minuteurRepos'
import { useMinuteurRepos } from './useMinuteurRepos'

const T0 = Date.parse('2026-10-24T10:00:00.000Z')
let t = T0
const horloge = () => t
const info: InfoRepos = { cle: 'e1#1', debutMs: T0, dureeSec: 90 }

beforeEach(() => {
  t = T0
  window.localStorage.clear()
})

const monter = (i: InfoRepos | null = info, id = 'inst') => renderHook(({ inf }) => useMinuteurRepos(id, inf, horloge(), horloge), { initialProps: { inf: i } })

describe('useMinuteurRepos', () => {
  it('expose le repos restant, +30 s, -30 s et arrêt', () => {
    const r = monter()
    expect(r.result.current.restantMs).toBe(90_000)
    act(() => r.result.current.allonger())
    expect(r.result.current.restantMs).toBe(120_000)
    act(() => r.result.current.ecourter())
    act(() => r.result.current.ecourter())
    expect(r.result.current.restantMs).toBe(60_000)
    act(() => r.result.current.arreter())
    expect(r.result.current.restantMs).toBeNull()
  })

  it('minuteur manuel : démarre et retient la dernière durée', () => {
    const r = monter(null)
    expect(r.result.current.derniereManuelleSec).toBe(30)
    act(() => r.result.current.demarrerManuel(120))
    expect(r.result.current.restantMs).toBe(120_000)
    expect(r.result.current.derniereManuelleSec).toBe(120)
  })

  it("repos saisi à la main : appliqué à la validation de la ligne, effacé si la ligne est revalidée sans saisie", () => {
    const r = monter(null)
    act(() => r.result.current.noterValidation('e1#1', 45))
    r.rerender({ inf: info })
    expect(r.result.current.restantMs).toBe(45_000)
    act(() => r.result.current.noterValidation('e1#1', null))
    expect(r.result.current.restantMs).toBe(90_000)
  })

  it("l'état survit à un rechargement de l'écran (stockage du navigateur)", () => {
    const r = monter()
    act(() => r.result.current.allonger())
    r.unmount()
    const r2 = monter()
    expect(r2.result.current.restantMs).toBe(120_000)
  })

  it("chaque séance a son propre état", () => {
    const r = monter(info, 'a')
    act(() => r.result.current.allonger())
    const autre = monter(info, 'b')
    expect(autre.result.current.restantMs).toBe(90_000)
  })
})
