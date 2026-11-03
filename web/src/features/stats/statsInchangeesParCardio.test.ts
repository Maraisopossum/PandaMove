import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../../core/db/Db'
import { creer, definirValidation } from '../../core/db/repos/seancesCardio'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import { historiqueExercice, resumePeriode, tonnagePeriode, volumeParMuscle } from './statsQueries'

const b = { user_id: 'u1', updated_at: '2026-01-01T00:00:00Z', deleted_at: null }
const DU = '2026-01-01'
const AU = '2027-12-31'

let db: Db
beforeEach(async () => {
  db = createTestDb()
  await inserer(db, 'seances', { ...b, id: 's1', nom: 'Haut', is_archived: 0, created_at: 'c' })
  await inserer(db, 'exercises', {
    ...b, id: 'ex-dc', name: 'Développé couché', category: 'OTHER', muscle_groups: JSON.stringify(['PECTORAUX']),
    muscle_primary: 'PECTORAUX', is_favorite: 0, is_custom: 1, is_bodyweight: 0,
  })
  await inserer(db, 'instances_seance', {
    ...b, id: 'i1', seance_id: 's1', date: '2026-11-03', is_completed: 1, duration_seconds: 3000, completed_at: '2026-11-03T19:00:00Z',
  })
  await inserer(db, 'exercices_seance', {
    ...b, id: 'es1', seance_id: 's1', exercise_id: 'ex-dc', instance_seance_id: 'i1', position: 0, reps_type: 'REPS',
  })
  await inserer(db, 'series_realisees', {
    ...b, id: 'sr-1', instance_seance_id: 'i1', exercice_seance_id: 'es1', numero_serie: 1, reps_realisees: 10, charge_kg: 60,
    is_completed: 1, notes: '',
  })
})

// Tout ce que l'écran des statistiques et l'accueil lisent
const releve = async () => ({
  resume: await resumePeriode(db, DU, AU),
  tonnage: await tonnagePeriode(db, DU, AU),
  muscles: await volumeParMuscle(db, DU, AU),
  historique: await historiqueExercice(db, 'ex-dc'),
})

describe('les séances de cardio ne changent aucune statistique', () => {
  it('le relevé de départ contient de vraies valeurs (le test compare autre chose que du vide)', async () => {
    const avant = await releve()
    expect(avant.tonnage).toBe(600)
    expect(avant.resume.seancesTerminees).toBe(1)
    expect(avant.resume.seriesTotal).toBe(1)
  })

  it('créer puis valider du cardio laisse tonnage, séries, heatmap, historique et compteur identiques', async () => {
    const avant = await releve()
    for (const genre of ['course', 'velo'] as const) {
      const id = await creer(db, genre, { date: '2026-11-03', titre: 'Séance cardio', detail: '45 min · Z2', jalon: 'Jalon' })
      expect(await releve()).toEqual(avant)
      await definirValidation(db, genre, id, true)
      expect(await releve()).toEqual(avant)
    }
  })
})
