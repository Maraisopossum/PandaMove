import { describe, expect, it } from 'vitest'
import { formaterCharge } from './formaterCharge'

describe('formaterCharge', () => {
  it('corrige le bruit float32 et utilise la virgule', () => {
    expect(formaterCharge(17.69999885559082)).toBe('17,7')
    expect(formaterCharge(Math.fround(1.25))).toBe('1,25')
  })
  it('supprime les zéros inutiles', () => {
    expect(formaterCharge(20)).toBe('20')
    expect(formaterCharge(2.5)).toBe('2,5')
    expect(formaterCharge(2.0)).toBe('2')
  })
  it('absorbe le bruit des additions flottantes', () => {
    expect(formaterCharge(0.1 + 0.2)).toBe('0,3')
    expect(formaterCharge(20.000001)).toBe('20')
  })
  it('gère zéro et zéro négatif', () => {
    expect(formaterCharge(0)).toBe('0')
    expect(formaterCharge(-0)).toBe('0')
    expect(formaterCharge(0.001)).toBe('0')
  })
  it('ne plante pas sur une valeur non finie', () => {
    expect(formaterCharge(Number.NaN)).toBe('—')
  })
})
