import { describe, expect, it } from 'vitest'
import { normalizeSearch } from '../common/normalizeSearch'
import { MUSCLE_GROUPS } from '../db/types'
import { catalogueDeBase, ExerciceDeBaseSchema } from './catalogueDeBase'

const CATEGORIES = ['CHEST', 'BACK', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'LEGS', 'GLUTES', 'CORE', 'CARDIO', 'FULL_BODY', 'OTHER']

describe('catalogueDeBase', () => {
  const liste = catalogueDeBase()

  it('contient les 166 exercices du catalogue Android, accents intacts', () => {
    expect(liste).toHaveLength(166)
    expect(liste.map((e) => e.name)).toContain('Développé couché barre')
  })

  it('a des noms uniques après normalisation', () => {
    expect(new Set(liste.map((e) => normalizeSearch(e.name))).size).toBe(166)
  })

  it('utilise uniquement des codes MuscleGroup, le principal en tête des groupes', () => {
    for (const e of liste) {
      expect(MUSCLE_GROUPS).toContain(e.musclePrimary)
      expect(e.muscleGroups.length).toBeGreaterThan(0)
      expect(e.muscleGroups[0]).toBe(e.musclePrimary)
      for (const g of e.muscleGroups) expect(MUSCLE_GROUPS).toContain(g)
    }
  })

  it('utilise des catégories et des types connus du web', () => {
    for (const e of liste) {
      expect(CATEGORIES).toContain(e.category)
      expect(['Pluri', 'Mono']).toContain(e.exerciseType)
    }
  })

  it('le schéma refuse un groupe inconnu ou un principal absent des groupes', () => {
    const base = { name: 'X', category: 'CHEST', musclePrimary: 'PECTORAUX', muscleGroups: ['PECTORAUX'], description: '', equipment: [], exerciseType: 'Pluri', isBodyweight: false }
    expect(ExerciceDeBaseSchema.safeParse(base).success).toBe(true)
    expect(ExerciceDeBaseSchema.safeParse({ ...base, muscleGroups: ['PECTORAUX', 'Grand dorsal'] }).success).toBe(false)
    expect(ExerciceDeBaseSchema.safeParse({ ...base, musclePrimary: 'DOS' }).success).toBe(false)
  })
})
