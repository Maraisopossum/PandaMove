// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../../core/db/Db'
import type { SyncState } from '../../../core/sync/useSyncStatus'
import { createTestDb } from '../../../test/sqliteDb'
import programme from './programme2027.json'
import { useImportProgramme } from './useImportProgramme'
import type { SourceSynchro } from './useSourceSynchro'

let db: Db
beforeEach(() => {
  db = createTestDb()
})

const compter = async () => {
  const l = await db.getAll<{ n: number }>('SELECT (SELECT count(*) FROM seances_course) + (SELECT count(*) FROM seances_velo) AS n')
  return l[0].n
}

// Source de synchronisation simulée : première synchro déjà faite, en ligne, file vide, sauf indication contraire.
function source(o: { etat?: SyncState; file?: number; premiere?: Promise<void> } = {}) {
  const signaux: AbortSignal[] = []
  const s: SourceSynchro & { signaux: AbortSignal[]; file: number } = {
    etat: o.etat ?? 'online',
    file: o.file ?? 0,
    signaux,
    attendrePremiereSynchro: (signal) => {
      signaux.push(signal)
      return o.premiere ?? Promise.resolve()
    },
    compterFileEnvoi: () => Promise.resolve(s.file),
  }
  return s
}

const monter = (synchro: SourceSynchro, userId: string | null = 'u1') =>
  renderHook((p: { synchro: SourceSynchro }) => useImportProgramme({ db, userId: userId ?? undefined, synchro: p.synchro }), {
    initialProps: { synchro },
  })

describe('useImportProgramme', () => {
  it('annonce le nombre de séances et de jalons du programme avant l’import', () => {
    const { result } = monter(source())
    expect(result.current.nbSeances).toBe(programme.length)
    expect(result.current.nbJalons).toBe(3)
    expect(result.current.statut).toBe('idle')
    expect(result.current.resultat).toBeNull()
  })

  it('importe, puis expose le résultat', async () => {
    const { result } = monter(source())
    await waitFor(() => expect(result.current.peutImporter).toBe(true))
    await act(async () => {
      await result.current.importer()
    })
    expect(result.current.statut).toBe('done')
    expect(result.current.resultat).toEqual({ creees: programme.length, dejaPresentes: 0 })
    expect(await compter()).toBe(programme.length)
  })

  it('au second import, ne crée rien et le dit', async () => {
    const { result } = monter(source())
    await waitFor(() => expect(result.current.peutImporter).toBe(true))
    await act(async () => {
      await result.current.importer()
    })
    await act(async () => {
      await result.current.importer()
    })
    expect(result.current.resultat).toEqual({ creees: 0, dejaPresentes: programme.length })
    expect(await compter()).toBe(programme.length)
  })

  it('sans utilisateur connecté : erreur lisible, rien d’écrit', async () => {
    const { result } = monter(source(), null)
    await act(async () => {
      await result.current.importer()
    })
    expect(result.current.statut).toBe('error')
    expect(result.current.erreur).toMatch(/connect/i)
    expect(await compter()).toBe(0)
  })

  it('un échec d’écriture donne un message générique (détail journalisé) et laisse réessayer', async () => {
    const journal = vi.spyOn(console, 'error').mockImplementation(() => {})
    const casse = { ...db, writeTransaction: () => Promise.reject(new Error('disque plein : détail technique')) } as Db
    const synchro = source()
    const { result, rerender } = renderHook((p: { db: Db }) => useImportProgramme({ db: p.db, userId: 'u1', synchro }), {
      initialProps: { db: casse },
    })
    await waitFor(() => expect(result.current.peutImporter).toBe(true))
    await act(async () => {
      await result.current.importer()
    })
    expect(result.current.statut).toBe('error')
    expect(result.current.erreur).toBe("L'import a échoué, aucune donnée n'a été modifiée.")
    expect(result.current.erreur).not.toMatch(/disque/)
    expect(journal).toHaveBeenCalled()

    rerender({ db })
    await act(async () => {
      await result.current.importer()
    })
    expect(result.current.statut).toBe('done')
    journal.mockRestore()
  })

  it('un second appel pendant l’import réutilise le premier : une seule écriture', async () => {
    const { result } = monter(source())
    await waitFor(() => expect(result.current.peutImporter).toBe(true))
    await act(async () => {
      await Promise.all([result.current.importer(), result.current.importer()])
    })
    expect(result.current.resultat).toEqual({ creees: programme.length, dejaPresentes: 0 })
    expect(await compter()).toBe(programme.length)
  })
})

