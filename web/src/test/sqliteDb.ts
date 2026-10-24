import { DatabaseSync } from 'node:sqlite'
import type { Db, DbTx } from '../core/db/Db'
import { AppSchema } from '../core/db/schema'

type Param = null | number | bigint | string

// Les booléens JS deviennent 0/1, comme dans PowerSync.
function normaliser(params: unknown[] = []): Param[] {
  return params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : ((p ?? null) as Param)))
}

// Les tables PowerSync sont des vues : ON CONFLICT, RETURNING et UPDATE ... FROM n'y fonctionnent
// pas en production alors que SQLite les accepte sur de vraies tables. On les refuse donc ici.
// Heuristique (limites) : on retire d'abord les littéraux '...' puis les parenthèses imbriquées,
// pour qu'un sous-select dans SET/WHERE ne soit pas pris pour un UPDATE ... FROM. Un FROM hors
// parenthèses après un UPDATE est rejeté ; une requête multi-instructions (non utilisée) pourrait
// donner un faux positif, et du SQL construit de façon exotique pourrait passer.
function garde(sql: string): void {
  let nu = sql.replace(/'(?:[^']|'')*'/g, "''")
  for (let precedent = ''; precedent !== nu; ) {
    precedent = nu
    nu = nu.replace(/\([^()]*\)/g, '')
  }
  if (/\bON\s+CONFLICT\b|\bRETURNING\b/i.test(nu) || /\bUPDATE\b[\s\S]*\bFROM\b/i.test(nu)) {
    throw new Error(
      'SQL non supporté : les tables PowerSync sont des vues (ON CONFLICT, RETURNING et UPDATE ... FROM ' +
        'sont interdits). Alternative : SELECT puis UPDATE ou INSERT dans writeTransaction.',
    )
  }
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
    getAll: async <T>(sql: string, params?: unknown[]) => {
      garde(sql)
      return sqlite.prepare(sql).all(...normaliser(params)) as T[]
    },
    get: async <T>(sql: string, params?: unknown[]) => {
      garde(sql)
      const ligne = sqlite.prepare(sql).get(...normaliser(params))
      if (ligne === undefined) throw new Error('Aucune ligne')
      return ligne as T
    },
    getOptional: async <T>(sql: string, params?: unknown[]) => {
      garde(sql)
      return (sqlite.prepare(sql).get(...normaliser(params)) ?? null) as T | null
    },
  }
  const execute = async (sql: string, params?: unknown[]) => {
    garde(sql)
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
