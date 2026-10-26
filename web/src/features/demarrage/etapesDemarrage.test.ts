import { describe, expect, it } from 'vitest'
import { etapesDemarrage, type DonneesDemarrage } from './etapesDemarrage'

const vide: DonneesDemarrage = { seances: 0, instances: 0, exercicesBase: 0, masque: false }

describe('etapesDemarrage', () => {
  it('base vide : la carte est visible, avec ses trois étapes dans l’ordre et aucune faite', () => {
    const e = etapesDemarrage(vide)
    expect(e.visible).toBe(true)
    expect(e.etapes.map((x) => x.id)).toEqual(['importer', 'catalogue', 'seance'])
    expect(e.etapes.map((x) => x.fait)).toEqual([false, false, false])
    expect(e.etapes.map((x) => x.lien)).toEqual(['/import', '/strength/catalog', '/strength/new'])
  })

  it('le catalogue de base installé coche l’étape 2', () => {
    expect(etapesDemarrage({ ...vide, exercicesBase: 120 }).etapes.map((x) => x.fait)).toEqual([false, true, false])
  })

  it('une séance jouée ou programmée coche l’import et la première séance : la carte disparaît', () => {
    const e = etapesDemarrage({ ...vide, instances: 1 })
    expect(e.etapes.map((x) => x.fait)).toEqual([true, false, true])
    expect(e.visible).toBe(false)
  })

  it('une séance type suffit : la carte disparaît', () => {
    expect(etapesDemarrage({ ...vide, seances: 1 }).visible).toBe(false)
  })

  it('masquée à la main : invisible même base vide', () => {
    expect(etapesDemarrage({ ...vide, masque: true }).visible).toBe(false)
  })

  it('chaque étape a un titre, une aide courte et un libellé de lien distincts', () => {
    const e = etapesDemarrage(vide)
    expect(new Set(e.etapes.map((x) => x.libelleLien)).size).toBe(3)
    for (const x of e.etapes) {
      expect(x.titre.length).toBeGreaterThan(5)
      expect(x.aide.length).toBeGreaterThan(10)
    }
  })
})
