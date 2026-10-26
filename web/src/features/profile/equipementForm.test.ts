import { describe, expect, it } from 'vitest'
import {
  brouillonDisques, brouillonHalteres, brouillonPlage, KETTLEBELL_DEFAUT, lireDisques, lireHalteres, lireNombre, lirePlage,
} from './equipementForm'

describe('lireNombre', () => {
  it('accepte la virgule décimale et rejette le vide', () => {
    expect(lireNombre('2,5')).toBe(2.5)
    expect(lireNombre(' 20 ')).toBe(20)
    expect(lireNombre('')).toBeNaN()
    expect(lireNombre('abc')).toBeNaN()
  })
})

describe('lirePlage', () => {
  it('valide min <= max et pas > 0', () => {
    expect(lirePlage({ min: '8', max: '24', pas: '4' })).toEqual({ minKg: 8, maxKg: 24, pasKg: 4 })
    expect(lirePlage({ min: '24', max: '8', pas: '4' })).toBeNull()
    expect(lirePlage({ min: '8', max: '24', pas: '0' })).toBeNull()
    expect(lirePlage({ min: '', max: '24', pas: '4' })).toBeNull()
  })
  it('le brouillon par défaut redonne la configuration', () => {
    expect(lirePlage(brouillonPlage(null, KETTLEBELL_DEFAUT))).toEqual(KETTLEBELL_DEFAUT)
  })
})

describe('lireDisques', () => {
  it('ignore les lignes vides, additionne les poids identiques', () => {
    const b = { barre: '20', lignes: [{ poids: '2,5', quantite: '2' }, { poids: '2.5', quantite: '2' }, { poids: '', quantite: '' }] }
    expect(lireDisques(b)).toEqual({ barreKg: 20, disques: { '2.5': 4 } })
  })
  it('refuse une quantité non entière ou un poids nul', () => {
    expect(lireDisques({ barre: '20', lignes: [{ poids: '5', quantite: '1,5' }] })).toBeNull()
    expect(lireDisques({ barre: '20', lignes: [{ poids: '0', quantite: '2' }] })).toBeNull()
    expect(lireDisques({ barre: '', lignes: [] })).toBeNull()
  })
  it('aller-retour avec brouillonDisques', () => {
    const cfg = { barreKg: 15, disques: { '1.25': 2, '5': 4 } }
    expect(lireDisques(brouillonDisques(cfg, cfg))).toEqual(cfg)
  })
})

describe('lireHalteres', () => {
  it('lit des poids fixes triés sans doublon et un chargeable optionnel', () => {
    const b = brouillonHalteres({ poidsFixes: [], chargeable: null })
    expect(lireHalteres({ ...b, fixes: '12,5 8; 8 10' })).toEqual({ poidsFixes: [8, 10, 12.5], chargeable: null })
    expect(lireHalteres({ ...b, fixes: '8', chargeable: true })).toMatchObject({ poidsFixes: [8], chargeable: { barreKg: 2 } })
  })
  it('refuse un poids invalide', () => {
    const b = brouillonHalteres({ poidsFixes: [], chargeable: null })
    expect(lireHalteres({ ...b, fixes: '8 x' })).toBeNull()
    expect(lireHalteres({ ...b, fixes: '-4' })).toBeNull()
  })
})
