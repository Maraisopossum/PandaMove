import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { TABLES_CARDIO } from './repos/seancesCardio'

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const lire = (...chemin: string[]) => readFileSync(join(web, ...chemin), 'utf8').replace(/\r\n/g, '\n')

const schema = lire('src', 'core', 'db', 'schema.ts')
const regles = lire('powersync', 'sync-rules.yaml')
const migration = lire('supabase', 'migrations', '0008_seances_cardio.sql')

const tablesSchema = [...schema.matchAll(/^ {2}(\w+): new Table\(/gm)].map((m) => m[1])
const tablesRegles = [...regles.matchAll(/^\s*- SELECT \* FROM (\w+) WHERE/gm)].map((m) => m[1])
const tablesMigration = [...(/foreach t in array array\[([^\]]+)\] loop/.exec(migration)?.[1] ?? '').matchAll(/'(\w+)'/g)].map((m) => m[1])

// Les tables de cardio sont écrites à la main à quatre endroits : migration, schéma local, règles de synchro, module d'accès.
describe('cohérence des tables de cardio', () => {
  const attendues = Object.values(TABLES_CARDIO).sort()

  it('la migration crée exactement les tables du module d’accès', () => {
    expect([...tablesMigration].sort()).toEqual(attendues)
  })

  it('le schéma local déclare chacune de ces tables', () => {
    for (const t of attendues) expect(tablesSchema, t).toContain(t)
  })

  it('les règles de synchro en envoient chacune', () => {
    for (const t of attendues) expect(tablesRegles, t).toContain(t)
  })

  it('le schéma et les règles listent les mêmes tables', () => {
    expect([...tablesSchema].sort()).toEqual([...tablesRegles].sort())
  })
})
