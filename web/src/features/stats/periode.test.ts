// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CLE_PERIODE, PERIODES, PERIODE_DEFAUT, bornesPeriode, ecrirePeriode, lirePeriode } from './periode'

const jour = (y: number, m: number, d: number) => new Date(y, m - 1, d, 23, 30)

describe('bornesPeriode', () => {
  it('reproduit les reculs Android (minusWeeks/minusMonths/minusYears), bornes incluses', () => {
    expect(bornesPeriode('7j', jour(2026, 10, 24))).toEqual({ from: '2026-10-17', to: '2026-10-24' })
    expect(bornesPeriode('30j', jour(2026, 10, 24))).toEqual({ from: '2026-09-24', to: '2026-10-24' })
    expect(bornesPeriode('3m', jour(2026, 1, 15))).toEqual({ from: '2025-10-15', to: '2026-01-15' })
    expect(bornesPeriode('12m', jour(2026, 10, 24))).toEqual({ from: '2025-10-24', to: '2026-10-24' })
  })

  it('ramène le jour au dernier jour du mois cible (31 -> 30, 29 février -> 28)', () => {
    expect(bornesPeriode('30j', jour(2026, 10, 31)).from).toBe('2026-09-30')
    expect(bornesPeriode('3m', jour(2026, 5, 31)).from).toBe('2026-02-28')
    expect(bornesPeriode('12m', jour(2024, 2, 29)).from).toBe('2023-02-28')
  })

  it('« Tout » couvre toutes les dates', () => {
    expect(bornesPeriode('tout', jour(2026, 10, 24))).toEqual({ from: '0001-01-01', to: '9999-12-31' })
  })

  it('utilise la date locale (pas UTC) près de minuit', () => {
    expect(bornesPeriode('7j', new Date(2026, 0, 1, 0, 5)).to).toBe('2026-01-01')
  })
})

describe('persistance de la période', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('défaut « 30 jours » comme Android (StatsPeriod.MONTH)', () => {
    expect(PERIODE_DEFAUT).toBe('30j')
    expect(lirePeriode()).toBe('30j')
    expect(PERIODES.map((p) => p.id)).toEqual(['7j', '30j', '3m', '12m', 'tout'])
    // Le libellé dit ce que fait le calcul (recul d'un mois calendaire, minusMonths(1) Android)
    expect(PERIODES.find((p) => p.id === '30j')?.libelle).toBe('1 mois')
  })

  it('écrit puis relit la période', () => {
    ecrirePeriode('3m')
    expect(localStorage.getItem(CLE_PERIODE)).toBe('3m')
    expect(lirePeriode()).toBe('3m')
  })

  it('une valeur stockée invalide retombe sur le défaut', () => {
    localStorage.setItem(CLE_PERIODE, 'siecle')
    expect(lirePeriode()).toBe('30j')
  })

  it('un stockage inaccessible ne lève jamais', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqué')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqué')
    })
    expect(lirePeriode()).toBe('30j')
    expect(() => ecrirePeriode('7j')).not.toThrow()
  })
})
