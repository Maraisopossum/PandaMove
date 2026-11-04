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
    expect(MODULES.breathing.color.toLowerCase()).toBe('#00695c')
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

describe('séances de cardio dans le calendrier (pastilles, jalon, lien, « Validée »)', () => {
  const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8')

  // Valeurs d'un jeton : [thème clair, thème sombre] (chaque jeton est défini une fois dans :root et une fois en sombre)
  const jeton = (nom: string): string[] => [...css.matchAll(new RegExp(`^\\s*--${nom}:\\s*(.+?);`, 'gm'))].map((m) => m[1])
  // Une valeur `color-mix(in srgb, #couleur N%, #fond)` devient la couleur opaque équivalente
  const resoudre = (valeur: string): string => {
    const m = /color-mix\(in srgb, (#[0-9a-f]{6}) (\d+)%, (#[0-9a-f]{6})\)/i.exec(valeur)
    return m ? composer({ couleur: m[1], alpha: Number(m[2]) / 100 }, m[3]) : valeur
  }
  const regle = (selecteur: string): string => {
    const m = new RegExp(`${selecteur.replace(/[.[\]]/g, '\\$&')}\\s*{([^}]*)}`).exec(css)
    if (!m) throw new Error(`règle ${selecteur} introuvable dans app.css`)
    return m[1]
  }

  it('les classes utilisent les jetons dont le contraste est vérifié ci-dessous', () => {
    expect(regle('.calendrier__pastille')).toMatch(/color:\s*var\(--calendrier-texte\)/)
    expect(regle('.calendrier__pastille')).toMatch(/background:\s*var\(--calendrier-fond-fort\)/)
    expect(regle('.calendrier__pastille--validee')).toMatch(/color:\s*var\(--couleur-succes-texte\)/)
    expect(regle('.calendrier__pastille--validee')).toMatch(/background:\s*var\(--couleur-succes-fond\)/)
    expect(regle('.calendrier__genre')).toMatch(/color:\s*var\(--calendrier-texte\)/)
    expect(regle('.calendrier__lien a')).toMatch(/color:\s*var\(--calendrier-texte\)/)
  })

  it.each([
    ['clair', 0],
    ['sombre', 1],
  ])('thème %s : texte >= 4,5:1 sur chaque fond où il est posé', (_theme, i) => {
    const couleur = (nom: string) => resoudre(jeton(nom)[i])
    const texte = couleur('calendrier-texte')
    const surface = couleur('surface')
    // Pastille « Optionnelle » et jalon : texte orange sur fond orangé plus marqué
    expect(ratioContraste(texte, couleur('calendrier-fond-fort'))).toBeGreaterThanOrEqual(4.5)
    // Genre (Course, Vélo) et lien « Statistiques » : texte orange sur la surface de la carte
    expect(ratioContraste(texte, surface)).toBeGreaterThanOrEqual(4.5)
    // Pastille « Validée »
    expect(ratioContraste(couleur('couleur-succes-texte'), couleur('couleur-succes-fond'))).toBeGreaterThanOrEqual(4.5)
  })
})
