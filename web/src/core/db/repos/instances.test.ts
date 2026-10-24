import { beforeEach, describe, expect, it } from 'vitest'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'
import type { Db } from '../Db'
import { deterministicId } from '../ids'
import { upsertRow } from '../upsert'
import { copyTemplateToInstance, createInstance, getInstance, listInstances } from './instances'
import { softDelete } from './seances'

let db: Db
beforeEach(() => {
  db = createTestDb()
})

describe('instances', () => {
  it('crée et relit une instance planifiée', async () => {
    const id = await createInstance(db, 's1', '2026-06-01')
    expect(await getInstance(db, id)).toMatchObject({
      id, seanceId: 's1', date: '2026-06-01', isCompleted: false, completedAt: null, durationSeconds: 0, notes: '',
    })
  })

  it('liste par date et ignore les supprimées', async () => {
    const a = await createInstance(db, 's1', '2026-06-02')
    const b = await createInstance(db, 's1', '2026-06-01')
    expect((await listInstances(db)).map((i) => i.id)).toEqual([b, a])
    await softDelete(db, 'instances_seance', b)
    expect((await listInstances(db)).map((i) => i.id)).toEqual([a])
    expect(await getInstance(db, b)).toBeNull()
  })
})

type Ligne = Record<string, unknown>
const base = { user_id: 'u', updated_at: '2026-01-01T00:00:00Z', deleted_at: null }

const bloc = (id: string, position: number, extra: Ligne = {}): Ligne => ({
  ...base, id, seance_id: 's1', nom: `Bloc ${id}`, type: 'STANDARD', position, duree_min: null,
  description: 'd', temps_repos_inter_sec: 60, temps_repos_fin_round_sec: 90,
  instance_seance_id: null, bloc_source_id: null, ...extra,
})
const exo = (id: string, position: number, blocId: string | null, extra: Ligne = {}): Ligne => ({
  ...base, id, seance_id: 's1', exercise_id: 'e1', bloc_id: blocId, superset_groupe: null, position,
  nombre_series_prevues: 3, reps_cibles: '8-10', charge_cible: '40', tempo: '2-0-2', reps_type: 'REPS',
  temps_repos_sec: 90, consigne_cle: 'k', equipement: 'Barre', avertissement: '',
  instance_seance_id: null, exercice_source_id: null, is_bilateral: 0, progression_activee: 1,
  systeme_progression: 'DOUBLE', reps_min: 8, reps_max: 10, increment_kg: 2.5, increment_duree_sec: 5,
  seuil_deload: 3, type_exercice: 'COMPOSE_BAS', increment_pct: 0.05, is_bodyweight: 0, ...extra,
})
const instanceLigne = (id: string, seanceId: string): Ligne => ({
  ...base, id, seance_id: seanceId, date: '2026-06-01', notes: '', is_completed: 0,
  completed_at: null, duration_seconds: 0, created_at: 'c',
})

// Template : 2 blocs (positions 1 et 3 non contiguës), 3 exercices dont 1 sans bloc,
// plus 1 bloc et 1 exercice supprimés (non copiés).
async function semer(d: Db): Promise<void> {
  await inserer(d, 'seances', { ...base, id: 's1', nom: 'Push', is_archived: 0, created_at: 'c' })
  await inserer(d, 'instances_seance', instanceLigne('i1', 's1'))
  await inserer(d, 'blocs_seance', bloc('b1', 1))
  await inserer(d, 'blocs_seance', bloc('b2', 3))
  await inserer(d, 'blocs_seance', bloc('bx', 2, { deleted_at: '2026-02-01T00:00:00Z' }))
  await inserer(d, 'exercices_seance', exo('x1', 1, 'b1'))
  await inserer(d, 'exercices_seance', exo('x2', 2, 'b2'))
  await inserer(d, 'exercices_seance', exo('x3', 5, null))
  await inserer(d, 'exercices_seance', exo('xx', 3, 'b1', { deleted_at: '2026-02-01T00:00:00Z' }))
}

const lignes = (d: Db, table: string, where: string, params: unknown[] = []) =>
  d.getAll<Ligne>(`SELECT * FROM ${table} WHERE ${where} ORDER BY id`, params)
const compte = async (d: Db, table: string) =>
  (await d.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)).n

