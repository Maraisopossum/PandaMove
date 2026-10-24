import { describe, expect, it } from 'vitest'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'
import { listExercises } from './exercises'

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
