import { describe, expect, it } from 'vitest'
import type { Exercise } from '../../../core/db/types'
import { FILTRE_INITIAL, filtrerExercices, musclesAffiches } from './filtreCatalogue'

const ex = (id: string, name: string, muscleGroups: string[], musclePrimary = ''): Exercise => ({
  id, name, category: 'OTHER', muscleGroups: JSON.stringify(muscleGroups), description: '', isFavorite: false,
  isCustom: true, imageUrl: null, exerciseType: '', equipment: '[]', musclePrimary, isBodyweight: false, updatedAt: 'u',
})

const LISTE = [
  ex('a', 'Tractions', ['Grand dorsal', 'Biceps brachial']),
  ex('b', 'Rowing', ['DOS']),
  ex('c', 'Curl', [], 'Biceps'),
  ex('d', 'Sans muscle', []),
]

const noms = (muscle: Parameters<typeof filtrerExercices>[1]['muscle']) =>
  filtrerExercices(LISTE, { ...FILTRE_INITIAL, muscle }).map((e) => e.name)

describe('filtrerExercices par muscle', () => {
  it('reconnaît les codes, les libellés et les noms anatomiques du catalogue Android', () => {
    expect(noms('DOS')).toEqual(['Rowing', 'Tractions'])
    expect(noms('BICEPS')).toEqual(['Curl', 'Tractions'])
  })

  it("un exercice sans muscle n'est pas rangé dans « Autre »", () => {
    expect(noms('AUTRE')).toEqual([])
  })
})

describe('musclesAffiches', () => {
  const m = (musclePrimary: string, groupes: string[]) => musclesAffiches({ musclePrimary, muscleGroups: JSON.stringify(groupes) })

  it('libellés français : principal puis secondaires', () => {
    expect(m('PECTORAUX', ['PECTORAUX', 'TRICEPS', 'EPAULES'])).toEqual({ principal: 'Pectoraux', secondaires: ['Triceps', 'Épaules'] })
  })
  it('noms anatomiques rangés dans leur groupe, sans doublon', () => {
    expect(m('', ['Grand dorsal', 'Biceps brachial', 'Brachial'])).toEqual({ principal: 'Dos', secondaires: ['Biceps'] })
  })
  it('sans groupe : muscle_primary ; sans rien : aucun principal', () => {
    expect(m('ISCHIO', [])).toEqual({ principal: 'Ischio-jambiers', secondaires: [] })
    expect(m('', [])).toEqual({ principal: null, secondaires: [] })
  })
})
