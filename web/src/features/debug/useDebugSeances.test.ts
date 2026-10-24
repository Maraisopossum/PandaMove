// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import type { PowerSyncDatabase } from '@powersync/web'
import { describe, expect, it, vi } from 'vitest'
import { useDebugSeances } from './useDebugSeances'

type Handler = { onResult: (r: { rows?: { _array: unknown[] } }) => void }

// Faux PowerSyncDatabase : seuls watchWithCallback et execute (utilisés par le hook) sont simulés.
function fausseBase() {
  const base = {
    handler: undefined as Handler | undefined,
    signal: undefined as AbortSignal | undefined,
    sql: '',
    watchWithCallback: vi.fn((sql: string, _p: unknown[], h: Handler, o?: { signal?: AbortSignal }) => {
      base.sql = sql
      base.handler = h
      base.signal = o?.signal
    }),
    execute: vi.fn(async () => ({})),
  }
  return base
}
const asDb = (b: ReturnType<typeof fausseBase>) => b as unknown as PowerSyncDatabase

describe('useDebugSeances', () => {
  it('ne liste que les séances non supprimées et reflète les résultats observés', () => {
    const base = fausseBase()
    const { result } = renderHook(() => useDebugSeances('user-1', asDb(base)))
    expect(base.sql).toMatch(/deleted_at IS NULL/)
    expect(result.current.seances).toEqual([])
    act(() => base.handler!.onResult({ rows: { _array: [{ id: 'a', nom: 'Debug 10:00:00' }] } }))
    expect(result.current.seances).toEqual([{ id: 'a', nom: 'Debug 10:00:00' }])
  })

  it('insère une séance complète avec un UUID neuf et le user_id courant', async () => {
    const base = fausseBase()
    const { result } = renderHook(() => useDebugSeances('user-1', asDb(base)))
    await act(() => result.current.ajouter())
    await act(() => result.current.ajouter())
    expect(base.execute).toHaveBeenCalledTimes(2)
    const [sql, params] = base.execute.mock.calls[0] as unknown as [string, unknown[]]
    expect(sql).toMatch(/INSERT INTO seances/)
    expect(params[0]).toMatch(/^[0-9a-f-]{36}$/)
    expect(params).toContain('user-1')
    expect(params.some((p) => typeof p === 'string' && p.startsWith('Debug '))).toBe(true)
    const [, params2] = base.execute.mock.calls[1] as unknown as [string, unknown[]]
    expect(params2[0]).not.toBe(params[0])
  })

  it("arrête l'observation au démontage", () => {
    const base = fausseBase()
    const { unmount } = renderHook(() => useDebugSeances('user-1', asDb(base)))
    unmount()
    expect(base.signal?.aborted).toBe(true)
  })
})