describe('copyTemplateToInstance', () => {
  it('copie blocs et exercices vivants du template avec ids déterministes et sources', async () => {
    await semer(db)
    await copyTemplateToInstance(db, 'i1')
    const blocs = await lignes(db, 'blocs_seance', 'instance_seance_id = ?', ['i1'])
    const exos = await lignes(db, 'exercices_seance', 'instance_seance_id = ?', ['i1'])
    expect(blocs).toHaveLength(2)
    expect(exos).toHaveLength(3)
    const b1 = blocs.find((b) => b.bloc_source_id === 'b1')!
    expect(b1).toMatchObject({ id: deterministicId('i1', 'b1'), seance_id: 's1', position: 1, nom: 'Bloc b1' })
    expect(blocs.find((b) => b.bloc_source_id === 'b2')).toMatchObject({ position: 3 })
    const x1 = exos.find((e) => e.exercice_source_id === 'x1')!
    expect(x1).toMatchObject({
      id: deterministicId('i1', 'x1'), bloc_id: deterministicId('i1', 'b1'), position: 1,
      seance_id: 's1', reps_cibles: '8-10', increment_kg: 2.5, seuil_deload: 3, type_exercice: 'COMPOSE_BAS',
    })
    expect(exos.find((e) => e.exercice_source_id === 'x2')!.bloc_id).toBe(deterministicId('i1', 'b2'))
    const x3 = exos.find((e) => e.exercice_source_id === 'x3')!
    expect(x3.bloc_id).toBeNull()
    expect(x3.position).toBe(5)
    expect(exos.every((e) => e.deleted_at === null)).toBe(true)
  })

  it('un second appel ne change rien', async () => {
    await semer(db)
    await copyTemplateToInstance(db, 'i1')
    const avant = [await lignes(db, 'blocs_seance', '1=1'), await lignes(db, 'exercices_seance', '1=1')]
    await copyTemplateToInstance(db, 'i1')
    expect([await lignes(db, 'blocs_seance', '1=1'), await lignes(db, 'exercices_seance', '1=1')]).toEqual(avant)
  })

  it('ne modifie jamais les lignes du template (comparaison de lignes complètes)', async () => {
    await semer(db)
    const tpl = async () => [
      await lignes(db, 'blocs_seance', 'instance_seance_id IS NULL'),
      await lignes(db, 'exercices_seance', 'instance_seance_id IS NULL'),
    ]
    const avant = await tpl()
    await copyTemplateToInstance(db, 'i1')
    await copyTemplateToInstance(db, 'i1')
    expect(await tpl()).toEqual(avant)
  })

  it('ne copie pas les lignes de template supprimées ni les séries', async () => {
    await semer(db)
    await copyTemplateToInstance(db, 'i1')
    expect(await lignes(db, 'blocs_seance', 'bloc_source_id = ?', ['bx'])).toHaveLength(0)
    expect(await lignes(db, 'exercices_seance', 'exercice_source_id = ?', ['xx'])).toHaveLength(0)
    expect(await compte(db, 'series_realisees')).toBe(0)
    expect(await compte(db, 'objectifs_progression')).toBe(0)
  })

  it('deux appareils : fusion des lignes d’instance sans doublon', async () => {
    const dbB = createTestDb()
    await semer(db)
    await semer(dbB)
    await copyTemplateToInstance(db, 'i1')
    await copyTemplateToInstance(dbB, 'i1')
    const avantBlocs = await compte(db, 'blocs_seance')
    const avantExos = await compte(db, 'exercices_seance')
    const idsA = (await lignes(db, 'exercices_seance', 'instance_seance_id = ?', ['i1'])).map((l) => l.id)
    await db.writeTransaction(async (tx) => {
      for (const t of ['blocs_seance', 'exercices_seance']) {
        for (const l of await lignes(dbB, t, 'instance_seance_id = ?', ['i1'])) await upsertRow(tx, t, l)
      }
    })
    expect(await compte(db, 'blocs_seance')).toBe(avantBlocs)
    expect(await compte(db, 'exercices_seance')).toBe(avantExos)
    expect((await lignes(db, 'exercices_seance', 'instance_seance_id = ?', ['i1'])).map((l) => l.id)).toEqual(idsA)
  })

  it('modifier le template après la copie ne change pas l’instance', async () => {
    await semer(db)
    await copyTemplateToInstance(db, 'i1')
    const avant = await lignes(db, 'exercices_seance', 'instance_seance_id = ?', ['i1'])
    await db.execute("UPDATE exercices_seance SET reps_cibles = '1-2', charge_cible = '99' WHERE id = 'x1'")
    await db.execute("UPDATE blocs_seance SET nom = 'Renommé' WHERE id = 'b1'")
    await copyTemplateToInstance(db, 'i1')
    expect(await lignes(db, 'exercices_seance', 'instance_seance_id = ?', ['i1'])).toEqual(avant)
    expect((await lignes(db, 'blocs_seance', 'id = ?', [deterministicId('i1', 'b1')]))[0].nom).toBe('Bloc b1')
  })

  it('no-op si l’instance a déjà ses propres lignes (import)', async () => {
    await semer(db)
    await inserer(db, 'blocs_seance', bloc('ib', 1, { instance_seance_id: 'i1', bloc_source_id: 'b1' }))
    await copyTemplateToInstance(db, 'i1')
    expect(await lignes(db, 'blocs_seance', 'instance_seance_id = ?', ['i1'])).toHaveLength(1)
    expect(await lignes(db, 'exercices_seance', 'instance_seance_id = ?', ['i1'])).toHaveLength(0)
  })

  it('ignore les lignes d’instance supprimées pour la garde', async () => {
    await semer(db)
    await inserer(db, 'blocs_seance', bloc('ib', 1, {
      instance_seance_id: 'i1', bloc_source_id: 'b1', deleted_at: '2026-02-01T00:00:00Z',
    }))
    await copyTemplateToInstance(db, 'i1')
    expect(await lignes(db, 'exercices_seance', 'instance_seance_id = ?', ['i1'])).toHaveLength(3)
  })

  it('rejette une instance inconnue ou supprimée, sans rien écrire', async () => {
    await semer(db)
    await expect(copyTemplateToInstance(db, 'nope')).rejects.toThrow(/introuvable/i)
    await softDelete(db, 'instances_seance', 'i1')
    await expect(copyTemplateToInstance(db, 'i1')).rejects.toThrow(/introuvable/i)
    expect(await lignes(db, 'blocs_seance', 'instance_seance_id IS NOT NULL')).toHaveLength(0)
  })

  it('rejette une instance dont la séance est supprimée ou absente', async () => {
    await semer(db)
    await softDelete(db, 'seances', 's1')
    await expect(copyTemplateToInstance(db, 'i1')).rejects.toThrow(/séance/i)
    await inserer(db, 'instances_seance', instanceLigne('i2', 'fantome'))
    await expect(copyTemplateToInstance(db, 'i2')).rejects.toThrow(/séance/i)
    expect(await lignes(db, 'blocs_seance', 'instance_seance_id IS NOT NULL')).toHaveLength(0)
  })

  it('template vide : no-op sans erreur', async () => {
    await inserer(db, 'seances', { ...base, id: 's1', nom: 'Vide', is_archived: 0, created_at: 'c' })
    await inserer(db, 'instances_seance', instanceLigne('i1', 's1'))
    await copyTemplateToInstance(db, 'i1')
    expect(await compte(db, 'blocs_seance')).toBe(0)
    expect(await compte(db, 'exercices_seance')).toBe(0)
  })

  it('atomique : un échec en cours de copie annule tout', async () => {
    await semer(db)
    const origine = db.writeTransaction.bind(db)
    let ecritures = 0
    const casse: Db = {
      ...db,
      writeTransaction: (fn) =>
        origine((tx) =>
          fn({
            ...tx,
            execute: async (sql, params) => {
              if (/^\s*INSERT/i.test(sql) && ++ecritures === 4) throw new Error('panne simulée')
              return tx.execute(sql, params)
            },
          }),
        ),
    }
    await expect(copyTemplateToInstance(casse, 'i1')).rejects.toThrow('panne simulée')
    expect(ecritures).toBe(4)
    expect(await lignes(db, 'blocs_seance', 'instance_seance_id IS NOT NULL')).toHaveLength(0)
    expect(await lignes(db, 'exercices_seance', 'instance_seance_id IS NOT NULL')).toHaveLength(0)
  })
})
