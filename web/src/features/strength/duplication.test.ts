import { describe, expect, it } from 'vitest'
import type { Db } from '../../core/db/Db'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import { ErreurSeance } from './affectation'
import { dupliquerSeance } from './duplication'

const base = { user_id: 'u1', updated_at: 'u0', deleted_at: null }

async function semer(db: Db) {
  await inserer(db, 'seances', {
    ...base, id: 's1', nom: 'Pull', groupes_musculaires: '["DOS"]', duree_estimee_min: 50, notes: 'note', seance_category: 'STRENGTH',
    created_at: 'c0', is_archived: 1,
  })
  // Modèle : un bloc (avec un exercice) + un exercice libre
  await inserer(db, 'blocs_seance', { ...base, id: 'b1', seance_id: 's1', instance_seance_id: null, nom: 'Superset', type: 'SUPERSET', position: 1 })
  await inserer(db, 'exercices_seance', {
    ...base, id: 'e1', seance_id: 's1', instance_seance_id: null, bloc_id: 'b1', exercise_id: 'x1', position: 0, nombre_series_prevues: 4,
    progression_activee: 1, systeme_progression: 'DOUBLE', exercice_source_id: 'zzz',
  })
  await inserer(db, 'exercices_seance', { ...base, id: 'e2', seance_id: 's1', instance_seance_id: null, bloc_id: null, exercise_id: 'x2', position: 0 })
  // Pièges : ligne supprimée du modèle, instance + ses copies + ses séries, objectif de progression
  await inserer(db, 'exercices_seance', { ...base, deleted_at: 'x', id: 'e3', seance_id: 's1', instance_seance_id: null, exercise_id: 'x3', position: 2 })
  await inserer(db, 'instances_seance', { ...base, id: 'i1', seance_id: 's1', date: '2026-10-01', is_completed: 1 })
  await inserer(db, 'blocs_seance', { ...base, id: 'i1-b', seance_id: 's1', instance_seance_id: 'i1', nom: 'Copie bloc', position: 0 })
  await inserer(db, 'exercices_seance', { ...base, id: 'i1-e', seance_id: 's1', instance_seance_id: 'i1', exercise_id: 'x1', position: 0 })
  await inserer(db, 'series_realisees', { ...base, id: 'i1-s', instance_seance_id: 'i1', exercice_seance_id: 'i1-e', numero_serie: 1, is_completed: 1 })
  await inserer(db, 'objectifs_progression', { ...base, id: 'o1', seance_id: 's1', exercise_id: 'x1' })
}

const compter = async (db: Db, table: string) => (await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)).n

