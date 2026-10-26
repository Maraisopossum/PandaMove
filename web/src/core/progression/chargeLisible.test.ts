import { describe, expect, it } from 'vitest'
import { chargeLisible } from './chargeLisible'
import { f32 } from './inventory'

describe('chargeLisible', () => {
  it('rend la valeur décimale lisible d’une charge Float 32 bits', () => {
    expect(chargeLisible(17.69999885559082)).toBe(17.7)
    expect(chargeLisible(f32(17.7))).toBe(17.7)
    expect(chargeLisible(f32(47.3))).toBe(47.3)
  })

  it('laisse intactes les valeurs déjà exactes', () => {
    expect(chargeLisible(22.5)).toBe(22.5)
    expect(chargeLisible(100)).toBe(100)
    expect(chargeLisible(0)).toBe(0)
  })

  it('absorbe le bruit de l’arithmétique 64 bits', () => {
    expect(chargeLisible(0.1 + 0.2)).toBe(0.3)
  })

  it('est idempotente', () => {
    expect(chargeLisible(chargeLisible(17.69999885559082))).toBe(17.7)
  })
})
