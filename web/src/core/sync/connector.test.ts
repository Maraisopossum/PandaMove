import type { PowerSyncDatabase, CrudEntry, CrudTransaction } from '@powersync/web'
import { UpdateType } from '@powersync/web'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseConnector } from './connector'

type Erreur = { code?: string; message: string } | null

// Faux client Supabase : enregistre les appels et renvoie l'erreur configurée.
function fauxSupabase(erreur: Erreur = null) {
  const appels: { table: string; op: string; args: unknown[] }[] = []
  const client = {
    from(table: string) {
      return {
        upsert: (...args: unknown[]) => {
          appels.push({ table, op: 'upsert', args })
          return Promise.resolve({ error: erreur })
        },
        update: (...args: unknown[]) => ({
          eq: (...eqArgs: unknown[]) => {
            appels.push({ table, op: 'update', args: [...args, ...eqArgs] })
            return Promise.resolve({ error: erreur })
          },
        }),
      }
    },
  }
  return { client: client as unknown as SupabaseClient, appels }
}

function fausseBase(crud: Partial<CrudEntry>[]) {
  const complete = vi.fn(() => Promise.resolve())
  let restant: CrudTransaction | null = {
    crud: crud as CrudEntry[],
    complete,
  } as unknown as CrudTransaction
  const db = {
    getNextCrudTransaction: vi.fn(() => {
      const t = restant
      restant = null
      return Promise.resolve(t)
    }),
  }
  return { db: db as unknown as PowerSyncDatabase, complete }
}

describe('SupabaseConnector.uploadData', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-24T10:00:00.000Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('convertit un DELETE en update deleted_at = maintenant (suppression logique)', async () => {
    const { client, appels } = fauxSupabase()
    const { db, complete } = fausseBase([{ op: UpdateType.DELETE, table: 'seances', id: 's1' }])
    await new SupabaseConnector(() => client).uploadData(db)
    expect(appels).toEqual([
      { table: 'seances', op: 'update', args: [{ deleted_at: '2026-10-24T10:00:00.000Z' }, 'id', 's1'] },
    ])
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it('applique PUT en upsert avec id', async () => {
    const { client, appels } = fauxSupabase()
    const { db } = fausseBase([{ op: UpdateType.PUT, table: 'exercises', id: 'e1', opData: { name: 'Squat' } }])
    await new SupabaseConnector(() => client).uploadData(db)
    expect(appels).toEqual([{ table: 'exercises', op: 'upsert', args: [{ name: 'Squat', id: 'e1' }] }])
  })

  it('applique PATCH en upsert fusionnant opData et id', async () => {
    const { client, appels } = fauxSupabase()
    const { db } = fausseBase([{ op: UpdateType.PATCH, table: 'seances', id: 's1', opData: { nom: 'Haut' } }])
    await new SupabaseConnector(() => client).uploadData(db)
    expect(appels).toEqual([{ table: 'seances', op: 'upsert', args: [{ nom: 'Haut', id: 's1' }] }])
  })

  it('ne fait rien sans transaction en attente', async () => {
    const { client, appels } = fauxSupabase()
    const db = { getNextCrudTransaction: () => Promise.resolve(null) } as unknown as PowerSyncDatabase
    await new SupabaseConnector(() => client).uploadData(db)
    expect(appels).toEqual([])
  })

  it('complète la transaction sur une erreur Postgres non récupérable (23xxx) pour ne pas bloquer la file', async () => {
    const { client } = fauxSupabase({ code: '23505', message: 'duplicate key' })
    const { db, complete } = fausseBase([{ op: UpdateType.PUT, table: 'seances', id: 's1', opData: {} }])
    await new SupabaseConnector(() => client).uploadData(db)
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it('relance toute autre erreur sans compléter (nouvel essai)', async () => {
    const { client } = fauxSupabase({ code: '08006', message: 'connexion perdue' })
    const { db, complete } = fausseBase([{ op: UpdateType.PUT, table: 'seances', id: 's1', opData: {} }])
    await expect(new SupabaseConnector(() => client).uploadData(db)).rejects.toThrow('connexion perdue')
    expect(complete).not.toHaveBeenCalled()
  })
})
