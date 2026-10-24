import { describe, expect, it } from 'vitest'
import {
  ajouterJours, construireGrille, formaterJourLong, formaterMois, isoDepuisParties, moisPrecedent, moisSuivant,
} from './grille'

describe('isoDepuisParties / ajouterJours', () => {
  it('formate avec zéros de tête', () => {
    expect(isoDepuisParties(2026, 3, 5)).toBe('2026-03-05')
  })
  it("traverse fins de mois et d'année sans décalage", () => {
    expect(ajouterJours('2026-10-31', 1)).toBe('2026-11-01')
    expect(ajouterJours('2026-12-31', 1)).toBe('2027-01-01')
    expect(ajouterJours('2026-03-01', -1)).toBe('2026-02-28')
    expect(ajouterJours('2028-03-01', -1)).toBe('2028-02-29')
    // changement d'heure (29 mars 2026) : toujours un jour calendaire
    expect(ajouterJours('2026-03-28', 1)).toBe('2026-03-29')
    expect(ajouterJours('2026-03-29', 1)).toBe('2026-03-30')
  })
})

describe('moisSuivant / moisPrecedent', () => {
  it("passe d'une année à l'autre", () => {
    expect(moisSuivant({ year: 2026, month: 12 })).toEqual({ year: 2027, month: 1 })
    expect(moisPrecedent({ year: 2026, month: 1 })).toEqual({ year: 2025, month: 12 })
    expect(moisSuivant({ year: 2026, month: 5 })).toEqual({ year: 2026, month: 6 })
  })
})

describe('construireGrille', () => {
  it('octobre 2026 (1er = jeudi) : commence le lundi 28 septembre, 5 semaines', () => {
    const g = construireGrille({ year: 2026, month: 10 }, '2026-10-24')
    expect(g).toHaveLength(35)
    expect(g[0]).toMatchObject({ dateIso: '2026-09-28', jourDuMois: 28, dansLeMois: false })
    expect(g[3]).toMatchObject({ dateIso: '2026-10-01', dansLeMois: true })
    expect(g[34]).toMatchObject({ dateIso: '2026-11-01', dansLeMois: false })
    expect(g.filter((j) => j.dansLeMois)).toHaveLength(31)
    expect(g.filter((j) => j.estAujourdhui).map((j) => j.dateIso)).toEqual(['2026-10-24'])
    expect(g.every((j) => j.instances.length === 0)).toBe(true)
  })

  it('février 2026 (non bissextile) commençant un dimanche : 28 jours dans le mois, 5 semaines', () => {
    const g = construireGrille({ year: 2026, month: 2 }, '2026-10-24')
    expect(g[0]).toMatchObject({ dateIso: '2026-01-26', dansLeMois: false })
    expect(g[6]).toMatchObject({ dateIso: '2026-02-01', dansLeMois: true })
    expect(g.filter((j) => j.dansLeMois)).toHaveLength(28)
    expect(g).toHaveLength(35)
    expect(g[34]).toMatchObject({ dateIso: '2026-03-01', dansLeMois: false })
  })

  it('février 2027 commençant un lundi : exactement 4 semaines', () => {
    const g = construireGrille({ year: 2027, month: 2 }, '2026-10-24')
    expect(g).toHaveLength(28)
    expect(g[0]).toMatchObject({ dateIso: '2027-02-01', dansLeMois: true })
    expect(g[27]).toMatchObject({ dateIso: '2027-02-28', dansLeMois: true })
  })

  it('février 2028 (bissextile) : 29 jours dans le mois', () => {
    const g = construireGrille({ year: 2028, month: 2 }, '2026-10-24')
    expect(g.filter((j) => j.dansLeMois)).toHaveLength(29)
    expect(g.some((j) => j.dateIso === '2028-02-29' && j.dansLeMois)).toBe(true)
    expect(g.length % 7).toBe(0)
  })

  it('mois finissant un dimanche : pas de jours de fin ; mois finissant un lundi : 6 jours de fin', () => {
    const fin = construireGrille({ year: 2026, month: 5 }, '2026-10-24') // 31 mai 2026 = dimanche
    expect(fin[fin.length - 1]).toMatchObject({ dateIso: '2026-05-31', dansLeMois: true })
    const g = construireGrille({ year: 2026, month: 8 }, '2026-10-24') // 31 août 2026 = lundi
    expect(g[g.length - 1]).toMatchObject({ dateIso: '2026-09-06', dansLeMois: false })
  })

  it("toutes les semaines sont complètes et commencent un lundi, y compris autour du changement d'heure", () => {
    for (let mois = 1; mois <= 12; mois++) {
      const g = construireGrille({ year: 2026, month: mois }, '2026-01-01')
      expect(g.length % 7).toBe(0)
      const [a, m, j] = g[0].dateIso.split('-').map(Number)
      expect(new Date(a, m - 1, j).getDay()).toBe(1)
      g.forEach((jour, i) => expect(jour.dateIso).toBe(ajouterJours(g[0].dateIso, i)))
    }
  })
})

describe('formats français', () => {
  it('formaterMois', () => {
    expect(formaterMois({ year: 2026, month: 10 })).toBe('octobre 2026')
    expect(formaterMois({ year: 2026, month: 2 })).toBe('février 2026')
  })
  it('formaterJourLong', () => {
    expect(formaterJourLong('2026-10-05')).toBe('lundi 5 octobre 2026')
    expect(formaterJourLong('2026-11-01')).toBe('dimanche 1 novembre 2026')
  })
})
