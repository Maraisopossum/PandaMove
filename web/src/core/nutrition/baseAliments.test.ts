import { describe, expect, it } from 'vitest'
import { BASE_ALIMENTS } from './baseAliments'
import { mesureParDefaut, mesuresDisponibles, verifierMesures } from './mesures'

describe('mesures des aliments courants', () => {
  it('chaque aliment a des mesures valides, ou est un liquide (mesures communes)', () => {
    for (const a of BASE_ALIMENTS) {
      expect(verifierMesures(a.mesures), a.id).toBeNull()
      expect(a.mesures.length > 0 || a.uniteBase === 'ml', a.id).toBe(true)
    }
  })

  it('les boissons et les laits sont en ml, le reste en grammes', () => {
    for (const a of BASE_ALIMENTS) {
      const liquide = a.categorie === 'boissons' || a.id === 'base-lait' || a.id === 'base-lait-soja'
      expect(a.uniteBase, a.id).toBe(liquide ? 'ml' : 'g')
    }
  })

  it('l’œuf se compte à la pièce, le lait au verre, le riz à l’assiette', () => {
    const trouver = (id: string) => BASE_ALIMENTS.find((a) => a.id === id)!
    expect(mesureParDefaut(trouver('base-oeuf'))).toMatchObject({ id: 'oeuf', libelle: 'œuf', base: 60 })
    expect(mesureParDefaut(trouver('base-lait'))).toMatchObject({ id: 'verre', base: 200 })
    expect(mesureParDefaut(trouver('base-riz-blanc'))).toMatchObject({ id: 'assiette', base: 150 })
    expect(mesuresDisponibles(trouver('base-riz-blanc')).map((m) => m.id)).toEqual(['assiette', 'c-a-soupe', 'g'])
  })
})
