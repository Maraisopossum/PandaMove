import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
// Fins de ligne normalisées : sous Windows, Git peut extraire les fichiers en CRLF.
const rules = readFileSync(join(here, 'sync-rules.yaml'), 'utf8').replace(/\r\n/g, '\n')
const schema = readFileSync(join(here, '..', 'src', 'core', 'db', 'schema.ts'), 'utf8').replace(/\r\n/g, '\n')

// Tables déclarées dans AppSchema (une ligne `  nom: new Table({` par table)
const schemaTables = [...schema.matchAll(/^ {2}(\w+): new Table\(/gm)].map((m) => m[1]).sort()

// Lignes de requête des Sync Streams (indentées sous `queries:`)
const queryLines = rules.split('\n').filter((line) => /^\s*- SELECT\b/.test(line))
const queryTables = queryLines.map((line) => line.match(/^\s*- SELECT \* FROM (\w+) WHERE user_id = auth\.user_id\(\)$/)?.[1] ?? null)

describe('règles de synchro PowerSync (Sync Streams, édition 3)', () => {
  it('déclare l\'édition 3 du format Sync Streams', () => {
    expect(rules).toMatch(/^config:\n\s+edition: 3\s*$/m)
    expect(rules).toMatch(/^streams:\n/m)
  })

  it('a exactement une requête par table, filtrée sur user_id = auth.user_id()', () => {
    expect(queryLines).toHaveLength(schemaTables.length)
    expect(queryTables.every((table) => table !== null)).toBe(true)
    expect([...(queryTables as string[])].sort()).toEqual(schemaTables)
  })

  it('synchronise les 8 tables de AppSchema (aucune table oubliée)', () => {
    expect(schemaTables).toHaveLength(8)
    expect(new Set(queryTables).size).toBe(queryTables.length)
  })
})
