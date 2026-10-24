import { describe, expect, it } from 'vitest'
import { MUSCLE_GROUPS } from '../../core/db/types'
import { construireGraphique, formaterDate, formaterTonnage, formaterValeur, groupesVue } from './presentation'
import { volumeVide } from './statsQueries'

// Intl fr-FR sépare les milliers par une espace fine insécable : on ramène tout blanc à une espace simple
const espaces = (s: string) => s.replace(/\s/g, ' ')

describe('presentation', () => {
  it('formate le tonnage à la française', () => {
    expect(espaces(formaterTonnage(12345.5))).toBe('12 345,5 kg')
    expect(formaterTonnage(0)).toBe('0 kg')
  })

  it('formate une date ISO en local', () => {
    expect(formaterDate('2026-10-01')).toBe('1 oct. 2026')
  })

  it('groupesVue : 16 groupes triés par volume décroissant, niveaux relatifs au maximum', () => {
    const g = groupesVue({ ...volumeVide(), DOS: 4, PECTORAUX: 8, ADDUCTEURS: 1 }, 'male')
    expect(g).toHaveLength(MUSCLE_GROUPS.length)
    expect(g.slice(0, 3).map((x) => [x.groupe, x.niveau, x.ratio])).toEqual([
      ['PECTORAUX', 4, 1], ['DOS', 2, 0.5], ['ADDUCTEURS', 1, 0.125],
    ])
    expect(g[0].libelle).toBe('Pectoraux')
    expect(g.find((x) => x.groupe === 'ADDUCTEURS')?.vue).toBe('liste')
    expect(g.find((x) => x.groupe === 'BICEPS')).toMatchObject({ series: 0, niveau: 0, couleur: null, libelleNiveau: 'Aucun' })
  })

  it('groupesVue sans données : tout à 0', () => {
    expect(groupesVue(volumeVide(), 'female').every((x) => x.series === 0 && x.niveau === 0)).toBe(true)
  })

  it('graphique : charge en kg, min en bas et max en haut, ordre conservé', () => {
    const g = construireGraphique([
      { dateIso: '2026-09-01', maxChargeKg: 60, reps: 8, enSecondes: false },
      { dateIso: '2026-10-01', maxChargeKg: 70, reps: 6, enSecondes: false },
    ])
    expect(g.unite).toBe('kg')
    expect(g.points.map((p) => p.valeur)).toEqual([60, 70])
    expect(g.points[0].y).toBeGreaterThan(g.points[1].y)
    expect(g.polyligne).toBe(`${g.points[0].x},${g.points[0].y} ${g.points[1].x},${g.points[1].y}`)
  })

  it('graphique : poids du corps -> reps ; DURATION -> secondes ; vide -> aucun point', () => {
    expect(construireGraphique([{ dateIso: '2026-10-01', maxChargeKg: 0, reps: 8, enSecondes: false }]).unite).toBe('reps')
  })

  it('historique mixte (séances au poids du corps et chargées) : les points sans charge ne sont pas tracés à 0 kg', () => {
    const g = construireGraphique([
      { dateIso: '2026-10-01', maxChargeKg: 20, reps: 8, enSecondes: false },
      { dateIso: '2026-10-05', maxChargeKg: 0, reps: 12, enSecondes: false },
      { dateIso: '2026-10-09', maxChargeKg: 25, reps: 8, enSecondes: false },
    ])
    expect(g.unite).toBe('kg')
    expect(g.points.map((p) => [p.dateIso, p.valeur])).toEqual([['2026-10-01', 20], ['2026-10-09', 25]])
    expect(g.min).toBe(20)
    expect(construireGraphique([{ dateIso: '2026-10-01', maxChargeKg: 0, reps: 60, enSecondes: true }]).unite).toBe('s')
    expect(construireGraphique([]).points).toEqual([])
    expect(formaterValeur(62.5, 'kg')).toBe('62,5 kg')
    expect(formaterValeur(60, 's')).toBe('60 s')
  })
})
