import { describe, expect, it } from 'vitest'
import { ratioContraste } from '../../app/contraste'
import { MUSCLE_GROUPS } from '../db/types'
import { COULEURS_GROUPE, melangerSurSurface } from './couleursGroupes'

describe('couleurs des groupes musculaires (MuscleGroup.colorArgb Android)', () => {
  it('chaque groupe a sa couleur hexadécimale', () => {
    expect(Object.keys(COULEURS_GROUPE).sort()).toEqual([...MUSCLE_GROUPS].sort())
    for (const hex of Object.values(COULEURS_GROUPE)) expect(hex).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('reprend les valeurs de l’Android', () => {
    expect(COULEURS_GROUPE.PECTORAUX).toBe('#e57373')
    expect(COULEURS_GROUPE.QUADRICEPS).toBe('#ffd54f')
    expect(COULEURS_GROUPE.AUTRE).toBe('#90a4ae')
  })

  it('les couleurs sont distinctes', () => {
    expect(new Set(Object.values(COULEURS_GROUPE)).size).toBe(MUSCLE_GROUPS.length)
  })
})

// Puce sélectionnée : teinte du groupe à 22 % sur la surface, texte du thème (jamais la couleur du groupe en texte,
// qui échouerait à 4,5:1 pour les teintes claires comme le jaune des quadriceps).
describe('contraste AA des puces de groupe sélectionnées', () => {
  const THEMES = {
    clair: { surface: '#ffffff', texte: '#1e1e22' },
    sombre: { surface: '#1e1e22', texte: '#f2f2f5' },
  }
  for (const [nom, t] of Object.entries(THEMES)) {
    for (const groupe of MUSCLE_GROUPS) {
      it(`${nom} : ${groupe}`, () => {
        const fond = melangerSurSurface(COULEURS_GROUPE[groupe], t.surface, 0.22)
        expect(ratioContraste(t.texte, fond)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  it('la couleur du groupe en texte échouerait (c’est pourquoi elle n’est qu’un repère)', () => {
    expect(ratioContraste(COULEURS_GROUPE.QUADRICEPS, '#ffffff')).toBeLessThan(4.5)
  })
})