describe('dupliquerSeance', () => {
  it('copie le modèle complet : séance « (copie) » non archivée, blocs, exercices rattachés au nouveau bloc', async () => {
    const db = createTestDb()
    await semer(db)
    const id = await dupliquerSeance(db, 's1')
    expect(id).not.toBe('s1')

    const s = await db.get<Record<string, unknown>>('SELECT * FROM seances WHERE id = ?', [id])
    expect(s).toMatchObject({
      nom: 'Pull (copie)', groupes_musculaires: '["DOS"]', duree_estimee_min: 50, notes: 'note', seance_category: 'STRENGTH',
      is_archived: 0, deleted_at: null,
    })
    expect(s.created_at).not.toBe('c0')

    const blocs = await db.getAll<Record<string, unknown>>('SELECT * FROM blocs_seance WHERE seance_id = ?', [id])
    expect(blocs).toHaveLength(1)
    expect(blocs[0]).toMatchObject({ nom: 'Superset', type: 'SUPERSET', position: 1, instance_seance_id: null })
    expect(blocs[0].id).not.toBe('b1')

    const exos = await db.getAll<Record<string, unknown>>('SELECT * FROM exercices_seance WHERE seance_id = ? ORDER BY exercise_id', [id])
    expect(exos.map((e) => e.exercise_id)).toEqual(['x1', 'x2'])
    expect(exos[0]).toMatchObject({ bloc_id: blocs[0].id, nombre_series_prevues: 4, progression_activee: 1, systeme_progression: 'DOUBLE' })
    expect(exos[1].bloc_id).toBeNull()
    for (const e of exos) {
      expect(e.instance_seance_id).toBeNull()
      expect(e.exercice_source_id).toBeNull()
      expect(['e1', 'e2']).not.toContain(e.id)
    }
  })

  it("isolation template/instance : aucune instance, ligne d'instance, ligne supprimée, série ni objectif n'est copié", async () => {
    const db = createTestDb()
    await semer(db)
    await dupliquerSeance(db, 's1')
    expect(await compter(db, 'instances_seance')).toBe(1)
    expect(await compter(db, 'series_realisees')).toBe(1)
    expect(await compter(db, 'objectifs_progression')).toBe(1)
    // Blocs : 1 modèle + 1 copie d'instance + 1 nouveau modèle ; exercices : e1, e2, e3 (supprimé), i1-e + 2 nouveaux
    expect(await compter(db, 'blocs_seance')).toBe(3)
    expect(await compter(db, 'exercices_seance')).toBe(6)
    const dupliques = await db.getAll<{ exercise_id: string }>(
      "SELECT exercise_id FROM exercices_seance WHERE seance_id NOT IN ('s1')",
    )
    expect(dupliques.map((d) => d.exercise_id).sort()).toEqual(['x1', 'x2'])
    const nouveaux = await db.getAll<{ instance_seance_id: string | null }>(
      "SELECT instance_seance_id FROM blocs_seance WHERE seance_id NOT IN ('s1')",
    )
    expect(nouveaux).toEqual([{ instance_seance_id: null }])
  })

  it("la source n'est pas modifiée", async () => {
    const db = createTestDb()
    await semer(db)
    const avant = await db.getAll('SELECT * FROM exercices_seance WHERE seance_id = ? ORDER BY id', ['s1'])
    const seanceAvant = await db.get('SELECT * FROM seances WHERE id = ?', ['s1'])
    await dupliquerSeance(db, 's1')
    expect(await db.getAll('SELECT * FROM exercices_seance WHERE seance_id = ? ORDER BY id', ['s1'])).toEqual(avant)
    expect(await db.get('SELECT * FROM seances WHERE id = ?', ['s1'])).toEqual(seanceAvant)
  })

  it('deux duplications donnent deux copies distinctes (ids aléatoires)', async () => {
    const db = createTestDb()
    await semer(db)
    const a = await dupliquerSeance(db, 's1')
    const b = await dupliquerSeance(db, 's1')
    expect(a).not.toBe(b)
    expect(await compter(db, 'seances')).toBe(3)
  })

  it('séance inconnue ou supprimée : erreur française, rien écrit', async () => {
    const db = createTestDb()
    await semer(db)
    await db.execute("UPDATE seances SET deleted_at = 'x' WHERE id = 's1'")
    await expect(dupliquerSeance(db, 's1')).rejects.toThrow(ErreurSeance)
    await expect(dupliquerSeance(db, 'nope')).rejects.toThrow('Séance introuvable.')
    expect(await compter(db, 'seances')).toBe(1)
    expect(await compter(db, 'blocs_seance')).toBe(2)
  })

  it('un exercice dont le bloc est supprimé devient libre dans la copie', async () => {
    const db = createTestDb()
    await semer(db)
    await db.execute("UPDATE blocs_seance SET deleted_at = 'x' WHERE id = 'b1'")
    const id = await dupliquerSeance(db, 's1')
    const exos = await db.getAll<{ bloc_id: string | null }>('SELECT bloc_id FROM exercices_seance WHERE seance_id = ?', [id])
    expect(exos.map((e) => e.bloc_id)).toEqual([null, null])
    expect(await db.getAll('SELECT id FROM blocs_seance WHERE seance_id = ?', [id])).toEqual([])
  })
})
