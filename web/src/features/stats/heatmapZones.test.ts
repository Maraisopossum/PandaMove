import { describe, expect, it } from 'vitest'
import { MUSCLE_GROUPS } from '../../core/db/types'
import { COULEURS_NIVEAU, HEATMAP_VIEWBOX, HEATMAP_ZONES, niveauVolume } from './heatmapZones'

const VARIANTES = ['male', 'female'] as const

// Commandes absolues M/L/Z suivies de couples de nombres (format produit par heatmapZones)
const CHEMIN = /^M\s*-?\d+(\.\d+)?[ ,]-?\d+(\.\d+)?(\s*[MLZ]\s*(-?\d+(\.\d+)?[ ,]-?\d+(\.\d+)?)?)*\s*Z$/

describe('HEATMAP_ZONES', () => {
  it.each(VARIANTES)('%s : chaque groupe musculaire figure exactement une fois', (variante) => {
    const zones = HEATMAP_ZONES[variante]
    expect(Object.keys(zones).sort()).toEqual([...MUSCLE_GROUPS].sort())
    for (const g of MUSCLE_GROUPS) {
      const z = zones[g]
      // Une zone « liste » n'a pas de tracé ; une zone de vue en a toujours un
      expect(z.vue === 'liste', g).toBe(z.svgPath === null)
    }
    const vues = new Set(MUSCLE_GROUPS.map((g) => zones[g].vue))
    expect(vues).toEqual(new Set(['face', 'dos', 'liste']))
    expect(zones.ADDUCTEURS.vue).toBe('liste')
    expect(zones.AUTRE.vue).toBe('liste')
  })

  it.each(VARIANTES)('%s : chaque tracé est un chemin valide dont les points restent dans le viewBox', (variante) => {
    for (const g of MUSCLE_GROUPS) {
      const chemin = HEATMAP_ZONES[variante][g].svgPath
      if (chemin === null) continue
      expect(chemin, g).toMatch(CHEMIN)
      const nombres = (chemin.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
      expect(nombres.length % 2, g).toBe(0)
      for (let i = 0; i < nombres.length; i += 2) {
        expect(nombres[i], g).toBeGreaterThanOrEqual(0)
        expect(nombres[i], g).toBeLessThanOrEqual(HEATMAP_VIEWBOX.largeur)
        expect(nombres[i + 1], g).toBeGreaterThanOrEqual(0)
        expect(nombres[i + 1], g).toBeLessThanOrEqual(HEATMAP_VIEWBOX.hauteur)
      }
    }
  })
})

describe('niveauVolume', () => {
  it('est total : 0 pour 0, négatif, NaN ; plafonné au dernier niveau au-delà de 1', () => {
    expect(niveauVolume(0)).toBe(0)
    expect(niveauVolume(-1)).toBe(0)
    expect(niveauVolume(Number.NaN)).toBe(0)
    expect(niveauVolume(Number.POSITIVE_INFINITY)).toBe(COULEURS_NIVEAU.length - 1)
    expect(niveauVolume(1)).toBe(COULEURS_NIVEAU.length - 1)
    expect(niveauVolume(5)).toBe(COULEURS_NIVEAU.length - 1)
    expect(niveauVolume(0.001)).toBe(1)
  })

  it('est monotone croissant', () => {
    let precedent = -1
    for (let r = 0; r <= 1.0001; r += 0.01) {
      const n = niveauVolume(r)
      expect(n).toBeGreaterThanOrEqual(precedent)
      precedent = n
    }
  })

  it('niveau 0 = aucune couleur, puis une couleur par niveau', () => {
    expect(COULEURS_NIVEAU[0]).toBeNull()
    expect(COULEURS_NIVEAU.slice(1).every((c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c))).toBe(true)
  })
})
