import { describe, expect, it } from 'vitest'
import { analyserSaisie, aujourdhuiIso, texteNombre, versNombre, versNombreOuNull } from './saisie'

describe('saisie', () => {
  it('versNombre : vide -> NaN, virgule décimale acceptée', () => {
    expect(versNombre('')).toBeNaN()
    expect(versNombre('  ')).toBeNaN()
    expect(versNombre('12')).toBe(12)
    expect(versNombre('2,5')).toBe(2.5)
  })

  it('versNombreOuNull : vide -> null', () => {
    expect(versNombreOuNull('')).toBeNull()
    expect(versNombreOuNull('0')).toBe(0)
  })

  it('texteNombre : null et NaN -> vide', () => {
    expect(texteNombre(null)).toBe('')
    expect(texteNombre(Number.NaN)).toBe('')
    expect(texteNombre(0)).toBe('0')
  })

  it('texteNombre : virgule décimale (interface en français), relue par analyserSaisie', () => {
    expect(texteNombre(17.5)).toBe('17,5')
    expect(texteNombre(-1.25)).toBe('-1,25')
    expect(texteNombre(20)).toBe('20')
    expect(analyserSaisie(texteNombre(17.5), false).valeur).toBe(17.5)
  })

  it("aujourdhuiIso utilise la date locale, zéros de tête compris", () => {
    expect(aujourdhuiIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('analyserSaisie', () => {
  const req = (t: string) => analyserSaisie(t, false)
  const fac = (t: string) => analyserSaisie(t, true)

  it('vide : NaN si obligatoire, null si facultatif', () => {
    expect(req('')).toEqual({ accepte: true, valeur: Number.NaN })
    expect(fac('')).toEqual({ accepte: true, valeur: null })
  })

  it('décimaux complets avec point ou virgule', () => {
    expect(fac('2.5').valeur).toBe(2.5)
    expect(fac('2,5').valeur).toBe(2.5)
    expect(fac('1.25').valeur).toBe(1.25)
    expect(fac('0,5').valeur).toBe(0.5)
    expect(fac('.5').valeur).toBe(0.5)
    expect(fac(',5').valeur).toBe(0.5)
    expect(fac('-3').valeur).toBe(-3)
  })

  it('séparateur final : la saisie est acceptée et vaut la partie entière', () => {
    expect(fac('2.')).toEqual({ accepte: true, valeur: 2 })
    expect(fac('2,')).toEqual({ accepte: true, valeur: 2 })
  })

  it('saisies incomplètes (-, ., ,) : acceptées mais NaN (signalées par la validation)', () => {
    for (const t of ['-', '.', ',', '-.']) expect(fac(t), t).toEqual({ accepte: true, valeur: Number.NaN })
  })

  it('lettres, exposant et caractères parasites : refusés (saisie ignorée)', () => {
    for (const t of ['abc', '1e3', '2.5.1', '1 2', '--1', '+2']) expect(fac(t).accepte, t).toBe(false)
  })
})
