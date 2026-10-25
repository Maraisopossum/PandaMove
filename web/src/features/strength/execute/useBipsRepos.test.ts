// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Sonneur } from './circuit/audio'
import { useBipsRepos } from './useBipsRepos'

const faux = (): Sonneur => ({ preparer: vi.fn(), jouer: vi.fn(), fermer: vi.fn() })

describe('useBipsRepos', () => {
  it('joue le bip de repos à chaque seconde de 5 à 1, pas avant ni à zéro', () => {
    const sonneur = faux()
    const { rerender } = renderHook(({ ms }: { ms: number | null }) => useBipsRepos(ms, true, sonneur), { initialProps: { ms: 7000 as number | null } })
    for (const ms of [6000, 5000, 4000, 3000, 2000, 1000, 0]) rerender({ ms })
    // 5, 4, 3, 2, 1 -> cinq bips ; le passage de 7 à 6 et de 1 à 0 n'en font pas
    expect(sonneur.jouer).toHaveBeenCalledTimes(5)
    expect(sonneur.jouer).toHaveBeenCalledWith('repos')
  })

  it('silencieux quand le son est désactivé (réglages, ou circuit en cours)', () => {
    const sonneur = faux()
    const { rerender } = renderHook(({ ms }: { ms: number | null }) => useBipsRepos(ms, false, sonneur), { initialProps: { ms: 6000 as number | null } })
    rerender({ ms: 5000 })
    expect(sonneur.jouer).not.toHaveBeenCalled()
  })

  it('un repos qui vient de démarrer à moins de 5 s ne sonne pas tout de suite', () => {
    const sonneur = faux()
    const { rerender } = renderHook(({ ms }: { ms: number | null }) => useBipsRepos(ms, true, sonneur), { initialProps: { ms: null as number | null } })
    rerender({ ms: 4000 })
    expect(sonneur.jouer).not.toHaveBeenCalled()
  })

  it('le son est débloqué au premier appui sur la page, une seule fois ; le sonneur est fermé au démontage', () => {
    const sonneur = faux()
    const { unmount } = renderHook(() => useBipsRepos(null, true, sonneur))
    window.dispatchEvent(new Event('pointerdown'))
    window.dispatchEvent(new Event('pointerdown'))
    expect(sonneur.preparer).toHaveBeenCalledTimes(1)
    unmount()
    expect(sonneur.fermer).toHaveBeenCalledTimes(1)
  })

  it('son désactivé : rien n’est préparé', () => {
    const sonneur = faux()
    renderHook(() => useBipsRepos(null, false, sonneur))
    window.dispatchEvent(new Event('pointerdown'))
    expect(sonneur.preparer).not.toHaveBeenCalled()
  })
})
