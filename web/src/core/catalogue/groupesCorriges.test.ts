import { describe, expect, it } from 'vitest'
import { groupesCorriges, type EntreeBase } from './groupesCorriges'

const BASE: EntreeBase = { musclePrimary: 'DOS', muscleGroups: ['DOS', 'BICEPS'] }

describe('groupesCorriges', () => {
  it('exercice du catalogue de base : applique le principal et les groupes du catalogue', () => {
    expect(groupesCorriges({ musclePrimary: '', muscleGroups: ['Grand dorsal'] }, BASE)).toEqual({
      musclePrimary: 'DOS', muscleGroups: ['DOS', 'BICEPS'],
    })
  })

  it('perso au muscle principal vide : dérivé du premier groupe', () => {
    expect(groupesCorriges({ musclePrimary: '', muscleGroups: ['QUADRICEPS', 'FESSIERS'] }, null)).toEqual({
      musclePrimary: 'QUADRICEPS', muscleGroups: ['QUADRICEPS', 'FESSIERS'],
    })
  })

  it('perso au muscle principal renseigné : jamais modifié', () => {
    expect(groupesCorriges({ musclePrimary: 'Biceps brachial', muscleGroups: ['DOS'] }, null).musclePrimary).toBe('Biceps brachial')
  })

  it('perso sans groupe : principal laissé vide', () => {
    expect(groupesCorriges({ musclePrimary: '', muscleGroups: [] }, null)).toEqual({ musclePrimary: '', muscleGroups: [] })
  })

  it('texte anatomique : groupes normalisés en codes, sans doublon', () => {
    expect(groupesCorriges({ musclePrimary: '', muscleGroups: ['Grand dorsal', 'Biceps brachial', 'Brachial'] }, null)).toEqual({
      musclePrimary: 'DOS', muscleGroups: ['DOS', 'BICEPS'],
    })
  })

  it('groupe inconnu : groupes laissés tels quels, principal dérivé tout de même', () => {
    const r = groupesCorriges({ musclePrimary: '', muscleGroups: ['Grand dorsal', 'Truc inconnu'] }, null)
    expect(r.muscleGroups).toEqual(['Grand dorsal', 'Truc inconnu'])
    expect(r.musclePrimary).toBe('DOS')
  })

  it('le code AUTRE explicite reste valide', () => {
    expect(groupesCorriges({ musclePrimary: '', muscleGroups: ['AUTRE'] }, null)).toEqual({ musclePrimary: 'AUTRE', muscleGroups: ['AUTRE'] })
  })
})
