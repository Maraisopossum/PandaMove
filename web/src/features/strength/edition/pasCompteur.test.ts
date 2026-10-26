import { describe, expect, it } from 'vitest'
import { avancerCompteur } from './pasCompteur'

describe('avancerCompteur (boutons − et + des compteurs)', () => {
  it('ajoute ou retire un pas', () => {
    expect(avancerCompteur(3, 1, 1, 1)).toBe(4)
    expect(avancerCompteur(90, -1, 15, 0)).toBe(75)
  })

  it('ne descend jamais sous le minimum', () => {
    expect(avancerCompteur(1, -1, 1, 1)).toBe(1)
    expect(avancerCompteur(10, -1, 15, 0)).toBe(0)
  })

  it('pas décimaux sans dérive de flottant', () => {
    expect(avancerCompteur(2.5, 1, 0.5, 0.5)).toBe(3)
    expect(avancerCompteur(0.1, 1, 0.2, 0)).toBe(0.3)
    expect(avancerCompteur(2.5, -1, 0.5, 0.5)).toBe(2)
  })

  it('une valeur vide ou invalide repart du minimum', () => {
    expect(avancerCompteur(Number.NaN, 1, 5, 0)).toBe(5)
    expect(avancerCompteur(Number.NaN, -1, 5, 2)).toBe(2)
  })
})
