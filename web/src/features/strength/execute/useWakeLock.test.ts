// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWakeLock } from './useWakeLock'

// Faux navigator.wakeLock : chaque request() renvoie une sentinelle dont release() est espionné.
function installerFaux(request: () => Promise<{ release: () => Promise<void> }>) {
  Object.defineProperty(navigator, 'wakeLock', { value: { request: vi.fn(request) }, configurable: true })
  return (navigator as unknown as { wakeLock: { request: ReturnType<typeof vi.fn> } }).wakeLock
}

function retirerFaux() {
  delete (navigator as unknown as Record<string, unknown>).wakeLock
}

function definirVisibilite(etat: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: etat, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => {
  cleanup()
  retirerFaux()
  vi.restoreAllMocks()
})

describe('useWakeLock', () => {
  it('ne plante pas quand navigator.wakeLock est absent', () => {
    retirerFaux()
    expect('wakeLock' in navigator).toBe(false)
    const r = renderHook(({ actif }) => useWakeLock(actif), { initialProps: { actif: true } })
    r.rerender({ actif: false })
    r.unmount()
  })

  it("demande le verrou 'screen' quand actif et le libère au démontage", async () => {
    const release = vi.fn(async () => {})
    const api = installerFaux(async () => ({ release }))
    const r = renderHook(() => useWakeLock(true))
    await waitFor(() => expect(api.request).toHaveBeenCalledWith('screen'))
    r.unmount()
    await waitFor(() => expect(release).toHaveBeenCalledTimes(1))
  })

  it('ne demande rien quand inactif, et libère en repassant inactif', async () => {
    const release = vi.fn(async () => {})
    const api = installerFaux(async () => ({ release }))
    const r = renderHook(({ actif }) => useWakeLock(actif), { initialProps: { actif: false } })
    expect(api.request).not.toHaveBeenCalled()
    r.rerender({ actif: true })
    await waitFor(() => expect(api.request).toHaveBeenCalledTimes(1))
    r.rerender({ actif: false })
    await waitFor(() => expect(release).toHaveBeenCalledTimes(1))
  })

  it('redemande le verrou quand la page redevient visible', async () => {
    const api = installerFaux(async () => ({ release: async () => {} }))
    renderHook(() => useWakeLock(true))
    await waitFor(() => expect(api.request).toHaveBeenCalledTimes(1))
    act(() => definirVisibilite('hidden'))
    expect(api.request).toHaveBeenCalledTimes(1)
    act(() => definirVisibilite('visible'))
    await waitFor(() => expect(api.request).toHaveBeenCalledTimes(2))
  })

  it('un refus de request() est avalé (avertissement français), sans exception', async () => {
    const avert = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const api = installerFaux(async () => {
      throw new Error('NotAllowedError')
    })
    renderHook(() => useWakeLock(true))
    await waitFor(() => expect(avert).toHaveBeenCalledTimes(1))
    expect(api.request).toHaveBeenCalledTimes(1)
    expect(String(avert.mock.calls[0][0])).toMatch(/écran/)
  })
})
