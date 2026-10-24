import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Vérification exécutable (PGlite) du schéma et de la RLS, en complément du test pgTAP
// `rls.test.sql` qui, lui, nécessite `supabase test db` (Docker).

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const SEANCE_A = '10000000-0000-4000-8000-000000000001'

const migration = (nom: string) => readFileSync(resolve(import.meta.dirname, '../migrations', nom), 'utf8')

let db: PGlite

/** Exécute `fn` sous le rôle `authenticated` avec le claim `sub` de l'utilisateur donné. */
async function commeUtilisateur<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`)
  try {
    return await fn()
  } finally {
    await db.exec('reset role;')
  }
}

/** Insère une séance ; `userId` force explicitement le user_id (sinon auth.uid()). */
const insererSeance = (id: string, userId?: string) =>
  db.exec(`insert into seances (id, ${userId ? 'user_id, ' : ''}nom, groupes_musculaires, duree_estimee_min, notes, seance_category, created_at, is_archived)
    values ('${id}', ${userId ? `'${userId}', ` : ''}'Push', 'PECTORAUX', 45, '', 'STRENGTH', '2026-01-01', false)`)

/** Insère un exercices_seance avec reps_type paramétrable. */
const insererExerciceSeance = (id: string, instanceId: string | null, sourceId: string | null, repsType = 'REPS') =>
  db.exec(`insert into exercices_seance (id, seance_id, exercise_id, position, nombre_series_prevues, reps_cibles, charge_cible,
      tempo, reps_type, temps_repos_sec, consigne_cle, equipement, avertissement, instance_seance_id, exercice_source_id,
      is_bilateral, progression_activee, increment_duree_sec, seuil_deload, is_bodyweight)
    values ('${id}', '${SEANCE_A}', '${SEANCE_A}', 1, 3, '8-10', '', '', '${repsType}', 90, '', '', '',
      ${instanceId ? `'${instanceId}'` : 'null'}, ${sourceId ? `'${sourceId}'` : 'null'}, false, false, 0, 3, false)`)

beforeAll(async () => {
  db = new PGlite()
  // Ce que Supabase fournit : schéma auth, auth.uid() et le rôle authenticated
  await db.exec(`
    create schema auth;
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role authenticated nologin;
  `)
  await db.exec(migration('0001_schema.sql'))
  await db.exec(migration('0002_rls.sql'))
  await db.exec(migration('0003_dark_mode_nullable.sql'))
  await db.exec(migration('0004_instance_clock.sql'))
  await db.exec(`
    grant usage on schema public, auth to authenticated;
    grant all on all tables in schema public to authenticated;
  `)
})

afterAll(async () => {
  await db.close()
})

describe('RLS : isolation entre utilisateurs', () => {
  beforeAll(async () => {
    await commeUtilisateur(A, () => insererSeance(SEANCE_A))
  })

  it('A voit sa propre séance (user_id rempli par auth.uid())', async () => {
    const r = await commeUtilisateur(A, () => db.query<{ user_id: string }>('select user_id from seances'))
    expect(r.rows).toEqual([{ user_id: A }])
  })

  it('B ne voit aucune ligne de A', async () => {
    const r = await commeUtilisateur(B, () => db.query<{ n: number }>('select count(*)::int as n from seances'))
    expect(r.rows[0].n).toBe(0)
  })

  it('B ne peut ni modifier ni supprimer la ligne de A', async () => {
    const u = await commeUtilisateur(B, () => db.query(`update seances set nom = 'piraté' where id = '${SEANCE_A}'`))
    expect(u.affectedRows).toBe(0)
    const d = await commeUtilisateur(B, () => db.query(`delete from seances where id = '${SEANCE_A}'`))
    expect(d.affectedRows).toBe(0)
    const r = await commeUtilisateur(A, () => db.query<{ nom: string }>('select nom from seances'))
    expect(r.rows).toEqual([{ nom: 'Push' }])
  })

  it('B ne peut pas insérer une ligne avec le user_id de A', async () => {
    await expect(
      commeUtilisateur(B, () => insererSeance('10000000-0000-4000-8000-000000000002', A)),
    ).rejects.toThrow(/row-level security/)
  })

  it('B ne peut pas réaffecter une de ses lignes à A via update (with check)', async () => {
    await commeUtilisateur(B, () => insererSeance('10000000-0000-4000-8000-000000000003'))
    await expect(
      commeUtilisateur(B, () =>
        db.query(`update seances set user_id = '${A}' where id = '10000000-0000-4000-8000-000000000003'`),
      ),
    ).rejects.toThrow(/row-level security/)
  })
})

describe('contraintes', () => {
  const INST = '20000000-0000-4000-8000-000000000001'
  const SRC = '30000000-0000-4000-8000-000000000001'

  it("l'unicité partielle (instance_seance_id, exercice_source_id) rejette un doublon puis autorise après soft delete", async () => {
    await commeUtilisateur(A, () => insererExerciceSeance('40000000-0000-4000-8000-000000000001', INST, SRC))
    await expect(
      commeUtilisateur(A, () => insererExerciceSeance('40000000-0000-4000-8000-000000000002', INST, SRC)),
    ).rejects.toThrow(/duplicate key|unique/i)
    // Les templates (instance_seance_id null) ne sont pas concernés
    await commeUtilisateur(A, () => insererExerciceSeance('40000000-0000-4000-8000-000000000003', null, SRC))
    await commeUtilisateur(A, () => insererExerciceSeance('40000000-0000-4000-8000-000000000004', null, SRC))
    // Soft delete puis ré-insertion
    await commeUtilisateur(A, () =>
      db.exec(`update exercices_seance set deleted_at = now() where id = '40000000-0000-4000-8000-000000000001'`),
    )
    await commeUtilisateur(A, () => insererExerciceSeance('40000000-0000-4000-8000-000000000005', INST, SRC))
  })

  it('CHECK reps_type refuse une valeur inconnue', async () => {
    await expect(
      commeUtilisateur(A, () => insererExerciceSeance('40000000-0000-4000-8000-000000000006', null, null, 'FOO')),
    ).rejects.toThrow(/reps_type/)
  })

  it('CHECK type_exercice refuse une valeur inconnue et accepte null et une valeur valide', async () => {
    await commeUtilisateur(A, () => insererExerciceSeance('40000000-0000-4000-8000-000000000007', null, null))
    await expect(
      commeUtilisateur(A, () =>
        db.exec(`update exercices_seance set type_exercice = 'BIZARRE' where id = '40000000-0000-4000-8000-000000000007'`),
      ),
    ).rejects.toThrow(/type_exercice/)
    await commeUtilisateur(A, () =>
      db.exec(`update exercices_seance set type_exercice = 'PDC' where id = '40000000-0000-4000-8000-000000000007'`),
    )
  })

  it('user_settings : panda_variant restreint à male/female, valeurs par défaut', async () => {
    await expect(
      commeUtilisateur(A, () =>
        db.exec(`insert into user_settings (id, panda_variant) values ('50000000-0000-4000-8000-000000000001', 'robot')`),
      ),
    ).rejects.toThrow(/panda_variant/)
    await commeUtilisateur(A, () => db.exec(`insert into user_settings (id) values ('50000000-0000-4000-8000-000000000002')`))
    const r = await commeUtilisateur(A, () =>
      db.query<{ panda_variant: string; dark_mode: boolean | null }>('select panda_variant, dark_mode from user_settings'),
    )
    expect(r.rows).toEqual([{ panda_variant: 'male', dark_mode: null }])
  })
})

describe('0004 : horloge de séance', () => {
  it('instances_seance porte started_at (timestamptz) et paused_json (text), nullables et sans défaut', async () => {
    const r = await db.query<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>(
      `select column_name, data_type, is_nullable, column_default from information_schema.columns
       where table_name = 'instances_seance' and column_name in ('started_at', 'paused_json') order by column_name`,
    )
    expect(r.rows).toEqual([
      { column_name: 'paused_json', data_type: 'text', is_nullable: 'YES', column_default: null },
      { column_name: 'started_at', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null },
    ])
  })
})

describe('trigger set_updated_at', () => {
  it('met à jour updated_at à chaque update', async () => {
    // Le trigger écrase toute valeur : on fige d'abord une date ancienne via un update direct du trigger désactivé
    await db.exec(`alter table seances disable trigger set_updated_at;
      update seances set updated_at = '2000-01-01T00:00:00Z' where id = '${SEANCE_A}';
      alter table seances enable trigger set_updated_at;`)
    const avant = await db.query<{ updated_at: Date }>(`select updated_at from seances where id = '${SEANCE_A}'`)
    expect(avant.rows[0].updated_at.getUTCFullYear()).toBe(2000)
    await commeUtilisateur(A, () => db.exec(`update seances set notes = 'maj' where id = '${SEANCE_A}'`))
    const apres = await db.query<{ updated_at: Date }>(`select updated_at from seances where id = '${SEANCE_A}'`)
    expect(apres.rows[0].updated_at.getUTCFullYear()).toBeGreaterThanOrEqual(2026)
  })
})
