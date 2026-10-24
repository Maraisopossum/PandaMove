// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestDb } from '../../test/sqliteDb'
import catalogue from '../../core/import/__fixtures__/catalogue.json'
import exportV32 from '../../core/import/__fixtures__/export-v3.2.json'
import type { Db } from '../../core/db/Db'
import { TAILLE_MAX_OCTETS, useImport } from './useImport'

const USER = '11111111-1111-4111-8111-111111111111'
const fichier = (contenu: unknown, nom = 'export.json') =>
  new File([typeof contenu === 'string' ? contenu : JSON.stringify(contenu)], nom, { type: 'application/json' })

afterEach(() => vi.restoreAllMocks())

describe('useImport', () => {
  it('load -> aperçu -> confirm -> terminé, et les lignes sont écrites', async () => {
    const db = createTestDb()
    const { result } = renderHook(() => useImport({ db, userId: USER }))
    expect(result.current.status).toBe('idle')

    await act(() => result.current.load(fichier(exportV32)))
    expect(result.current.status).toBe('ready')
    expect(result.current.error).toBeNull()
    expect(result.current.preview?.seances).toBe(2)

    let rapport
    await act(async () => {
      rapport = await result.current.confirm()
    })
    expect(result.current.status).toBe('done')
    expect(result.current.resultat).toEqual(rapport)
    expect(result.current.resultat?.seances).toBe(2)
    const n = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM seances')
    expect(n.n).toBe(2)
  })

  it('un catalogue passe par le même flux', async () => {
    const db = createTestDb()
    const { result } = renderHook(() => useImport({ db, userId: USER }))
    await act(() => result.current.load(fichier(catalogue)))
    expect(result.current.status).toBe('ready')
    expect(result.current.preview?.exercises).toBe(3)
  })

  it('JSON tronqué : message français, statut error, aucune écriture possible', async () => {
    const db = createTestDb()
    const { result } = renderHook(() => useImport({ db, userId: USER }))
    await act(() => result.current.load(fichier('{"version": "3.2", "strengthTem')))
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('Fichier JSON invalide ou tronqué')
    expect(result.current.preview).toBeNull()
    await expect(act(() => result.current.confirm())).rejects.toThrow()
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM seances')).n).toBe(0)
  })

  it("fichier d'un autre format : message de l'ImportError", async () => {
    const { result } = renderHook(() => useImport({ db: createTestDb(), userId: USER }))
    await act(() => result.current.load(fichier({ bonjour: 1 })))
    expect(result.current.status).toBe('error')
    expect(result.current.error).toMatch(/non reconnu/)
  })

  it('fichier trop volumineux : refusé avant lecture', async () => {
    const { result } = renderHook(() => useImport({ db: createTestDb(), userId: USER }))
    const gros = fichier('{}')
    Object.defineProperty(gros, 'size', { value: TAILLE_MAX_OCTETS + 1 })
    const lecture = vi.spyOn(gros, 'text')
    await act(() => result.current.load(gros))
    expect(lecture).not.toHaveBeenCalled()
    expect(result.current.status).toBe('error')
    expect(result.current.error).toMatch(/trop volumineux/)
  })

  it('sans utilisateur connecté : erreur claire', async () => {
    const { result } = renderHook(() => useImport({ db: createTestDb() }))
    await act(() => result.current.load(fichier(exportV32)))
    expect(result.current.status).toBe('error')
    expect(result.current.error).toMatch(/connecté/)
  })

  it('double confirm : une seule écriture', async () => {
    const reel = createTestDb()
    const ecritures = vi.fn()
    const db: Db = {
      ...reel,
      writeTransaction: async (fn) => {
        ecritures()
        await new Promise((r) => setTimeout(r, 20))
        return reel.writeTransaction(fn)
      },
    }
    const { result } = renderHook(() => useImport({ db, userId: USER }))
    await act(() => result.current.load(fichier(exportV32)))
    await act(async () => {
      const a = result.current.confirm()
      const b = result.current.confirm()
      await Promise.all([a, b])
    })
    expect(ecritures).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('done')
  })

  it("échec d'écriture : message générique français, console.error, rien d'écrit, statut error", async () => {
    const reel = createTestDb()
    const erreurConsole = vi.spyOn(console, 'error').mockImplementation(() => {})
    const db: Db = { ...reel, writeTransaction: async () => { throw new Error('boom interne') } }
    const { result } = renderHook(() => useImport({ db, userId: USER }))
    await act(() => result.current.load(fichier(exportV32)))
    await act(async () => {
      await expect(result.current.confirm()).rejects.toThrow('boom interne')
    })
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe("L'import a échoué, aucune donnée n'a été modifiée.")
    expect(result.current.error).not.toMatch(/boom/)
    expect(erreurConsole).toHaveBeenCalled()
  })

  it('reset remet à zéro', async () => {
    const { result } = renderHook(() => useImport({ db: createTestDb(), userId: USER }))
    await act(() => result.current.load(fichier(exportV32)))
    act(() => result.current.reset())
    expect(result.current.status).toBe('idle')
    expect(result.current.preview).toBeNull()
    expect(result.current.resultat).toBeNull()
    expect(result.current.error).toBeNull()
  })
})
