import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../../core/db/Db'
import { listExercises } from '../../core/db/repos/exercises'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import { ajouterExercice, exercicesDe, nouvelExercice, supprimerExercice } from './draft'
import { chargerBrouillon, compterSeriesPerdues, enregistrerBrouillon, ErreurEditionInstance } from './seanceStore'

const base = { user_id: 'u1', updated_at: 'old', deleted_at: null }
let db: Db

async function exo(id: string, name: string) {
  await inserer(db, 'exercises', {
    ...base, id, name, category: 'OTHER', muscle_groups: '["DOS"]', description: '', is_favorite: 0, is_custom: 0, image_url: null,
    exercise_type: '', equipment: '[]', muscle_primary: 'DOS', is_bodyweight: 0,
  })
}

const ligneEx = (id: string, blocId: string | null, position: number, instance: string | null, exoId = 'tr') =>
  inserer(db, 'exercices_seance', {
    ...base, id, seance_id: 's1', exercise_id: exoId, bloc_id: blocId, position, nombre_series_prevues: 3, reps_cibles: '8',
    charge_cible: '', tempo: '', reps_type: 'REPS', temps_repos_sec: 90, consigne_cle: '', equipement: '', avertissement: '',
    instance_seance_id: instance, exercice_source_id: instance ? `src-${id}` : null, is_bilateral: 0, progression_activee: 0,
    increment_duree_sec: 5, seuil_deload: 3, is_bodyweight: 0,
  })
const ligneBloc = (id: string, position: number, instance: string | null) =>
  inserer(db, 'blocs_seance', {
    ...base, id, seance_id: 's1', nom: instance ? 'Copie' : 'Modèle', type: 'AUTRE', position, duree_min: null, description: '',
    temps_repos_inter_sec: 20, temps_repos_fin_round_sec: 120, instance_seance_id: instance, bloc_source_id: instance ? `src-${id}` : null,
  })

// Modèle s1 : bloc b1 [x1, x2] ; instance i1 : bloc bi1 [xi1, xi2] + exercice libre xi3 ; xi1 a deux séries validées
beforeEach(async () => {
  db = createTestDb()
  await exo('tr', 'Tractions')
  await exo('dc', 'Développé couché')
  await inserer(db, 'seances', {
    ...base, id: 's1', nom: 'Pull', groupes_musculaires: '["DOS"]', duree_estimee_min: 50, notes: 'n', seance_category: 'STRENGTH',
    created_at: '2026-01-01T00:00:00Z', is_archived: 0,
  })
  await inserer(db, 'instances_seance', {
    ...base, id: 'i1', seance_id: 's1', date: '2026-10-01', notes: '', is_completed: 0, completed_at: null, duration_seconds: 0, created_at: 'c',
  })
  await ligneBloc('b1', 0, null)
  await ligneEx('x1', 'b1', 0, null)
  await ligneEx('x2', 'b1', 1, null, 'dc')
  await ligneBloc('bi1', 0, 'i1')
  await ligneEx('xi1', 'bi1', 0, 'i1')
  await ligneEx('xi2', 'bi1', 1, 'i1', 'dc')
  await ligneEx('xi3', null, 1, 'i1')
  for (const [id, num] of [['si1', 1], ['si2', 2]] as const) {
    await inserer(db, 'series_realisees', {
      ...base, id, instance_seance_id: 'i1', exercice_seance_id: 'xi1', numero_serie: num, reps_realisees: 8, charge_kg: 60,
      charge_label: null, rpe: null, notes: '', is_completed: 1, validated_at: '2026-10-01T10:00:00.000Z',
    })
  }
})

const instantane = async () => ({
  seances: await db.getAll('SELECT * FROM seances ORDER BY id'),
  modeleBlocs: await db.getAll('SELECT * FROM blocs_seance WHERE instance_seance_id IS NULL ORDER BY id'),
  modeleExos: await db.getAll('SELECT * FROM exercices_seance WHERE instance_seance_id IS NULL ORDER BY id'),
})

describe('chargerBrouillon : mode instance', () => {
  it('charge les lignes de l’instance, jamais celles du modèle', async () => {
    const d = await chargerBrouillon(db, 's1', await listExercises(db), 'i1')
    const ids = d!.items.map((i) => (i.kind === 'bloc' ? i.bloc.id : i.exercice.id))
    expect(ids).toEqual(['bi1', 'xi3'])
    expect(exercicesDe(d!).map((e) => e.id).sort()).toEqual(['xi1', 'xi2', 'xi3'])
  })
})

