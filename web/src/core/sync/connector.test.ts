import type { PowerSyncDatabase, CrudEntry, CrudTransaction } from '@powersync/web'
import { UpdateType } from '@powersync/web'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseConnector } from './connector'
import { rejetsEnvoi } from './rejetsEnvoi'

type Erreur = { code?: string; message: string } | null

// Faux client Supabase : enregistre les appels et renvoie l'erreur configurée ; une liste d'erreurs
// est consommée appel après appel (la dernière se répète).
function fauxSupabase(erreurs: Erreur | Erreur[] = null, session: object | null = { access_token: 'jwt' }) {
  const file = Array.isArray(erreurs) ? [...erreurs] : [erreurs]
  const suivante = () => (file.length > 1 ? file.shift()! : file[0])
  const appels: { table: string; op: string; args: unknown[] }[] = []
  const client = {
    auth: { getSession: () => Promise.resolve({ data: { session }, error: null }) },
    from(table: string) {
      return {
        upsert: (...args: unknown[]) => {
          appels.push({ table, op: 'upsert', args })
          return Promise.resolve({ error: suivante() })
        },
        update: (...args: unknown[]) => ({
          eq: (...eqArgs: unknown[]) => {
            appels.push({ table, op: 'update', args: [...args, ...eqArgs] })
            return Promise.resolve({ error: suivante() })
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
  afterEach(() => {
    vi.useRealTimers()
    rejetsEnvoi.effacer()
  })

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

  it('applique PATCH en update partiel (jamais en upsert, pour ne pas violer les NOT NULL)', async () => {
    const { client, appels } = fauxSupabase()
    const { db } = fausseBase([{ op: UpdateType.PATCH, table: 'seances', id: 's1', opData: { nom: 'Haut' } }])
    await new SupabaseConnector(() => client).uploadData(db)
    expect(appels).toEqual([{ table: 'seances', op: 'update', args: [{ nom: 'Haut' }, 'id', 's1'] }])
    expect(appels.some((a) => a.op === 'upsert')).toBe(false)
  })

  it('ne fait rien sans transaction en attente', async () => {
    const { client, appels } = fauxSupabase()
    const db = { getNextCrudTransaction: () => Promise.resolve(null) } as unknown as PowerSyncDatabase
    await new SupabaseConnector(() => client).uploadData(db)
    expect(appels).toEqual([])
  })

  it('avec session, complète la transaction sur une erreur 23xxx et la journalise', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = fauxSupabase({ code: '23505', message: 'duplicate key' })
    const { db, complete } = fausseBase([{ op: UpdateType.PUT, table: 'seances', id: 's1', opData: {} }])
    await new SupabaseConnector(() => client).uploadData(db)
    expect(complete).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledTimes(1)
    const trace = JSON.stringify(spy.mock.calls[0])
    for (const v of ['seances', 'PUT', 's1', '23505']) expect(trace).toContain(v)
    spy.mockRestore()
  })

  it('un rejet définitif est exposé (table, opération, code) pour être affiché', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = fauxSupabase([null, { code: '23505', message: 'duplicate key' }])
    const { db } = fausseBase([
      { op: UpdateType.PUT, table: 'seances', id: 's1', opData: {} },
      { op: UpdateType.PATCH, table: 'user_settings', id: 'u1', opData: { dark_mode: 1 } },
    ])
    await new SupabaseConnector(() => client).uploadData(db)
    expect(rejetsEnvoi.dernier()).toEqual({
      table: 'user_settings', operation: 'PATCH', code: '23505', dateMs: Date.parse('2026-10-24T10:00:00.000Z'),
    })
  })

  it("une erreur retryable n'est pas exposée comme rejet", async () => {
    const { client } = fauxSupabase({ code: '08006', message: 'connexion perdue' })
    const { db } = fausseBase([{ op: UpdateType.PUT, table: 'seances', id: 's1', opData: {} }])
    await expect(new SupabaseConnector(() => client).uploadData(db)).rejects.toThrow()
    expect(rejetsEnvoi.dernier()).toBeNull()
  })

  it('PGRST204 sur validated_at (migration 0006 absente) : renvoie sans la colonne, journalise, la file avance', async () => {
    const avert = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { client, appels } = fauxSupabase([
      { code: 'PGRST204', message: "Could not find the 'validated_at' column of 'series_realisees' in the schema cache" },
      null,
    ])
    const { db, complete } = fausseBase([
      { op: UpdateType.PUT, table: 'series_realisees', id: 'r1', opData: { numero_serie: 1, validated_at: '2026-10-24T09:00:00.000Z' } },
    ])
    await new SupabaseConnector(() => client).uploadData(db)
    expect(appels.map((a) => a.args[0])).toEqual([
      { numero_serie: 1, validated_at: '2026-10-24T09:00:00.000Z', id: 'r1' },
      { numero_serie: 1, id: 'r1' },
    ])
    expect(complete).toHaveBeenCalledTimes(1)
    expect(String(avert.mock.calls[0][0])).toMatch(/0006/)
  })

  it('PGRST204 sur une autre colonne : relancé tel quel (aucune colonne retirée en silence)', async () => {
    const { client, appels } = fauxSupabase({ code: 'PGRST204', message: "Could not find the 'nom' column of 'seances'" })
    const { db, complete } = fausseBase([{ op: UpdateType.PUT, table: 'seances', id: 's1', opData: { nom: 'x' } }])
    await expect(new SupabaseConnector(() => client).uploadData(db)).rejects.toThrow()
    expect(appels).toHaveLength(1)
    expect(complete).not.toHaveBeenCalled()
  })

  it('sans session, lève une erreur (nouvel essai) et ne complète pas la transaction', async () => {
    const { client, appels } = fauxSupabase(null, null)
    const { db, complete } = fausseBase([{ op: UpdateType.PUT, table: 'seances', id: 's1', opData: {} }])
    await expect(new SupabaseConnector(() => client).uploadData(db)).rejects.toThrow()
    expect(complete).not.toHaveBeenCalled()
    expect(appels).toEqual([])
  })

  it('relance toute autre erreur sans compléter (nouvel essai)', async () => {
    const { client } = fauxSupabase({ code: '08006', message: 'connexion perdue' })
    const { db, complete } = fausseBase([{ op: UpdateType.PUT, table: 'seances', id: 's1', opData: {} }])
    await expect(new SupabaseConnector(() => client).uploadData(db)).rejects.toThrow('connexion perdue')
    expect(complete).not.toHaveBeenCalled()
  })
})

describe('SupabaseConnector.fetchCredentials', () => {
  beforeEach(() => vi.stubEnv('VITE_POWERSYNC_URL', 'https://ps.example.com'))
  afterEach(() => vi.unstubAllEnvs())

  const clientAvec = (resultat: object) =>
    ({ auth: { getSession: () => Promise.resolve(resultat) } }) as unknown as SupabaseClient

  it('renvoie null sans session', async () => {
    const c = new SupabaseConnector(() => clientAvec({ data: { session: null }, error: null }))
    expect(await c.fetchCredentials()).toBeNull()
  })

  it('renvoie endpoint, token et expiresAt converti en Date', async () => {
    const session = { access_token: 'jwt', expires_at: 1_800_000_000 }
    const c = new SupabaseConnector(() => clientAvec({ data: { session }, error: null }))
    expect(await c.fetchCredentials()).toEqual({
      endpoint: 'https://ps.example.com',
      token: 'jwt',
      expiresAt: new Date(1_800_000_000 * 1000),
    })
  })

  it('lève l’erreur Supabase', async () => {
    const c = new SupabaseConnector(() => clientAvec({ data: { session: null }, error: new Error('panne') }))
    await expect(c.fetchCredentials()).rejects.toThrow('panne')
  })
})
