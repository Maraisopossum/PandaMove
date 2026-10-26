import { describe, expect, it } from 'vitest'
import type { Db } from '../../../core/db/Db'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'
import type { Exercise } from '../../../core/db/types'
import { insererBlocAuDebut } from '../draft'
import { brouillonVide, ajouterExercice, nouvelExercice } from '../draft'
import { construireBlocEchauffement, listerEchauffements } from './echauffement'

const seance = (db: Db, id: string, nom: string, categorie: string, extra: Record<string, unknown> = {}) =>
  inserer(db, 'seances', {
    id, user_id: 'u', updated_at: 'u', deleted_at: null, nom, groupes_musculaires: '[]', duree_estimee_min: 10, notes: `notes ${nom}`,
    seance_category: categorie, created_at: 'c', is_archived: 0, ...extra,
  })
const ligne = (db: Db, id: string, seanceId: string, exoId: string, position: number, extra: Record<string, unknown> = {}) =>
  inserer(db, 'exercices_seance', {
    id, user_id: 'u', updated_at: 'u', deleted_at: null, seance_id: seanceId, exercise_id: exoId, bloc_id: null, position,
    nombre_series_prevues: 2, reps_cibles: '15', charge_cible: '5 kg', reps_type: 'REPS', temps_repos_sec: 30,
    instance_seance_id: null, progression_activee: 1, increment_duree_sec: 5, seuil_deload: 3, ...extra,
  })
const exo = (id: string, name: string): Exercise => ({
  id, name, category: 'OTHER', muscleGroups: '["DOS"]', description: '', isFavorite: false, isCustom: false, imageUrl: null,
  exerciseType: '', equipment: '["Élastique"]', musclePrimary: 'DOS', isBodyweight: false, updatedAt: 'u',
})

async function base() {
  const db = createTestDb()
  await seance(db, 'force', 'Pull', 'STRENGTH')
  await seance(db, 'w1', 'Échauffement dos', 'WARMUP_GENERAL')
  await seance(db, 'w2', 'Mobilité hanches', 'WARMUP_MOBILITY')
  await seance(db, 'w3', 'Ancien échauffement', 'WARMUP_GENERAL', { is_archived: 1 })
  await seance(db, 'w4', 'Supprimé', 'WARMUP_GENERAL', { deleted_at: 'd' })
  await ligne(db, 'a', 'w1', 'band', 1)
  await ligne(db, 'b', 'w1', 'rot', 0, { reps_type: 'DURATION', reps_cibles: '30', charge_cible: '' })
  await ligne(db, 'c', 'w1', 'disparu', 2)
  await ligne(db, 'i', 'w1', 'band', 3, { instance_seance_id: 'inst' })
  return db
}

describe('modèles d’échauffement (séances d’une autre catégorie que le renforcement)', () => {
  it('liste les modèles non archivés et non supprimés, hors renforcement', async () => {
    const liste = await listerEchauffements(await base())
    expect(liste.map((m) => m.nom).sort()).toEqual(['Mobilité hanches', 'Échauffement dos'])
    expect(liste.find((m) => m.id === 'w1')).toMatchObject({ notes: 'notes Échauffement dos' })
  })

  it('construit un bloc Échauffement nommé comme le modèle, exercices dans l’ordre des positions', async () => {
    const catalogue = [exo('band', 'Élastique tirage'), exo('rot', 'Rotations')]
    let n = 0
    const bloc = await construireBlocEchauffement(await base(), 'w1', catalogue, () => `id${++n}`)
    expect(bloc).toMatchObject({ type: 'ECHAUFFEMENT', nom: 'Échauffement dos' })
    // « disparu » n'est pas au catalogue : ignoré ; la ligne d'instance n'est jamais copiée
    expect(bloc!.exercices.map((e) => [e.exerciseNom, e.repsType, e.repsCibles, e.nombreSeriesPrevues, e.tempsReposSec, e.chargeCible])).toEqual([
      ['Rotations', 'DURATION', '30', 2, 30, ''],
      ['Élastique tirage', 'REPS', '15', 2, 30, '5 kg'],
    ])
    // Ids neufs, et seuls les réglages de base sont repris (pas de surcharge progressive)
    expect(bloc!.exercices.every((e) => e.id.startsWith('id') && !e.progressionActivee)).toBe(true)
    expect(bloc!.id).toBe('id3')
  })

  it('modèle inconnu : null', async () => {
    expect(await construireBlocEchauffement(await base(), 'nope', [], () => 'x')).toBeNull()
  })
})

describe('insererBlocAuDebut', () => {
  it('place le bloc en tête de la liste et renumérote', () => {
    let d = brouillonVide('s')
    d = ajouterExercice(d, null, nouvelExercice('e', { id: 'x', name: 'X', muscles: [], equipment: [], isBodyweight: false }, null))
    const r = insererBlocAuDebut(d, { id: 'w', nom: 'Échauffement', type: 'ECHAUFFEMENT', position: 0, dureeMin: null, description: '', tempsReposInterSec: 20, tempsReposFinRoundSec: 120, nombreSeriesPrevues: 3, exercices: [] })
    expect(r.items.map((i) => (i.kind === 'bloc' ? i.bloc.id : i.exercice.id))).toEqual(['w', 'e'])
    expect(r.items[1].kind === 'libre' && r.items[1].exercice.position).toBe(1)
  })
})
