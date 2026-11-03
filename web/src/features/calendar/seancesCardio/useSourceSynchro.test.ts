// @vitest-environment jsdom
import type { PowerSyncDatabase } from '@powersync/web'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSourceSynchro } from './useSourceSynchro'

// Faux PowerSyncDatabase : seul ce que lit le hook est simulé (statut, écouteur, première synchro, file d'envoi).
function fausseBase(file = 0) {
  return {
    currentStatus: { connected: true, dataFlowStatus: { uploading: false, downloading: false } },
    registerListener: () => () => {},
    waitForFirstSync: vi.fn(() => Promise.resolve()),
    getUploadQueueStats: vi.fn(() => Promise.resolve({ count: file, size: null })),
  }
}
const asDb = (b: ReturnType<typeof fausseBase>) => b as unknown as PowerSyncDatabase

describe('useSourceSynchro', () => {
  it('expose l’état de synchronisation de la base', () => {
    const { result } = renderHook(() => useSourceSynchro(asDb(fausseBase())))
    expect(result.current.etat).toBe('online')
  })

  it('attend la première synchronisation de la base, avec le signal reçu', async () => {
    const base = fausseBase()
    const { result } = renderHook(() => useSourceSynchro(asDb(base)))
    const signal = new AbortController().signal
    await result.current.attendrePremiereSynchro(signal)
    expect(base.waitForFirstSync).toHaveBeenCalledWith(signal)
  })

  it('compte les envois en attente', async () => {
    const { result } = renderHook(() => useSourceSynchro(asDb(fausseBase(3))))
    expect(await result.current.compterFileEnvoi()).toBe(3)
  })
})
