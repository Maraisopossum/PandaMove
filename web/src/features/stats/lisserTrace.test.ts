import { describe, expect, it } from 'vitest'
import { lisserTrace } from './lisserTrace'

describe('lisserTrace', () => {
  it('remplace les segments par des courbes passant par les milieux et ferme chaque sous-tracé', () => {
    const d = lisserTrace('M0,0 L10,0 L10,10 Z M50,50 L60,50 L60,60 Z')
    expect(d.match(/M/g)).toHaveLength(2)
    expect(d.match(/Z/g)).toHaveLength(2)
    expect(d).toContain('Q10,0 10.0,5.0')
    expect(d).not.toContain('L')
  })
})
