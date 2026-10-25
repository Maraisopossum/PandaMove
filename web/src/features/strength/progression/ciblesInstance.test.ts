import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../../../core/db/Db'
import { saveObjectif } from '../../../core/db/repos/objectifs'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'
import { libelleChargeCible, rafraichirCiblesProgression } from './ciblesInstance'

const base = { user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null }

let db: Db
beforeEach(async () => {
  db = createTestDb()
  await inserer(db, 'seances', { ...base, id: 's1', nom: 'Haut', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
  await inserer(db, 'exercises', { ...base, id: 'x1', name: 'Développé' })
  await inserer(db, 'exercises', { ...base, id: 'x2', name: 'Tractions' })
  await inserer(db, 'exercises', { ...base, id: 'x3', name: 'Gainage' })
  await inserer(db, 'instances_seance', {
    ...base, id: 'i1', seance_id: 's1', date: '2026-10-24', notes: '', is_completed: 0, completed_at: null, duration_seconds: 0, created_at: 'c',
  })
  const ligne = (id: string, exo: string, extra: Record<string, unknown>) =>
    inserer(db, 'exercices_seance', {
      ...base, id, seance_id: 's1', exercise_id: exo, position: 0, nombre_series_prevues: 3, reps_cibles: '8', charge_cible: '60 kg',
      reps_type: 'REPS', instance_seance_id: 'i1', progression_activee: 1, ...extra,
    })
  await ligne('e1', 'x1', {})
  await ligne('e2', 'x2', { charge_cible: 'PDC', is_bodyweight: 1 })
  await ligne('e3', 'x3', { reps_type: 'DURATION', reps_cibles: '30', charge_cible: 'PDC' })
  await ligne('e4', 'x1', { progression_activee: 0, charge_cible: '20 kg' })
})

const lire = (id: string) => db.get<{ charge_cible: string; reps_cibles: string }>('SELECT charge_cible, reps_cibles FROM exercices_seance WHERE id = ?', [id])
const objectif = (exerciseId: string, extra: Partial<Parameters<typeof saveObjectif>[1]>) =>
  saveObjectif(db, {
    seanceId: 's1', exerciseId, chargeCible: null, repsCible: null, dureeCibleSec: null, compteurEchec: 0, derniereMaj: '2026-10-20',
    nombreSeriesCible: null, ...extra,
  })

describe('libelleChargeCible', () => {
  it('entier sans décimale, décimale au point (relue par parseChargeKg), rien pour une charge absente', () => {
    expect(libelleChargeCible(62.5, false)).toBe('62.5 kg')
    expect(libelleChargeCible(65, false)).toBe('65 kg')
    expect(libelleChargeCible(null, false)).toBeNull()
  })

  it('poids de corps à 0 : le libellé « PDC » du modèle est gardé', () => {
    expect(libelleChargeCible(0, true)).toBeNull()
    expect(libelleChargeCible(5, true)).toBe('5 kg')
  })
})

describe('rafraichirCiblesProgression (rafraichirCiblesProgression Android)', () => {
  it('reporte la charge et les reps de l’objectif sur la ligne de l’instance', async () => {
    await objectif('x1', { chargeCible: 62.5, repsCible: 9 })
    expect(await rafraichirCiblesProgression(db, 'i1')).toBe(1)
    expect(await lire('e1')).toEqual({ charge_cible: '62.5 kg', reps_cibles: '9' })
  })

  it('exercice en durée : la durée cible remplace les reps cibles', async () => {
    await objectif('x3', { dureeCibleSec: 40 })
    await rafraichirCiblesProgression(db, 'i1')
    expect(await lire('e3')).toEqual({ charge_cible: 'PDC', reps_cibles: '40' })
  })

  it('poids de corps à 0 kg : « PDC » conservé', async () => {
    await objectif('x2', { chargeCible: 0, repsCible: 12 })
    await rafraichirCiblesProgression(db, 'i1')
    expect(await lire('e2')).toEqual({ charge_cible: 'PDC', reps_cibles: '12' })
  })

  it('exercice sans progression ou sans objectif : intact', async () => {
    await objectif('x1', { chargeCible: 62.5, repsCible: 9 })
    await rafraichirCiblesProgression(db, 'i1')
    expect(await lire('e4')).toEqual({ charge_cible: '20 kg', reps_cibles: '8' })
    expect(await lire('e3')).toEqual({ charge_cible: 'PDC', reps_cibles: '30' })
  })

  it('ne réécrit rien si la cible est déjà à jour (aucun updated_at inutile)', async () => {
    await objectif('x1', { chargeCible: 60, repsCible: 8 })
    expect(await rafraichirCiblesProgression(db, 'i1')).toBe(0)
  })

  it('une instance terminée n’est jamais retouchée (rapport figé)', async () => {
    await db.execute("UPDATE instances_seance SET is_completed = 1 WHERE id = 'i1'")
    await objectif('x1', { chargeCible: 62.5, repsCible: 9 })
    expect(await rafraichirCiblesProgression(db, 'i1')).toBe(0)
    expect(await lire('e1')).toEqual({ charge_cible: '60 kg', reps_cibles: '8' })
  })

  it('ne touche jamais les lignes du modèle', async () => {
    await inserer(db, 'exercices_seance', {
      ...base, id: 'modele', seance_id: 's1', exercise_id: 'x1', position: 0, nombre_series_prevues: 3, reps_cibles: '8', charge_cible: '60 kg',
      reps_type: 'REPS', instance_seance_id: null, progression_activee: 1,
    })
    await objectif('x1', { chargeCible: 62.5, repsCible: 9 })
    await rafraichirCiblesProgression(db, 'i1')
    expect(await lire('modele')).toEqual({ charge_cible: '60 kg', reps_cibles: '8' })
  })
})
