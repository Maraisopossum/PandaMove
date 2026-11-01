import { readFileSync } from 'node:fs'
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

describe('barre du haut colorée par module (couleurs Stitch)', () => {
  it('reprend les couleurs du design system', () => {
    expect(MODULES.home.color.toLowerCase()).toBe('#5b3d9e')
    expect(MODULES.strength.color.toLowerCase()).toBe('#5b3d9e')
    expect(MODULES.stats.color.toLowerCase()).toBe('#bf360c')
    expect(MODULES.import.color.toLowerCase()).toBe('#1565c0')
    expect(MODULES.profile.color.toLowerCase()).toBe('#576746')
  })

  it.each(Object.entries(MODULES))('titre et icône blancs >= 4,5:1 sur la barre (%s)', (_id, { color }) => {
    expect(ratioContraste('#ffffff', color)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('barre latérale du lien actif du drawer', () => {
  const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8')
  const SURFACE_SOMBRE = '#1e1e22'

  it('en thème sombre la barre est éclaircie de 45 % de blanc (même mélange que app.css)', () => {
    expect(css).toMatch(/color-mix\(in srgb, var\(--couleur-module\) 55%, #fff\)/)
  })

  it.each(Object.entries(MODULES))('barre >= 3:1 sur la surface sombre du drawer, en sombre (%s)', (_id, { color }) => {
    const barre = composer({ couleur: '#ffffff', alpha: 0.45 }, color)
    expect(ratioContraste(barre, SURFACE_SOMBRE)).toBeGreaterThanOrEqual(3)
  })

  it.each(Object.entries(MODULES))('barre >= 3:1 sur la surface claire du drawer (%s)', (_id, { color }) => {
    expect(ratioContraste(color, '#ffffff')).toBeGreaterThanOrEqual(3)
  })
})
