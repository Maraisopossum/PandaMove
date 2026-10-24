import type { Db } from '../core/db/Db'

// Insère une ligne brute (colonnes snake_case) dans une table de test.
export async function inserer(db: Db, table: string, ligne: Record<string, unknown>): Promise<void> {
  const cles = Object.keys(ligne)
  await db.execute(
    `INSERT INTO ${table} (${cles.join(', ')}) VALUES (${cles.map(() => '?').join(', ')})`,
    cles.map((c) => ligne[c]),
  )
}
