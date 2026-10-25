// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { analyser, PandaMoveExportSchema } from '../../core/import/schema'
import { createTestDb } from '../../test/sqliteDb'
import { useExport } from './useExport'

const MAINTENANT = new Date(2026, 9, 25, 9, 0)

describe('useExport', () => {
  it('succès : génère le JSON v3.2 et le télécharge sous pandamove-export-AAAA-MM-JJ.json', async () => {
    const telecharger = vi.fn()
    const { result } = renderHook(() => useExport({ db: createTestDb(), telecharger, maintenant: () => MAINTENANT }))
    expect(result.current.statut).toBe('repos')
    expect(result.current.message).toBe('')

    await act(() => result.current.exporter())

    expect(telecharger).toHaveBeenCalledTimes(1)
    const [nom, contenu] = telecharger.mock.calls[0] as [string, string]
    expect(nom).toBe('pandamove-export-2026-10-25.json')
    expect(analyser(PandaMoveExportSchema, JSON.parse(contenu)).version).toBe('3.2')
    expect(result.current.statut).toBe('termine')
    expect(result.current.enCours).toBe(false)
    expect(result.current.message).toMatch(/pandamove-export-2026-10-25\.json/)
    expect(result.current.erreur).toBeNull()
  })

  it('en cours : état « génération » et un second appel est ignoré', async () => {
    let liberer: () => void = () => {}
    const attente = new Promise<void>((r) => {
      liberer = r
    })
    const base = createTestDb()
    const lente: Db = { ...base, getAll: async (sql, params) => { await attente; return base.getAll(sql, params) } }
    const telecharger = vi.fn()
    const { result } = renderHook(() => useExport({ db: lente, telecharger, maintenant: () => MAINTENANT }))

    let premier: Promise<void> = Promise.resolve()
    act(() => {
      premier = result.current.exporter()
    })
    expect(result.current.statut).toBe('generation')
    expect(result.current.enCours).toBe(true)
    expect(result.current.message).toMatch(/Préparation/)
    await act(() => result.current.exporter())
    liberer()
    await act(() => premier)
    expect(telecharger).toHaveBeenCalledTimes(1)
    expect(result.current.statut).toBe('termine')
  })

  it("erreur : message français, aucun téléchargement, nouvel essai possible", async () => {
    const erreurConsole = vi.spyOn(console, 'error').mockImplementation(() => {})
    const base = createTestDb()
    let echouer = true
    const capricieuse: Db = {
      ...base,
      getAll: async (sql, params) => {
        if (echouer) throw new Error('disque plein')
        return base.getAll(sql, params)
      },
    }
    const telecharger = vi.fn()
    const { result } = renderHook(() => useExport({ db: capricieuse, telecharger, maintenant: () => MAINTENANT }))

    await act(() => result.current.exporter())
    expect(telecharger).not.toHaveBeenCalled()
    expect(result.current.statut).toBe('erreur')
    expect(result.current.erreur).toBe("L'export a échoué : aucun fichier n'a été créé. Réessayez.")
    expect(result.current.message).toBe('')
    expect(erreurConsole).toHaveBeenCalled()

    echouer = false
    await act(() => result.current.exporter())
    expect(result.current.statut).toBe('termine')
    expect(result.current.erreur).toBeNull()
    erreurConsole.mockRestore()
  })

  it('un échec du téléchargement lui-même est aussi signalé', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const telecharger = vi.fn(() => {
      throw new Error('bloqué')
    })
    const { result } = renderHook(() => useExport({ db: createTestDb(), telecharger, maintenant: () => MAINTENANT }))
    await act(() => result.current.exporter())
    expect(result.current.statut).toBe('erreur')
    vi.restoreAllMocks()
  })
})
