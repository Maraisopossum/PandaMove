// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../../core/db/Db'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import { exercicesDe } from './draft'
import { useSeanceEdit } from './useSeanceEdit'

const base = { user_id: 'u1', updated_at: 'old', deleted_at: null }
let db: Db

const ligneEx = (id: string, instance: string | null, exoId = 'tr', position = 0) =>
  inserer(db, 'exercices_seance', {
    ...base, id, seance_id: 's1', exercise_id: exoId, bloc_id: null, position, nombre_series_prevues: 3, reps_cibles: '8', charge_cible: '',
    tempo: '', reps_type: 'REPS', temps_repos_sec: 90, consigne_cle: '', equipement: '', avertissement: '', instance_seance_id: instance,
    is_bilateral: 0, progression_activee: 0, increment_duree_sec: 5, seuil_deload: 3, is_bodyweight: 0,
  })

beforeEach(async () => {
  db = createTestDb()
  for (const [id, name] of [['tr', 'Tractions'], ['dc', 'Développé couché']]) {
    await inserer(db, 'exercises', {
      ...base, id, name, category: 'OTHER', muscle_groups: '["DOS"]', description: '', is_favorite: 0, is_custom: 0, image_url: null,
      exercise_type: '', equipment: '[]', muscle_primary: 'DOS', is_bodyweight: 0,
    })
  }
  await inserer(db, 'seances', {
    ...base, id: 's1', nom: 'Pull', groupes_musculaires: '[]', duree_estimee_min: 50, notes: '', seance_category: 'STRENGTH',
    created_at: 'c', is_archived: 0,
  })
  await inserer(db, 'instances_seance', {
    ...base, id: 'i1', seance_id: 's1', date: '2026-10-01', notes: '', is_completed: 0, completed_at: null, duration_seconds: 0, created_at: 'c',
  })
  await ligneEx('x1', null)
  await ligneEx('xi1', 'i1')
  await inserer(db, 'series_realisees', {
    ...base, id: 'si1', instance_seance_id: 'i1', exercice_seance_id: 'xi1', numero_serie: 1, reps_realisees: 8, charge_kg: 60,
    charge_label: null, rpe: null, notes: '', is_completed: 1, validated_at: '2026-10-01T10:00:00.000Z',
  })
})

async function monter(instanceId: string) {
  const rendu = renderHook(() => useSeanceEdit(null, { db, instanceId }))
  await waitFor(() => expect(rendu.result.current.charge).toBe(true))
  return rendu
}

describe('useSeanceEdit : mode instance', () => {
  it('charge les exercices de l’instance (pas ceux du modèle) et se marque en mode instance', async () => {
    const { result } = await monter('i1')
    expect(result.current.enInstance).toBe(true)
    expect(exercicesDe(result.current.draft).map((e) => e.id)).toEqual(['xi1'])
    expect(result.current.erreur).toBeNull()
  })

  it('instance terminée ou inconnue : message français, aucun brouillon', async () => {
    await db.execute("UPDATE instances_seance SET is_completed = 1 WHERE id = 'i1'")
    expect((await monter('i1')).result.current.erreur).toBe("Cette séance est terminée : elle n'est plus modifiable.")
    expect((await monter('inconnue')).result.current.erreur).toBe('Séance introuvable.')
  })

  it('ajoute des exercices à l’instance et enregistre sans toucher au modèle', async () => {
    const { result } = await monter('i1')
    act(() => result.current.ajouterExercices(null, ['dc']))
    expect(result.current.modifie).toBe(true)
    await act(async () => {
      expect(await result.current.enregistrer()).toBe('s1')
    })
    const lignes = await db.getAll<{ exercise_id: string; instance_seance_id: string | null }>(
      "SELECT exercise_id, instance_seance_id FROM exercices_seance WHERE deleted_at IS NULL ORDER BY exercise_id, instance_seance_id",
    )
    expect(lignes).toEqual([
      { exercise_id: 'dc', instance_seance_id: 'i1' },
      { exercise_id: 'tr', instance_seance_id: null },
      { exercise_id: 'tr', instance_seance_id: 'i1' },
    ])
  })

  it('une séance sans aucun exercice est refusée (sinon le modèle serait recopié à la réouverture)', async () => {
    const { result } = await monter('i1')
    act(() => result.current.supprimerExercice('xi1'))
    await act(async () => {
      expect(await result.current.enregistrer(true)).toBeNull()
    })
    expect(result.current.erreur).toBe('Une séance doit garder au moins un exercice.')
  })

  it('retirer un exercice qui a des séries validées demande confirmation, puis les supprime', async () => {
    const { result } = await monter('i1')
    act(() => result.current.ajouterExercices(null, ['dc']))
    act(() => result.current.supprimerExercice('xi1'))
    await act(async () => {
      expect(await result.current.enregistrer()).toBeNull()
    })
    expect(result.current.pertes).toEqual({ exercices: 1, series: 1 })
    expect((await db.get<{ deleted_at: string | null }>("SELECT deleted_at FROM exercices_seance WHERE id = 'xi1'")).deleted_at).toBeNull()
    await act(async () => {
      expect(await result.current.enregistrer(true)).toBe('s1')
    })
    expect(result.current.pertes).toBeNull()
    expect((await db.get<{ deleted_at: string | null }>("SELECT deleted_at FROM exercices_seance WHERE id = 'xi1'")).deleted_at).not.toBeNull()
    expect((await db.get<{ deleted_at: string | null }>("SELECT deleted_at FROM series_realisees WHERE id = 'si1'")).deleted_at).not.toBeNull()
  })

  it('annuler la confirmation garde tout', async () => {
    const { result } = await monter('i1')
    act(() => result.current.ajouterExercices(null, ['dc']))
    act(() => result.current.supprimerExercice('xi1'))
    await act(async () => {
      await result.current.enregistrer()
    })
    act(() => result.current.annulerPertes())
    expect(result.current.pertes).toBeNull()
  })
})
