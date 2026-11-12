import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { TABLES_RESPIRATION } from './repos/respiration'
import { TABLE_MOBILITE } from './repos/mobilite'
import { TABLES_CARDIO } from './repos/seancesCardio'
import { TABLE_SORTIES } from './repos/sorties'

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const lire = (...chemin: string[]) => readFileSync(join(web, ...chemin), 'utf8').replace(/\r\n/g, '\n')

const schema = lire('src', 'core', 'db', 'schema.ts')
const regles = lire('powersync', 'sync-rules.yaml')
const migration = lire('supabase', 'migrations', '0008_seances_cardio.sql')
const migrationRespiration = lire('supabase', 'migrations', '0009_respiration.sql')
const migrationSorties = lire('supabase', 'migrations', '0010_sorties.sql')
const migrationMobilite = lire('supabase', 'migrations', '0012_mobilite_rappels.sql')

const tablesSchema = [...schema.matchAll(/^ {2}(\w+): new Table\(/gm)].map((m) => m[1])
const tablesRegles = [...regles.matchAll(/^\s*- SELECT \* FROM (\w+) WHERE/gm)].map((m) => m[1])
const tablesMigration = [...(/foreach t in array array\[([^\]]+)\] loop/.exec(migration)?.[1] ?? '').matchAll(/'(\w+)'/g)].map((m) => m[1])
const tablesMigrationRespiration = [...(/foreach t in array array\[([^\]]+)\] loop/.exec(migrationRespiration)?.[1] ?? '').matchAll(/'(\w+)'/g)].map((m) => m[1])

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

  it('la migration 0009 crée exactement les tables du module d’accès à la respiration', () => {
    expect([...tablesMigrationRespiration].sort()).toEqual(Object.values(TABLES_RESPIRATION).sort())
    // Les tables sont créées par des create table explicites (et non dans la boucle) : chacune doit y figurer.
    for (const t of Object.values(TABLES_RESPIRATION)) expect(migrationRespiration, t).toContain(`create table if not exists public.${t} (`)
  })

  it('le schéma local et les règles de synchro portent les tables de respiration', () => {
    for (const t of Object.values(TABLES_RESPIRATION)) {
      expect(tablesSchema, t).toContain(t)
      expect(tablesRegles, t).toContain(t)
    }
  })

  it('la migration 0010 crée la table des sorties, présente aussi dans le schéma local et les règles de synchro', () => {
    expect(/foreach t in array array\['sorties'\] loop/.test(migrationSorties)).toBe(true)
    expect(migrationSorties).toContain(`create table if not exists public.${TABLE_SORTIES} (`)
    expect(tablesSchema).toContain(TABLE_SORTIES)
    expect(tablesRegles).toContain(TABLE_SORTIES)
  })

  it('la migration 0012 crée la table de mobilité, présente aussi dans le schéma local et les règles de synchro', () => {
    expect(/foreach t in array array\['seances_mobilite'\] loop/.test(migrationMobilite)).toBe(true)
    expect(migrationMobilite).toContain(`create table if not exists public.${TABLE_MOBILITE} (`)
    expect(tablesSchema).toContain(TABLE_MOBILITE)
    expect(tablesRegles).toContain(TABLE_MOBILITE)
  })

  it('la colonne rappels_json existe dans la migration 0012 et dans le schéma local de user_settings', () => {
    expect(migrationMobilite).toContain('alter table public.user_settings add column if not exists rappels_json text')
    expect(/user_settings: new Table\(\{[^}]*rappels_json: t/.test(schema)).toBe(true)
  })

  it('le schéma et les règles listent les mêmes tables', () => {
    expect([...tablesSchema].sort()).toEqual([...tablesRegles].sort())
  })
})