describe('enregistrerBrouillon : mode instance (isolation template / instance)', () => {
  it('ajoute un exercice à l’instance sans toucher au modèle ni à la séance', async () => {
    const avant = await instantane()
    let d = (await chargerBrouillon(db, 's1', await listExercises(db), 'i1'))!
    d = ajouterExercice(d, null, nouvelExercice('nouveau', { id: 'dc', name: 'Développé couché', muscles: ['PECTORAUX'], equipment: [], isBodyweight: false }, null))
    await enregistrerBrouillon(db, d, 'i1')

    expect(await instantane()).toEqual(avant)
    const ligne = await db.get<{ instance_seance_id: string; seance_id: string; exercise_id: string; deleted_at: string | null }>(
      "SELECT instance_seance_id, seance_id, exercise_id, deleted_at FROM exercices_seance WHERE id = 'nouveau'",
    )
    expect(ligne).toMatchObject({ instance_seance_id: 'i1', seance_id: 's1', exercise_id: 'dc', deleted_at: null })
  })

  it('conserve les liens de copie (exercice_source_id / bloc_source_id) des lignes existantes', async () => {
    const d = (await chargerBrouillon(db, 's1', await listExercises(db), 'i1'))!
    await enregistrerBrouillon(db, d, 'i1')
    expect((await db.get<{ s: string }>("SELECT exercice_source_id AS s FROM exercices_seance WHERE id = 'xi1'")).s).toBe('src-xi1')
    expect((await db.get<{ s: string }>("SELECT bloc_source_id AS s FROM blocs_seance WHERE id = 'bi1'")).s).toBe('src-bi1')
  })

  it('retire un exercice de l’instance (suppression logique) et ses séries, sans toucher au modèle', async () => {
    const avant = await instantane()
    let d = (await chargerBrouillon(db, 's1', await listExercises(db), 'i1'))!
    d = supprimerExercice(d, 'xi1')
    await enregistrerBrouillon(db, d, 'i1')

    expect(await instantane()).toEqual(avant)
    const ligne = await db.get<{ deleted_at: string | null }>("SELECT deleted_at FROM exercices_seance WHERE id = 'xi1'")
    expect(ligne.deleted_at).not.toBeNull()
    const series = await db.getAll<{ deleted_at: string | null }>("SELECT deleted_at FROM series_realisees WHERE exercice_seance_id = 'xi1'")
    expect(series).toHaveLength(2)
    expect(series.every((s) => s.deleted_at !== null)).toBe(true)
    // Les autres lignes de l'instance restent vivantes
    expect((await db.get<{ deleted_at: string | null }>("SELECT deleted_at FROM exercices_seance WHERE id = 'xi2'")).deleted_at).toBeNull()
  })

  it('ne modifie pas la ligne seances (nom, notes, durée, groupes)', async () => {
    const d = (await chargerBrouillon(db, 's1', await listExercises(db), 'i1'))!
    await enregistrerBrouillon(db, { ...d, nom: 'Autre nom', notes: 'x', dureeEstimeeMin: 10 }, 'i1')
    expect(await db.get('SELECT nom, notes, duree_estimee_min, groupes_musculaires, updated_at FROM seances WHERE id = ?', ['s1'])).toEqual({
      nom: 'Pull', notes: 'n', duree_estimee_min: 50, groupes_musculaires: '["DOS"]', updated_at: 'old',
    })
  })

  it('refuse une instance terminée ou inconnue, sans rien écrire', async () => {
    const d = (await chargerBrouillon(db, 's1', await listExercises(db), 'i1'))!
    await db.execute("UPDATE instances_seance SET is_completed = 1 WHERE id = 'i1'")
    await expect(enregistrerBrouillon(db, d, 'i1')).rejects.toBeInstanceOf(ErreurEditionInstance)
    await expect(enregistrerBrouillon(db, d, 'inconnue')).rejects.toBeInstanceOf(ErreurEditionInstance)
  })

  it('refuse d’écrire des lignes d’une AUTRE instance ou du modèle sous un id repris par erreur', async () => {
    let d = (await chargerBrouillon(db, 's1', await listExercises(db), 'i1'))!
    // « x1 » est une ligne du MODÈLE : un brouillon d'instance ne doit pas pouvoir la réécrire
    d = ajouterExercice(d, null, nouvelExercice('x1', { id: 'dc', name: 'Développé couché', muscles: [], equipment: [], isBodyweight: false }, null))
    const avant = await instantane()
    await expect(enregistrerBrouillon(db, d, 'i1')).rejects.toBeInstanceOf(ErreurEditionInstance)
    expect(await instantane()).toEqual(avant)
  })
})

describe('compterSeriesPerdues', () => {
  it('séries validées des exercices retirés du brouillon', async () => {
    const d = (await chargerBrouillon(db, 's1', await listExercises(db), 'i1'))!
    expect(await compterSeriesPerdues(db, 'i1', d)).toEqual({ exercices: 0, series: 0 })
    expect(await compterSeriesPerdues(db, 'i1', supprimerExercice(d, 'xi1'))).toEqual({ exercices: 1, series: 2 })
    // Un exercice sans série validée n'est pas compté
    expect(await compterSeriesPerdues(db, 'i1', supprimerExercice(d, 'xi2'))).toEqual({ exercices: 0, series: 0 })
  })
})
