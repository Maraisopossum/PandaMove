// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import type { PowerSyncDatabase } from '@powersync/web'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSyncStatus } from './useSyncStatus'

type Statut = { connected: boolean; dataFlowStatus: { uploading: boolean; downloading: boolean } }

// Faux PowerSyncDatabase : seul le contrat utilisé par le hook est simulé (statut + écouteur).
function faussebase(initial: Statut) {
  const base = {
    currentStatus: initial,
    ecouteurs: new Set<{ statusChanged?: (s: Statut) => void }>(),
    registerListener(l: { statusChanged?: (s: Statut) => void }) {
      base.ecouteurs.add(l)
      return () => base.ecouteurs.delete(l)
    },
    emettre(s: Statut) {
      base.currentStatus = s
      base.ecouteurs.forEach((l) => l.statusChanged?.(s))
    },
  }
  return base
}
const statut = (connected: boolean, uploading = false, downloading = false): Statut => ({
  connected,
  dataFlowStatus: { uploading, downloading },
})
const asDb = (b: ReturnType<typeof faussebase>) => b as unknown as PowerSyncDatabase

describe('useSyncStatus', () => {
  it('renvoie offline quand connected=false', () => {
    const { result } = renderHook(() => useSyncStatus(asDb(faussebase(statut(false)))))
    expect(result.current.state).toBe('offline')
  })

  it('renvoie syncing quand uploading ou downloading', () => {
    const up = renderHook(() => useSyncStatus(asDb(faussebase(statut(true, true, false)))))
    expect(up.result.current.state).toBe('syncing')
    const down = renderHook(() => useSyncStatus(asDb(faussebase(statut(true, false, true)))))
    expect(down.result.current.state).toBe('syncing')
  })

  it('renvoie online sinon', () => {
    const { result } = renderHook(() => useSyncStatus(asDb(faussebase(statut(true)))))
    expect(result.current.state).toBe('online')
  })

  it('suit les changements de statut et se désabonne au démontage', () => {
    const base = faussebase(statut(false))
    const { result, unmount } = renderHook(() => useSyncStatus(asDb(base)))
    act(() => base.emettre(statut(true, true)))
    expect(result.current.state).toBe('syncing')
    act(() => base.emettre(statut(true)))
    expect(result.current.state).toBe('online')
    unmount()
    expect(base.ecouteurs.size).toBe(0)
  })

  describe('état du navigateur (navigator.onLine)', () => {
    const fixerOnLine = (valeur: boolean) =>
      Object.defineProperty(navigator, 'onLine', { value: valeur, configurable: true })
    afterEach(() => {
      // Retire la surcharge : on retombe sur le getter du prototype
      delete (navigator as unknown as Record<string, unknown>).onLine
      vi.restoreAllMocks()
    })

    it('renvoie offline si le navigateur est hors ligne, même si PowerSync se dit connecté', () => {
      fixerOnLine(false)
      const { result } = renderHook(() => useSyncStatus(asDb(faussebase(statut(true)))))
      expect(result.current.state).toBe('offline')
      const sync = renderHook(() => useSyncStatus(asDb(faussebase(statut(true, true)))))
      expect(sync.result.current.state).toBe('offline')
    })

    it('reste offline pendant un changement de statut PowerSync tant que le navigateur est hors ligne', () => {
      fixerOnLine(false)
      const base = faussebase(statut(true))
      const { result } = renderHook(() => useSyncStatus(asDb(base)))
      act(() => base.emettre(statut(true, true)))
      expect(result.current.state).toBe('offline')
    })

    it('bascule immédiatement sur les événements offline puis online', () => {
      fixerOnLine(true)
      const base = faussebase(statut(true))
      const { result } = renderHook(() => useSyncStatus(asDb(base)))
      expect(result.current.state).toBe('online')
      act(() => {
        fixerOnLine(false)
        window.dispatchEvent(new Event('offline'))
      })
      expect(result.current.state).toBe('offline')
      act(() => {
        fixerOnLine(true)
        window.dispatchEvent(new Event('online'))
      })
      // Retour en ligne : on retombe sur l'état dérivé de PowerSync
      expect(result.current.state).toBe('online')
    })

    it("au retour en ligne, reprend l'état PowerSync (hors ligne si non connecté)", () => {
      fixerOnLine(false)
      const { result } = renderHook(() => useSyncStatus(asDb(faussebase(statut(false)))))
      act(() => {
        fixerOnLine(true)
        window.dispatchEvent(new Event('online'))
      })
      expect(result.current.state).toBe('offline')
    })

    it('ajoute les écouteurs au montage et les retire au démontage', () => {
      const ajout = vi.spyOn(window, 'addEventListener')
      const retrait = vi.spyOn(window, 'removeEventListener')
      const { unmount } = renderHook(() => useSyncStatus(asDb(faussebase(statut(true)))))
      const ajoutes = (nom: string) => ajout.mock.calls.filter(([n]) => n === nom)
      expect(ajoutes('online')).toHaveLength(1)
      expect(ajoutes('offline')).toHaveLength(1)
      unmount()
      for (const nom of ['online', 'offline']) {
        const retires = retrait.mock.calls.filter(([n]) => n === nom)
        expect(retires).toHaveLength(1)
        expect(retires[0][1]).toBe(ajoutes(nom)[0][1])
      }
    })
  })
})
