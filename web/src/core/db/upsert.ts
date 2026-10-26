import { AppSchema } from './schema'
import type { DbTx } from './Db'

const COLONNES = new Map(AppSchema.tables.map((t) => [t.name, new Set(t.columns.map((c) => c.name))]))

// Upsert par id, dans la transaction fournie : SELECT puis UPDATE ou INSERT. Les tables PowerSync
// sont des vues SQLite : ON CONFLICT n'y fonctionne pas, d'où ce schéma en deux temps.
// Le nom de table et les colonnes sont validés contre AppSchema (jamais interpolés tels quels).
export async function upsertRow(
  tx: DbTx,
  table: string,
  ligne: Record<string, unknown>,
): Promise<'inserted' | 'updated'> {
  const colonnesTable = COLONNES.get(table)
  if (!colonnesTable) throw new Error(`Table inconnue : ${table}`)
  const { id, ...champs } = ligne
  if (typeof id !== 'string' || id === '') throw new Error(`Ligne sans id pour la table ${table}`)
  const noms = Object.keys(champs)
  for (const nom of noms) {
    if (!colonnesTable.has(nom)) throw new Error(`Colonne inconnue « ${nom} » pour la table ${table}`)
  }
  const valeurs = noms.map((n) => champs[n])

  const existante = await tx.getOptional<{ one: number }>(`SELECT 1 AS one FROM ${table} WHERE id = ?`, [id])
  if (existante) {
    if (noms.length > 0) {
      await tx.execute(`UPDATE ${table} SET ${noms.map((n) => `${n} = ?`).join(', ')} WHERE id = ?`, [...valeurs, id])
    }
    return 'updated'
  }
  await tx.execute(
    `INSERT INTO ${table} (id${noms.map((n) => `, ${n}`).join('')}) VALUES (?${noms.map(() => ', ?').join('')})`,
    [id, ...valeurs],
  )
  return 'inserted'
}
