import type { PowerSyncDatabase } from '@powersync/web'

// Sous-ensemble de l'API PowerSync utilisé par les dépôts : permet de les tester
// avec un SQLite en mémoire (le WASM de PowerSync ne se charge pas sous Node).
export interface DbLecture {
  getAll<T>(sql: string, params?: unknown[]): Promise<T[]>
  get<T>(sql: string, params?: unknown[]): Promise<T>
  getOptional<T>(sql: string, params?: unknown[]): Promise<T | null>
}

export interface DbTx extends DbLecture {
  execute(sql: string, params?: unknown[]): Promise<unknown>
}

export interface Db extends DbLecture {
  execute(sql: string, params?: unknown[]): Promise<unknown>
  writeTransaction<T>(fn: (tx: DbTx) => Promise<T>): Promise<T>
}

// Assertion de compilation : le vrai PowerSyncDatabase doit rester assignable à Db.
export function versDb(db: PowerSyncDatabase): Db {
  return db
}
