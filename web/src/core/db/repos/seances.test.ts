import { beforeEach, describe, expect, it } from 'vitest'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'
import type { Db } from '../Db'
import { getSeanceTree, listSeanceTemplates, softDelete } from './seances'

let db: Db
const base = { user_id: 'u', updated_at: '2026-01-01T00:00:00Z', deleted_at: null }

beforeEach(async () => {
  db = createTestDb()
  await inserer(db, 'seances', { ...base, id: 's1', nom: 'Push', is_archived: 0, created_at: 'c' })
  await inserer(db, 'seances', { ...base, id: 's2', nom: 'Pull', is_archived: 1, created_at: 'c' })
})

describe('listSeanceTemplates', () => {
  it('mappe les lignes en camelCase avec de vrais booléens', async () => {
    const liste = await listSeanceTemplates(db)
    const push = liste.find((s) => s.id === 's1')
    expect(push).toMatchObject({ nom: 'Push', isArchived: false, updatedAt: base.updated_at })
    expect(liste.find((s) => s.id === 's2')?.isArchived).toBe(true)
  })

  it('une séance supprimée (softDelete) disparaît', async () => {
    await softDelete(db, 'seances', 's1')
    expect((await listSeanceTemplates(db)).map((s) => s.id)).toEqual(['s2'])
    // la ligne reste en base comme tombstone, avec updated_at rafraîchi pour la synchro
    const ligne = await db.get<{ deleted_at: string; updated_at: string }>(
      'SELECT deleted_at, updated_at FROM seances WHERE id = ?',
      ['s1'],
    )
    expect(ligne.deleted_at).not.toBeNull()
    expect(ligne.updated_at).not.toBe(base.updated_at)
  })

  it('softDelete refuse une table inconnue', async () => {
    await expect(softDelete(db, 'sqlite_master; DROP TABLE seances', 'x')).rejects.toThrow()
  })
})

describe('getSeanceTree', () => {
  beforeEach(async () => {
    const bloc = (id: string, position: number, instance: string | null) =>
      inserer(db, 'blocs_seance', { ...base, id, seance_id: 's1', nom: id, position, instance_seance_id: instance })
    await bloc('b2', 2, null)
    await bloc('b1', 1, null)
    await bloc('bi', 1, 'i1')
    const exo = (id: string, position: number, instance: string | null, extra = {}) =>
      inserer(db, 'exercices_seance', {
        ...base, id, seance_id: 's1', exercise_id: 'e', position, instance_seance_id: instance,
        reps_type: 'REPS', is_bilateral: 1, progression_activee: 0, is_bodyweight: 1,
        increment_kg: 2.5, type_exercice: 'ISOLATION', ...extra,
      })
    await exo('x3', 3, null)
    await exo('x1', 1, null)
    await exo('x2', 2, null, { deleted_at: '2026-02-01T00:00:00Z' })
    await exo('xi', 1, 'i1')
    await inserer(db, 'exercices_seance', { ...base, id: 'autre', seance_id: 's2', exercise_id: 'e', position: 0 })
  })

  it('trie blocs et exercices par position (template seul avec instanceId null)', async () => {
    const arbre = await getSeanceTree(db, 's1', null)
    expect(arbre.blocs.map((b) => b.id)).toEqual(['b1', 'b2'])
    expect(arbre.exercices.map((e) => e.id)).toEqual(['x1', 'x3'])
  })

  it('mappe les champs de progression et booléens', async () => {
    const [x1] = (await getSeanceTree(db, 's1', null)).exercices
    expect(x1).toMatchObject({
      repsType: 'REPS', isBilateral: true, progressionActivee: false, isBodyweight: true,
      incrementKg: 2.5, typeExercice: 'ISOLATION', repsMin: null, incrementPct: null,
      systemeProgression: null,
    })
  })

  it('avec un instanceId, ne renvoie que les lignes de cette instance', async () => {
    const arbre = await getSeanceTree(db, 's1', 'i1')
    expect(arbre.blocs.map((b) => b.id)).toEqual(['bi'])
    expect(arbre.exercices.map((e) => e.id)).toEqual(['xi'])
  })
})
