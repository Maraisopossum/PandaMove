import { describe, expect, it } from 'vitest'
import type { ExerciceSeance, ObjectifProgression } from '../../core/db/types'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import {
  formatRepos, libelleCharge, libelleIncrement, libelleReps, lireDetailSeance, libelleSysteme,
} from './detailSeance'

const exo = (extra: Partial<ExerciceSeance> = {}): ExerciceSeance => ({
  id: 'e', seanceId: 's', exerciseId: 'x', blocId: null, supersetGroupe: null, position: 0, nombreSeriesPrevues: 3, repsCibles: '8',
  chargeCible: '', tempo: '', repsType: 'REPS', tempsReposSec: 90, consigneCle: '', equipement: '', avertissement: '',
  instanceSeanceId: null, exerciceSourceId: null, isBilateral: false, progressionActivee: false, systemeProgression: null,
  repsMin: null, repsMax: null, incrementKg: null, incrementDureeSec: 5, seuilDeload: 3, typeExercice: null, incrementPct: null,
  isBodyweight: false, updatedAt: 'u', ...extra,
})
const objectif = (extra: Partial<ObjectifProgression> = {}): ObjectifProgression => ({
  id: 'o', seanceId: 's', exerciseId: 'x', chargeCible: null, repsCible: null, dureeCibleSec: null, compteurEchec: 0, derniereMaj: null,
  nombreSeriesCible: null, updatedAt: 'u', ...extra,
})

describe('formatRepos', () => {
  it('secondes sous la minute, minutes pleines, minutes + secondes', () => {
    expect(formatRepos(45)).toBe('45 s')
    expect(formatRepos(60)).toBe('1 min')
    expect(formatRepos(120)).toBe('2 min')
    expect(formatRepos(90)).toBe('1 min 30 s')
  })
})

describe('libelleReps', () => {
  it('objectif de progression prioritaire, puis fourchette de progression, puis cible brute', () => {
    expect(libelleReps(exo({ repsCibles: '8' }), objectif({ repsCible: 10 }))).toBe('10')
    expect(libelleReps(exo({ progressionActivee: true, repsMin: 8, repsMax: 12 }), null)).toBe('8–12')
    expect(libelleReps(exo({ progressionActivee: false, repsMin: 8, repsMax: 12, repsCibles: '10' }), null)).toBe('10')
    expect(libelleReps(exo({ repsCibles: '' }), null)).toBe('—')
  })
  it('durée : secondes de l\'objectif, sinon de la cible ; 1:30 au-delà de la minute', () => {
    expect(libelleReps(exo({ repsType: 'DURATION', repsCibles: '45' }), null)).toBe('45s')
    expect(libelleReps(exo({ repsType: 'DURATION', repsCibles: '45' }), objectif({ dureeCibleSec: 50 }))).toBe('50s')
    expect(libelleReps(exo({ repsType: 'DURATION', repsCibles: '90' }), null)).toBe('1:30')
    expect(libelleReps(exo({ repsType: 'DURATION', repsCibles: '' }), null)).toBe('0s')
  })
})

describe('libelleCharge', () => {
  it('poids du corps, objectif (virgule française), charge saisie, rien', () => {
    expect(libelleCharge(exo({ isBodyweight: true, chargeCible: '20 kg' }), objectif({ chargeCible: 30 }))).toBe('PDC')
    expect(libelleCharge(exo(), objectif({ chargeCible: 22.5 }))).toBe('22,5 kg')
    expect(libelleCharge(exo(), objectif({ chargeCible: 20 }))).toBe('20 kg')
    expect(libelleCharge(exo({ chargeCible: '  15 kg ' }), null)).toBe('15 kg')
    expect(libelleCharge(exo({ chargeCible: ' ' }), null)).toBeNull()
  })
})

