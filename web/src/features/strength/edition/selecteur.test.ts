import { describe, expect, it } from 'vitest'
import type { Exercise } from '../../../core/db/types'
import { basculerSelection, exerciceDisponible, FILTRE_SELECTEUR_INITIAL, filtrerSelecteur } from './selecteur'

const exo = (id: string, name: string, extra: Partial<Exercise> = {}): Exercise => ({
  id, name, category: 'OTHER', muscleGroups: '[]', description: '', isFavorite: false, isCustom: false, imageUrl: null,
  exerciseType: '', equipment: '[]', musclePrimary: '', isBodyweight: false, updatedAt: 'u', ...extra,
})

const catalogue = [
  exo('dc', 'Développé couché', { musclePrimary: 'PECTORAUX', equipment: '["Barre","Banc plat"]' }),
  exo('ec', 'Écarté poulie', { musclePrimary: 'PECTORAUX', equipment: '["Câble"]' }),
  exo('tr', 'Tractions', { musclePrimary: 'DOS', equipment: '["Barre de traction"]' }),
  exo('pompes', 'Pompes', { musclePrimary: 'PECTORAUX', equipment: '["Poids de corps / Tapis"]' }),
  exo('libre', 'Étirement', { musclePrimary: 'DOS', equipment: '[]' }),
  exo('curl', 'Curl haltères', { musclePrimary: 'BICEPS', equipment: '["Haltères"]' }),
]

describe('exerciceDisponible (« Mon matériel »)', () => {
  it('sans équipement requis ou au poids de corps seul : toujours disponible', () => {
    expect(exerciceDisponible('[]', [])).toBe(true)
    expect(exerciceDisponible('["Poids de corps / Tapis"]', [])).toBe(true)
  })

  it('toutes les catégories requises doivent être possédées', () => {
    expect(exerciceDisponible('["Barre","Banc plat"]', ['BARRE', 'BANC'])).toBe(true)
    expect(exerciceDisponible('["Barre","Banc plat"]', ['BARRE'])).toBe(false)
    expect(exerciceDisponible('["Haltères"]', ['BARRE'])).toBe(false)
  })

  it('équipement illisible : traité comme absent', () => {
    expect(exerciceDisponible('pas du json', [])).toBe(true)
  })
})

describe('filtrerSelecteur', () => {
  it('sans filtre : tout, trié par nom sans tenir compte des accents', () => {
    expect(filtrerSelecteur(catalogue, FILTRE_SELECTEUR_INITIAL, []).map((e) => e.id)).toEqual(['curl', 'dc', 'ec', 'libre', 'pompes', 'tr'])
  })

  it('recherche sans accents ni casse', () => {
    expect(filtrerSelecteur(catalogue, { ...FILTRE_SELECTEUR_INITIAL, query: 'DEVELOPPE' }, []).map((e) => e.id)).toEqual(['dc'])
  })

  it('filtre par groupe musculaire', () => {
    expect(filtrerSelecteur(catalogue, { ...FILTRE_SELECTEUR_INITIAL, groupe: 'PECTORAUX' }, []).map((e) => e.id)).toEqual(['dc', 'ec', 'pompes'])
  })

  it('« Mon matériel » : exercices réalisables avec les catégories possédées', () => {
    const filtre = { ...FILTRE_SELECTEUR_INITIAL, seulementDisponible: true }
    expect(filtrerSelecteur(catalogue, filtre, ['BARRE', 'BANC']).map((e) => e.id)).toEqual(['dc', 'libre', 'pompes'])
    expect(filtrerSelecteur(catalogue, filtre, []).map((e) => e.id)).toEqual(['libre', 'pompes'])
  })

  it('les filtres se combinent', () => {
    const filtre = { query: 'e', groupe: 'PECTORAUX' as const, seulementDisponible: true }
    expect(filtrerSelecteur(catalogue, filtre, ['BARRE', 'BANC']).map((e) => e.id)).toEqual(['dc', 'pompes'])
  })
})

describe('basculerSelection', () => {
  it('conserve l’ordre dans lequel les exercices ont été cochés (piège connu : pas d’ordre alphabétique)', () => {
    let s: string[] = []
    for (const id of ['tr', 'dc', 'curl']) s = basculerSelection(s, id)
    expect(s).toEqual(['tr', 'dc', 'curl'])
  })

  it('décocher retire sans bouger les autres, recocher remet en fin', () => {
    expect(basculerSelection(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
    expect(basculerSelection(['a', 'c'], 'b')).toEqual(['a', 'c', 'b'])
  })

  it('ne modifie pas son entrée', () => {
    const s = ['a']
    basculerSelection(s, 'b')
    expect(s).toEqual(['a'])
  })
})
