import { describe, expect, it } from 'vitest'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'
import { creerExercice, listExercises } from './exercises'

describe('listExercises', () => {
  it('liste par nom, sans les supprimés, avec de vrais booléens', async () => {
    const db = createTestDb()
    const base = { user_id: 'u', updated_at: 'u', deleted_at: null }
    await inserer(db, 'exercises', { ...base, id: 'b', name: 'Squat', is_favorite: 1, is_custom: 0, is_bodyweight: 0, image_url: null })
    await inserer(db, 'exercises', { ...base, id: 'a', name: 'Dips', is_favorite: 0, is_custom: 1, is_bodyweight: 1, image_url: null })
    await inserer(db, 'exercises', { ...base, id: 'c', name: 'Curl', deleted_at: 'x' })
    const liste = await listExercises(db)
    expect(liste.map((e) => e.name)).toEqual(['Dips', 'Squat'])
    expect(liste[0]).toMatchObject({ isCustom: true, isBodyweight: true, isFavorite: false, imageUrl: null })
  })
})

describe('creerExercice — muscle principal', () => {
  it('dérive le muscle principal vide du premier groupe, sans toucher un principal renseigné', async () => {
    const db = createTestDb()
    const a = await creerExercice(db, 'u', { name: 'Perso A', muscleGroups: ['DOS', 'BICEPS'] })
    const b = await creerExercice(db, 'u', { name: 'Perso B', muscleGroups: ['DOS'], musclePrimary: 'BICEPS' })
    const lire = (id: string) => db.get<{ muscle_primary: string }>('SELECT muscle_primary FROM exercises WHERE id = ?', [id])
    expect((await lire(a)).muscle_primary).toBe('DOS')
    expect((await lire(b)).muscle_primary).toBe('BICEPS')
  })
})