describe('libelleIncrement / libelleSysteme', () => {
  it('par type d\'exercice', () => {
    expect(libelleIncrement(exo({ isBodyweight: true }))).toBe('+ séries')
    expect(libelleIncrement(exo({ repsType: 'DURATION', incrementDureeSec: 10 }))).toBe('+10s')
    expect(libelleIncrement(exo({ incrementKg: 2.5 }))).toBe('+2,5 kg')
    expect(libelleIncrement(exo({ incrementKg: 5 }))).toBe('+5 kg')
    expect(libelleIncrement(exo({ incrementKg: null }))).toBeNull()
  })
  it('système de progression en français', () => {
    expect(libelleSysteme('DOUBLE')).toBe('Double progression')
    expect(libelleSysteme('LINEAIRE')).toBe('Linéaire')
    expect(libelleSysteme('AUTRE_SYSTEME')).toBe('Autre systeme')
    expect(libelleSysteme(null)).toBeNull()
  })
})

const base = { user_id: 'u1', updated_at: 'u0', deleted_at: null }

async function monde() {
  const db = createTestDb()
  await inserer(db, 'seances', {
    ...base, id: 's1', nom: 'Pull', groupes_musculaires: '["DOS","BICEPS"]', duree_estimee_min: 55, notes: 'Tempo lent', seance_category: 'STRENGTH',
    created_at: 'c', is_archived: 0,
  })
  for (const [id, name] of [['x1', 'Tractions'], ['x2', 'Curl'], ['x3', 'Rowing']]) {
    await inserer(db, 'exercises', {
      ...base, id, name, category: 'OTHER', muscle_groups: '[]', description: '', is_favorite: 0, is_custom: 0, image_url: null, exercise_type: '',
      equipment: '[]', muscle_primary: '', is_bodyweight: 0,
    })
  }
  // Bloc en position 1, exercice libre en position 0 : l'ordre de l'écran suit les positions
  await inserer(db, 'blocs_seance', {
    ...base, id: 'b1', seance_id: 's1', instance_seance_id: null, nom: 'Superset bras', type: 'SUPERSET', position: 1,
    temps_repos_inter_sec: 20, temps_repos_fin_round_sec: 90,
  })
  await inserer(db, 'exercices_seance', {
    ...base, id: 'e0', seance_id: 's1', instance_seance_id: null, exercise_id: 'x1', position: 0, nombre_series_prevues: 4, reps_cibles: '8',
    progression_activee: 1, systeme_progression: 'DOUBLE', reps_min: 6, reps_max: 10, increment_kg: 2.5, is_bodyweight: 1, is_bilateral: 0,
    equipement: 'Barre de traction', avertissement: 'Coudes serrés', temps_repos_sec: 120,
  })
  await inserer(db, 'exercices_seance', {
    ...base, id: 'e1', seance_id: 's1', instance_seance_id: null, bloc_id: 'b1', exercise_id: 'x2', position: 1, nombre_series_prevues: 3,
    reps_cibles: '12', charge_cible: '10 kg', is_bilateral: 1,
  })
  await inserer(db, 'exercices_seance', {
    ...base, id: 'e2', seance_id: 's1', instance_seance_id: null, bloc_id: 'b1', exercise_id: 'x3', position: 0, nombre_series_prevues: 3,
    reps_cibles: '12', superset_groupe: 'A',
  })
  // Lignes à ignorer : copie d'instance, ligne supprimée
  await inserer(db, 'exercices_seance', { ...base, id: 'ei', seance_id: 's1', instance_seance_id: 'i1', exercise_id: 'x1', position: 0 })
  await inserer(db, 'exercices_seance', { ...base, deleted_at: 'x', id: 'es', seance_id: 's1', instance_seance_id: null, exercise_id: 'x1', position: 5 })
  await inserer(db, 'objectifs_progression', { ...base, id: 'o1', seance_id: 's1', exercise_id: 'x1', charge_cible: 7.5, reps_cible: 7 })
  await inserer(db, 'instances_seance', { ...base, id: 'i1', seance_id: 's1', date: '2026-10-01', is_completed: 1 })
  await inserer(db, 'instances_seance', { ...base, id: 'i2', seance_id: 's1', date: '2026-11-05', is_completed: 0 })
  await inserer(db, 'instances_seance', { ...base, id: 'i3', seance_id: 's1', date: '2026-10-20', is_completed: 1 })
  await inserer(db, 'instances_seance', { ...base, id: 'i4', seance_id: 's1', date: '2026-10-29', is_completed: 0, started_at: '2026-10-29T08:00:00.000Z' })
  await inserer(db, 'instances_seance', { ...base, deleted_at: 'x', id: 'i5', seance_id: 's1', date: '2026-10-30', is_completed: 0 })
  return db
}

