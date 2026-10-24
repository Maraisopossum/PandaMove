import { DatabaseSync } from 'node:sqlite'
import type { Db, DbTx } from '../core/db/Db'
import { AppSchema } from '../core/db/schema'

type Param = null | number | bigint | string

// Les booléens JS deviennent 0/1, comme dans PowerSync.
function normaliser(params: unknown[] = []): Param[] {
  return params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : ((p ?? null) as Param)))
}

// Génère le DDL depuis AppSchema (source unique des colonnes) ; ColumnType vaut déjà TEXT/INTEGER/REAL.
function ddl(): string[] {
  return AppSchema.tables.map((table) => {
    const colonnes = table.columns.map((c) => `${c.name} ${c.type}`)
    return `CREATE TABLE ${table.name} (id TEXT PRIMARY KEY, ${colonnes.join(', ')})`
  })
}

// Base SQLite en mémoire, avec la même surface que Db.
export function createTestDb(): Db {
  const sqlite = new DatabaseSync(':memory:')
  for (const requete of ddl()) sqlite.exec(requete)

  const lecture = {
    getAll: async <T>(sql: string, params?: unknown[]) =>
      sqlite.prepare(sql).all(...normaliser(params)) as T[],
    get: async <T>(sql: string, params?: unknown[]) => {
      const ligne = sqlite.prepare(sql).get(...normaliser(params))
      if (ligne === undefined) throw new Error('Aucune ligne')
      return ligne as T
    },
    getOptional: async <T>(sql: string, params?: unknown[]) =>
      (sqlite.prepare(sql).get(...normaliser(params)) ?? null) as T | null,
  }
  const execute = async (sql: string, params?: unknown[]) => {
    sqlite.prepare(sql).run(...normaliser(params))
  }
  const tx: DbTx = { ...lecture, execute }

  return {
    ...lecture,
    execute,
    writeTransaction: async <T>(fn: (t: DbTx) => Promise<T>) => {
      sqlite.exec('BEGIN')
      try {
        const resultat = await fn(tx)
        sqlite.exec('COMMIT')
        return resultat
      } catch (e) {
        sqlite.exec('ROLLBACK')
        throw e
      }
    },
  }
}
