// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import type { PowerSyncDatabase } from '@powersync/web'
import { describe, expect, it } from 'vitest'
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
})
