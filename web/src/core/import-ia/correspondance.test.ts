import { describe, expect, it } from 'vitest'
import { distanceEdition, trouverExercice } from './correspondance'

const cat = [
  { id: '1', name: 'Développé couché haltères' },
  { id: '2', name: 'Squat barre' },
  { id: '3', name: 'Tractions' },
  { id: '4', name: 'Rowing barre' },
  { id: '5', name: 'Curl biceps haltères' },
  { id: '6', name: 'Curl biceps barre' },
]

describe('trouverExercice', () => {
  it('égalité après accents / casse / espaces', () => {
    const r = trouverExercice('  developpe COUCHE   halteres ', cat)
    expect(r).toMatchObject({ type: 'exact', exercice: { id: '1' } })
  })

  it('alias : pluriel, parenthèses ignorées ou dépliées, ponctuation', () => {
    expect(trouverExercice('Traction', cat)).toMatchObject({ type: 'alias', exercice: { id: '3' } })
    expect(trouverExercice('Squat barres', cat)).toMatchObject({ type: 'alias', exercice: { id: '2' } })
    expect(trouverExercice('Rowing barre (prise pronation)', cat)).toMatchObject({ type: 'alias', exercice: { id: '4' } })
    expect(trouverExercice('Squat (barre)', cat)).toMatchObject({ type: 'alias', exercice: { id: '2' } })
    expect(trouverExercice('Développé-couché haltère', cat)).toMatchObject({ type: 'alias', exercice: { id: '1' } })
  })

  it('un alias ambigu n\'est jamais choisi', () => {
    const r = trouverExercice('Curl biceps', cat)
    expect(r.type).toBe('inconnu')
  })

  it('inconnu : propose le nom le plus proche seulement à 2 éditions ou moins, sans substituer', () => {
    // 1 édition : une suggestion, jamais une substitution
    expect(trouverExercice('Squat barr', cat)).toEqual({ type: 'inconnu', proche: { id: '2', name: 'Squat barre', distance: 1 } })
  })

  it('suggestion à petite distance', () => {
    const r = trouverExercice('Tracsions', cat)
    expect(r).toEqual({ type: 'inconnu', proche: { id: '3', name: 'Tractions', distance: 1 } })
    expect(trouverExercice('Burpees', cat)).toEqual({ type: 'inconnu', proche: null })
  })
})

describe('distanceEdition', () => {
  it('Levenshtein', () => {
    expect(distanceEdition('chat', 'chats')).toBe(1)
    expect(distanceEdition('abc', 'xyz')).toBe(3)
    expect(distanceEdition('', 'ab')).toBe(2)
  })
})
