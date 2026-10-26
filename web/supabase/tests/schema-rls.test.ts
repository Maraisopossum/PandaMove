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

const MIGRATIONS_AVANT_0006 = [
  '0001_schema.sql',
  '0002_rls.sql',
  '0003_dark_mode_nullable.sql',
  '0004_instance_clock.sql',
  '0005_instance_progression.sql',
]
const TABLES = [
  'exercises', 'seances', 'blocs_seance', 'exercices_seance',
  'instances_seance', 'series_realisees', 'objectifs_progression', 'user_settings',
]

/** Exécute `fn` sous le rôle donné (défaut `authenticated`) avec le claim `sub` de l'utilisateur ;
 * le claim et le rôle sont toujours réinitialisés (tests indépendants de l'ordre). */
async function commeUtilisateur<T>(uid: string, fn: () => Promise<T>, role = 'authenticated'): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false); set role ${role};`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}

/** Exécute `fn` comme visiteur non connecté (rôle `anon`, aucun claim). */
async function commeAnonyme<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec('set role anon;')
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
  // Ce que Supabase fournit : schéma auth, auth.uid(), les rôles anon / authenticated et des droits
  // par défaut LARGES (Supabase accorde tout à anon et authenticated sur les tables créées dans public).
  // Un rôle de réplication PowerSync reçoit SELECT, comme dans le guide Supabase + PowerSync.
  await db.exec(`
    create schema auth;
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin;
    create role authenticated nologin;
    create role powersync_role nologin bypassrls;
    grant usage on schema public, auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
  `)
  for (const nom of MIGRATIONS_AVANT_0006) await db.exec(migration(nom))
  await db.exec('grant select on all tables in schema public to powersync_role;')
  await db.exec(migration('0006_durcissement.sql'))
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
    // 0006 : plus aucun DELETE physique (suppression logique via deleted_at uniquement)
    await expect(
      commeUtilisateur(B, () => db.query(`delete from seances where id = '${SEANCE_A}'`)),
    ).rejects.toThrow(/permission denied/)
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

describe('0005 : marqueur de progression', () => {
  it('instances_seance porte progression_json (text), nullable et sans défaut', async () => {
    const r = await db.query<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>(
      `select column_name, data_type, is_nullable, column_default from information_schema.columns
       where table_name = 'instances_seance' and column_name = 'progression_json'`,
    )
    expect(r.rows).toEqual([{ column_name: 'progression_json', data_type: 'text', is_nullable: 'YES', column_default: null }])
  })
})

describe('0007 : nom de séance jouée et note d’exercice', () => {
  it('instances_seance.nom et exercices_seance.notes existent (text, nullables, sans défaut), la migration est rejouable', async () => {
    await db.exec(migration('0007_nom_instance_note_exercice.sql'))
    await db.exec(migration('0007_nom_instance_note_exercice.sql'))
    const r = await db.query<{ table_name: string; column_name: string; data_type: string; is_nullable: string; column_default: string | null }>(
      `select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns
       where (table_name = 'instances_seance' and column_name = 'nom') or (table_name = 'exercices_seance' and column_name = 'notes')
       order by table_name`,
    )
    expect(r.rows).toEqual([
      { table_name: 'exercices_seance', column_name: 'notes', data_type: 'text', is_nullable: 'YES', column_default: null },
      { table_name: 'instances_seance', column_name: 'nom', data_type: 'text', is_nullable: 'YES', column_default: null },
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

describe('0006 : durcissement', () => {
  const C = '00000000-0000-4000-8000-00000000000c'
  const D = '00000000-0000-4000-8000-00000000000d'
  const INST = '60000000-0000-4000-8000-000000000001'
  const SRC = '70000000-0000-4000-8000-000000000001'

  const insererBloc = (id: string, sourceId: string | null = SRC) =>
    db.exec(`insert into blocs_seance (id, seance_id, nom, type, position, description, temps_repos_inter_sec,
        temps_repos_fin_round_sec, instance_seance_id, bloc_source_id)
      values ('${id}', '${SEANCE_A}', 'Bloc', 'SUPERSET', 0, '', 0, 0, '${INST}', ${sourceId ? `'${sourceId}'` : 'null'})`)

  it("anon n'a aucun droit sur aucune table (lecture et écriture refusées)", async () => {
    for (const table of TABLES) {
      const r = await db.query<{ ok: boolean }>(
        `select has_table_privilege('anon', 'public.${table}', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') as ok`,
      )
      expect(r.rows[0].ok, table).toBe(false)
    }
    await expect(commeAnonyme(() => db.query('select * from seances'))).rejects.toThrow(/permission denied/)
    await expect(commeAnonyme(() => insererSeance('10000000-0000-4000-8000-0000000000aa'))).rejects.toThrow(
      /permission denied/,
    )
  })

  it('authenticated : SELECT / INSERT / UPDATE seulement (ni DELETE ni TRUNCATE)', async () => {
    for (const table of TABLES) {
      const r = await db.query<{ lecture: boolean; ecriture: boolean; destruction: boolean }>(
        `select has_table_privilege('authenticated', 'public.${table}', 'SELECT') as lecture,
                has_table_privilege('authenticated', 'public.${table}', 'INSERT') and
                has_table_privilege('authenticated', 'public.${table}', 'UPDATE') as ecriture,
                has_table_privilege('authenticated', 'public.${table}', 'DELETE, TRUNCATE') as destruction`,
      )
      expect(r.rows[0], table).toEqual({ lecture: true, ecriture: true, destruction: false })
    }
  })

  it('le rôle de réplication PowerSync garde SELECT sur toutes les tables (aucun REVOKE ne le concerne)', async () => {
    for (const table of TABLES) {
      const r = await db.query<{ ok: boolean }>(
        `select has_table_privilege('powersync_role', 'public.${table}', 'SELECT') as ok`,
      )
      expect(r.rows[0].ok, table).toBe(true)
    }
  })

  it('les politiques visent seulement authenticated et utilisent (select auth.uid())', async () => {
    const r = await db.query<{ tablename: string; roles: string; qual: string; with_check: string }>(
      `select tablename, roles::text as roles, qual, with_check from pg_policies
       where schemaname = 'public' order by tablename`,
    )
    expect(r.rows.map((p) => p.tablename)).toEqual([...TABLES].sort())
    for (const p of r.rows) {
      expect(p.roles, p.tablename).toBe('{authenticated}')
      expect(p.qual, p.tablename).toMatch(/\(\s*SELECT auth\.uid\(\)/i)
      expect(p.with_check, p.tablename).toMatch(/\(\s*SELECT auth\.uid\(\)/i)
    }
  })

  it('set_updated_at a un search_path vide et reste déclenché sous authenticated', async () => {
    const r = await db.query<{ cfg: string[] }>(`select proconfig as cfg from pg_proc where proname = 'set_updated_at'`)
    expect(r.rows[0].cfg).toEqual(['search_path=""'])
    const id = '10000000-0000-4000-8000-0000000000c1'
    await commeUtilisateur(C, () => insererSeance(id))
    await db.exec(`alter table seances disable trigger set_updated_at;
      update seances set updated_at = '2000-01-01T00:00:00Z' where id = '${id}';
      alter table seances enable trigger set_updated_at;`)
    await commeUtilisateur(C, () => db.exec(`update seances set notes = 'x' where id = '${id}'`))
    const apres = await db.query<{ updated_at: Date }>(`select updated_at from seances where id = '${id}'`)
    expect(apres.rows[0].updated_at.getUTCFullYear()).toBeGreaterThanOrEqual(2026)
  })

  it('un second compte ne voit aucune ligne du premier, dans aucune table', async () => {
    await commeUtilisateur(C, () => insererSeance('10000000-0000-4000-8000-0000000000c2'))
    await commeUtilisateur(C, () => db.exec(`insert into user_settings (id) values ('50000000-0000-4000-8000-0000000000c1')`))
    for (const table of TABLES) {
      const r = await commeUtilisateur(D, () => db.query<{ n: number }>(`select count(*)::int as n from ${table}`))
      expect(r.rows[0].n, table).toBe(0)
    }
    const vus = await commeUtilisateur(C, () => db.query<{ n: number }>('select count(*)::int as n from user_settings'))
    expect(vus.rows[0].n).toBe(1)
  })

  it('user_settings : une seule ligne vivante par utilisateur, chaque compte a la sienne', async () => {
    const U = '00000000-0000-4000-8000-0000000000e1'
    const V = '00000000-0000-4000-8000-0000000000e2'
    await commeUtilisateur(U, () => db.exec(`insert into user_settings (id) values ('50000000-0000-4000-8000-0000000000e1')`))
    await expect(
      commeUtilisateur(U, () => db.exec(`insert into user_settings (id) values ('50000000-0000-4000-8000-0000000000e2')`)),
    ).rejects.toThrow(/duplicate key|unique/i)
    await commeUtilisateur(V, () => db.exec(`insert into user_settings (id) values ('50000000-0000-4000-8000-0000000000e3')`))
    // Une ligne supprimée logiquement ne compte plus
    await commeUtilisateur(U, () =>
      db.exec(`update user_settings set deleted_at = now() where id = '50000000-0000-4000-8000-0000000000e1'`),
    )
    await commeUtilisateur(U, () => db.exec(`insert into user_settings (id) values ('50000000-0000-4000-8000-0000000000e4')`))
  })

  it("blocs d'instance : un doublon (instance, bloc source) est refusé pour un même compte, pas entre deux comptes", async () => {
    await commeUtilisateur(C, () => insererBloc('80000000-0000-4000-8000-000000000001'))
    await expect(commeUtilisateur(C, () => insererBloc('80000000-0000-4000-8000-000000000002'))).rejects.toThrow(
      /duplicate key|unique/i,
    )
    await commeUtilisateur(D, () => insererBloc('80000000-0000-4000-8000-000000000003'))
    // Sans bloc source (bloc créé dans l'instance), aucune contrainte
    await commeUtilisateur(C, () => insererBloc('80000000-0000-4000-8000-000000000004', null))
    await commeUtilisateur(C, () => insererBloc('80000000-0000-4000-8000-000000000005', null))
  })

  it("exercices d'instance : l'unicité est par compte (un autre compte n'est jamais bloqué)", async () => {
    await commeUtilisateur(C, () => insererExerciceSeance('90000000-0000-4000-8000-000000000001', INST, SRC))
    await expect(
      commeUtilisateur(C, () => insererExerciceSeance('90000000-0000-4000-8000-000000000002', INST, SRC)),
    ).rejects.toThrow(/duplicate key|unique/i)
    await commeUtilisateur(D, () => insererExerciceSeance('90000000-0000-4000-8000-000000000003', INST, SRC))
    const ancien = await db.query(`select indexname from pg_indexes where indexname = 'exercices_seance_instance_source_uniq'`)
    expect(ancien.rows).toEqual([])
  })

  it("series_realisees porte validated_at (timestamptz), nullable et sans défaut, jamais réécrit par le trigger", async () => {
    const r = await db.query<{ data_type: string; is_nullable: string; column_default: string | null }>(
      `select data_type, is_nullable, column_default from information_schema.columns
       where table_name = 'series_realisees' and column_name = 'validated_at'`,
    )
    expect(r.rows).toEqual([{ data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null }])
  })

  it('la migration est rejouable sans erreur (idempotente)', async () => {
    await db.exec(migration('0006_durcissement.sql'))
    const r = await db.query<{ n: number }>(`select count(*)::int as n from pg_policies where schemaname = 'public'`)
    expect(r.rows[0].n).toBe(TABLES.length)
  })
})