describe('lireDetailSeance', () => {
  it('séance introuvable ou supprimée : null', async () => {
    const db = await monde()
    expect(await lireDetailSeance(db, 'nope')).toBeNull()
    await db.execute("UPDATE seances SET deleted_at = 'x' WHERE id = 's1'")
    expect(await lireDetailSeance(db, 's1')).toBeNull()
  })

  it('en-tête et statistiques : modèle uniquement (ni copie d\'instance ni ligne supprimée)', async () => {
    const d = (await lireDetailSeance(await monde(), 's1'))!
    expect(d).toMatchObject({ id: 's1', nom: 'Pull', notes: 'Tempo lent', dureeEstimeeMin: 55, archivee: false, directe: false })
    expect(d.muscles).toEqual(['Dos', 'Biceps'])
    expect(d.stats).toEqual({ exercices: 3, progression: 1, series: 10, dureeMin: 55 })
  })

  it('entrées entrelacées par position : exercice libre puis bloc ; exercices du bloc triés par position', async () => {
    const d = (await lireDetailSeance(await monde(), 's1'))!
    expect(d.entrees.map((e) => e.kind)).toEqual(['libre', 'bloc'])
    const [libre, bloc] = d.entrees
    if (libre.kind !== 'libre' || bloc.kind !== 'bloc') throw new Error('ordre inattendu')
    expect(libre.exercice).toMatchObject({
      nom: 'Tractions', equipement: 'Barre de traction', avertissement: 'Coudes serrés', progression: true, bilateral: false,
      series: '4 × 7', charge: 'PDC', repos: '2 min', systeme: 'Double progression', increment: '+ séries',
    })
    expect(bloc.bloc).toMatchObject({ nom: 'Superset bras', type: 'SUPERSET', libelleType: 'Superset', meta: 'inter 20 s · fin de round 1 min 30 s' })
    expect(bloc.bloc.exercices.map((e) => e.nom)).toEqual(['Rowing', 'Curl'])
    // Dans un superset, le repos propre à l'exercice est masqué (c'est celui du bloc qui compte)
    expect(bloc.bloc.exercices.every((e) => e.repos === null)).toBe(true)
    expect(bloc.bloc.exercices[0].supersetGroupe).toBe('A')
    expect(bloc.bloc.exercices[1]).toMatchObject({ bilateral: true, series: '3 × 12', charge: '10 kg' })
  })

  it("exercice absent du catalogue : nom de repli, jamais d'exception", async () => {
    const db = await monde()
    await db.execute("DELETE FROM exercises WHERE id = 'x3'")
    const d = (await lireDetailSeance(db, 's1'))!
    const bloc = d.entrees[1]
    if (bloc.kind !== 'bloc') throw new Error('bloc attendu')
    expect(bloc.bloc.exercices[0].nom).toBe('Exercice introuvable')
  })

  it('historique : programmées d\'abord (date croissante), puis terminées (plus récente d\'abord) ; supprimées exclues', async () => {
    const d = (await lireDetailSeance(await monde(), 's1'))!
    expect(d.instances.map((i) => [i.id, i.etat])).toEqual([
      ['i4', 'en_cours'], ['i2', 'planifiee'], ['i3', 'terminee'], ['i1', 'terminee'],
    ])
    expect(d.instances[0].lien).toBe('/strength/instance/i4')
    expect(d.instances[2].lien).toBe('/strength/instance/i3/report')
  })

  it('séance sans exercice : stats à zéro, aucune entrée', async () => {
    const db = createTestDb()
    await inserer(db, 'seances', { ...base, id: 'v', nom: 'Vide', seance_category: 'STRENGTH', created_at: 'c', is_archived: 1 })
    const d = (await lireDetailSeance(db, 'v'))!
    expect(d.entrees).toEqual([])
    expect(d.stats).toMatchObject({ exercices: 0, progression: 0, series: 0 })
    expect(d.archivee).toBe(true)
  })
})