describe('useImportProgramme : garde de synchronisation', () => {
  it('refuse tant que la première synchronisation n’est pas terminée, puis accepte', async () => {
    let terminer = () => {}
    const premiere = new Promise<void>((resolve) => {
      terminer = resolve
    })
    const { result } = monter(source({ premiere }))
    await waitFor(() => expect(result.current.raisonBlocage).toMatch(/première synchronisation/i))
    expect(result.current.peutImporter).toBe(false)
    await act(async () => {
      terminer()
      await premiere
    })
    await waitFor(() => expect(result.current.peutImporter).toBe(true))
    expect(result.current.raisonBlocage).toBeNull()
  })

  it('refuse hors ligne', async () => {
    const { result } = monter(source({ etat: 'offline' }))
    await waitFor(() => expect(result.current.raisonBlocage).toMatch(/hors ligne/i))
    expect(result.current.peutImporter).toBe(false)
  })

  it('refuse pendant une synchronisation en cours', async () => {
    const { result } = monter(source({ etat: 'syncing' }))
    await waitFor(() => expect(result.current.raisonBlocage).toMatch(/synchronisation en cours/i))
    expect(result.current.peutImporter).toBe(false)
  })

  it('refuse quand des écritures locales n’ont pas encore été envoyées', async () => {
    const { result } = monter(source({ file: 2 }))
    await waitFor(() => expect(result.current.raisonBlocage).toMatch(/pas encore envoyées/i))
    expect(result.current.peutImporter).toBe(false)
  })

  it('réévalue la file quand l’état de synchronisation change', async () => {
    const s = source({ etat: 'syncing', file: 2 })
    const { result, rerender } = monter(s)
    await waitFor(() => expect(result.current.raisonBlocage).toMatch(/synchronisation en cours/i))
    s.file = 0
    rerender({ synchro: { ...s, etat: 'online' } })
    await waitFor(() => expect(result.current.peutImporter).toBe(true))
  })

  it('revérifie la file au clic : refuse et n’écrit rien si une écriture est apparue entre-temps', async () => {
    const s = source()
    const { result } = monter(s)
    await waitFor(() => expect(result.current.peutImporter).toBe(true))
    s.file = 1
    await act(async () => {
      await result.current.importer()
    })
    expect(result.current.statut).toBe('error')
    expect(result.current.erreur).toMatch(/pas encore envoyées/i)
    expect(await compter()).toBe(0)
  })

  it('refuse un appel direct tant que la première synchronisation n’est pas faite', async () => {
    const premiere = new Promise<void>(() => {})
    const { result } = monter(source({ premiere }))
    await act(async () => {
      await result.current.importer()
    })
    expect(result.current.statut).toBe('error')
    expect(result.current.erreur).toMatch(/première synchronisation/i)
    expect(await compter()).toBe(0)
  })

  it('une file illisible bloque l’import (journalisé) au lieu de le laisser passer', async () => {
    const journal = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = { ...source(), compterFileEnvoi: () => Promise.reject(new Error('base fermée')) }
    const { result } = monter(s)
    await waitFor(() => expect(journal).toHaveBeenCalled())
    expect(result.current.peutImporter).toBe(false)
    journal.mockRestore()
  })

  it('annule l’attente de la première synchronisation au démontage', async () => {
    const s = source({ premiere: new Promise<void>(() => {}) })
    const { unmount } = monter(s)
    await waitFor(() => expect(s.signaux).toHaveLength(1))
    expect(s.signaux[0].aborted).toBe(false)
    unmount()
    expect(s.signaux[0].aborted).toBe(true)
  })
})
