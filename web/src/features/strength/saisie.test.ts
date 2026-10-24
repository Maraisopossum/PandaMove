import { describe, expect, it } from 'vitest'
import { aujourdhuiIso, texteNombre, versNombre, versNombreOuNull } from './saisie'

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

  it("aujourdhuiIso utilise la date locale, zéros de tête compris", () => {
    expect(aujourdhuiIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})
