// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import type { PowerSyncBackendConnector, PowerSyncDatabase } from '@powersync/web'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSyncConnection, type StockageUtilisateur } from './useSyncConnection'

// Faux PowerSyncDatabase : journalise les appels dans l'ordre où ils démarrent.
function fausseBase(file = 0) {
  const journal: string[] = []
  const base = {
    journal,
    connect: vi.fn(async () => void journal.push('connect')),
    disconnect: vi.fn(async () => void journal.push('disconnect')),
    disconnectAndClear: vi.fn(async () => void journal.push('clear')),
    getUploadQueueStats: vi.fn(async () => ({ count: file, size: null })),
  }
  return base
}
const asDb = (b: ReturnType<typeof fausseBase>) => b as unknown as PowerSyncDatabase

function faussStockage(initial: string | null = null): StockageUtilisateur & { valeur: string | null } {
  const s = {
    valeur: initial,
    lire: () => s.valeur,
    ecrire: (id: string) => void (s.valeur = id),
    effacer: () => void (s.valeur = null),
  }
  return s
}

const connecteur = {} as PowerSyncBackendConnector
const vider = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

function monter(base: ReturnType<typeof fausseBase>, stockage = faussStockage(), signOut = vi.fn(async () => undefined)) {
  const rendu = renderHook(
    ({ userId }: { userId: string | null }) =>
      useSyncConnection({ userId, signOut, db: asDb(base), creerConnecteur: () => connecteur, stockage }),
    { initialProps: { userId: 'u1' as string | null } },
  )
  return { ...rendu, signOut, stockage }
}

afterEach(() => vi.restoreAllMocks())

describe('useSyncConnection', () => {
  it('connecte à la connexion ; le nettoyage appelle disconnect et jamais disconnectAndClear', async () => {
    const base = fausseBase()
    const { unmount } = monter(base)
    await vider()
    expect(base.journal).toEqual(['connect'])
    unmount()
    await vider()
    expect(base.journal).toEqual(['connect', 'disconnect'])
    expect(base.disconnectAndClear).not.toHaveBeenCalled()
  })

  it('déconnexion explicite avec 3 modifications en attente : ni effacement ni signOut, avertissement renvoyé', async () => {
    const base = fausseBase(3)
    const { result, signOut } = monter(base)
    await vider()
    let retour: { ok: boolean; message?: string } | undefined
    await act(async () => { retour = await result.current.signOutSafely() })
    expect(retour?.ok).toBe(false)
    expect(retour?.message).toBe(
      '3 modification(s) non synchronisée(s) seraient perdues — reconnectez-vous au réseau puis réessayez',
    )
    expect(base.disconnectAndClear).not.toHaveBeenCalled()
    expect(signOut).not.toHaveBeenCalled()
  })

  it('déconnexion explicite avec file vide : efface puis se déconnecte, dans cet ordre', async () => {
    const base = fausseBase(0)
    const ordre: string[] = []
    const signOut = vi.fn(async () => void ordre.push('signOut'))
    base.disconnectAndClear.mockImplementation(async () => void ordre.push('clear'))
    const { result } = monter(base, faussStockage(), signOut)
    await vider()
    let retour: { ok: boolean } | undefined
    await act(async () => { retour = await result.current.signOutSafely() })
    expect(retour?.ok).toBe(true)
    expect(ordre).toEqual(['clear', 'signOut'])
  })

  it("efface avant de connecter quand l'utilisateur diffère du dernier connecté", async () => {
    const base = fausseBase()
    const stockage = faussStockage('autre')
    monter(base, stockage)
    await vider()
    expect(base.journal).toEqual(['clear', 'connect'])
    expect(stockage.valeur).toBe('u1')
  })

  it("n'efface pas quand c'est le même utilisateur (ou le premier)", async () => {
    const meme = fausseBase()
    monter(meme, faussStockage('u1'))
    await vider()
    expect(meme.journal).toEqual(['connect'])
    const premier = fausseBase()
    monter(premier, faussStockage(null))
    await vider()
    expect(premier.journal).toEqual(['connect'])
  })

  it('exécute dans l’ordre une déconnexion puis une reconnexion rapides', async () => {
    const base = fausseBase()
    // La connexion est lente : la déconnexion suivante ne doit pas la doubler
    base.connect.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 20))
      base.journal.push('connect')
    })
    const { rerender } = monter(base)
    rerender({ userId: null })
    rerender({ userId: 'u1' })
    await act(async () => { await new Promise((r) => setTimeout(r, 100)) })
    expect(base.journal).toEqual(['connect', 'disconnect', 'connect'])
  })

  it('journalise via console.error un connect rejeté, sans le laisser passer en silence', async () => {
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const base = fausseBase()
    base.connect.mockRejectedValueOnce(new Error('réseau'))
    monter(base)
    await vider()
    expect(erreur).toHaveBeenCalledTimes(1)
    expect(String(erreur.mock.calls[0][0])).toMatch(/connexion/i)
  })
})
