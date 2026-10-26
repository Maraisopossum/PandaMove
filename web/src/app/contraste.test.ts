import { describe, expect, it } from 'vitest'
import { MODULES } from './modules'
import { FOND_BADGE_SYNC, composer, ratioContraste } from './contraste'

describe('ratioContraste', () => {
  it('vaut 21 pour noir sur blanc et 1 pour deux couleurs identiques', () => {
    expect(ratioContraste('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(ratioContraste('#7C5CBF', '#7C5CBF')).toBeCloseTo(1, 5)
  })
})

describe('badge de synchro sur la barre du haut', () => {
  it.each(Object.entries(MODULES))('texte blanc >= 4,5:1 sur le fond du badge (%s)', (_id, { color }) => {
    const fond = composer(FOND_BADGE_SYNC, color)
    expect(ratioContraste('#ffffff', fond)).toBeGreaterThanOrEqual(4.5)
  })
})
