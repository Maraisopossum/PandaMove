import type { Page } from '@playwright/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { attendreServiceWorker } from './serviceWorker.ts'

// Fausse page : evaluate / waitForFunction exécutent la fonction localement (navigator de Node, ajusté).
function faussePage(): Page {
  return {
    evaluate: (fn: (arg: unknown) => unknown, arg: unknown) => Promise.resolve(fn(arg)),
    waitForFunction: async (fn: () => boolean) => {
      if (!fn()) throw new Error('délai dépassé')
    },
    reload: async () => null,
  } as unknown as Page
}

afterEach(() => vi.unstubAllGlobals())

describe('attendreServiceWorker', () => {
  it('sans service worker : échoue vite avec un message clair', async () => {
    vi.stubGlobal('navigator', {})
    await expect(attendreServiceWorker(faussePage(), 20)).rejects.toThrow(/Service worker non enregistré/)
  })

  it('worker jamais activé (ready ne se résout pas) : échoue après le délai explicite', async () => {
    vi.stubGlobal('navigator', { serviceWorker: { ready: new Promise(() => {}), controller: null } })
    await expect(attendreServiceWorker(faussePage(), 20)).rejects.toThrow(/Service worker non enregistré/)
  })

  it('worker actif qui contrôle la page : résout', async () => {
    vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({}), controller: {} } })
    await expect(attendreServiceWorker(faussePage(), 20)).resolves.toBeUndefined()
  })

  it('worker actif sans contrôle même après rechargement : message explicite', async () => {
    vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({}), controller: null } })
    await expect(attendreServiceWorker(faussePage(), 20)).rejects.toThrow(/ne contrôlant pas la page/)
  })
})
