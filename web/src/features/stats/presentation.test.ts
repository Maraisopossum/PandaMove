import { describe, expect, it } from 'vitest'
import { MUSCLE_GROUPS } from '../../core/db/types'
import { construireGraphique, syntheseExercice, formaterDate, formaterTonnage, formaterValeur, groupesVue } from './presentation'
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
      { dateIso: '2026-09-01', maxChargeKg: 60, reps: 8, enSecondes: false, volumeKg: 0, rmEstimeKg: 0 },
      { dateIso: '2026-10-01', maxChargeKg: 70, reps: 6, enSecondes: false, volumeKg: 0, rmEstimeKg: 0 },
    ])
    expect(g.unite).toBe('kg')
    expect(g.points.map((p) => p.valeur)).toEqual([60, 70])
    expect(g.points[0].y).toBeGreaterThan(g.points[1].y)
    expect(g.polyligne).toBe(`${g.points[0].x},${g.points[0].y} ${g.points[1].x},${g.points[1].y}`)
  })

  it('graphique : poids du corps -> reps ; DURATION -> secondes ; vide -> aucun point', () => {
    expect(construireGraphique([{ dateIso: '2026-10-01', maxChargeKg: 0, reps: 8, enSecondes: false, volumeKg: 0, rmEstimeKg: 0 }]).unite).toBe('reps')
    expect(construireGraphique([{ dateIso: '2026-10-01', maxChargeKg: 0, reps: 60, enSecondes: true, volumeKg: 0, rmEstimeKg: 0 }]).unite).toBe('s')
    expect(construireGraphique([]).points).toEqual([])
    expect(formaterValeur(62.5, 'kg')).toBe('62,5 kg')
    expect(formaterValeur(60, 's')).toBe('60 s')
  })

  it('historique mixte (séances au poids du corps et chargées) : les points sans charge ne sont pas tracés à 0 kg', () => {
    const g = construireGraphique([
      { dateIso: '2026-10-01', maxChargeKg: 20, reps: 8, enSecondes: false, volumeKg: 0, rmEstimeKg: 0 },
      { dateIso: '2026-10-05', maxChargeKg: 0, reps: 12, enSecondes: false, volumeKg: 0, rmEstimeKg: 0 },
      { dateIso: '2026-10-09', maxChargeKg: 25, reps: 8, enSecondes: false, volumeKg: 0, rmEstimeKg: 0 },
    ])
    expect(g.unite).toBe('kg')
    expect(g.points.map((p) => [p.dateIso, p.valeur])).toEqual([['2026-10-01', 20], ['2026-10-09', 25]])
    expect(g.min).toBe(20)
  })

  describe('courbe : mesures, axes et record', () => {
    const point = (dateIso: string, maxChargeKg: number, reps: number, volumeKg: number, rmEstimeKg: number) => ({
      dateIso, maxChargeKg, reps, enSecondes: false, volumeKg, rmEstimeKg,
    })
    const historique = [
      point('2026-10-10', 95, 5, 2090, 110.83),
      point('2026-10-17', 100, 5, 2200, 116.67),
      point('2026-10-24', 100, 6, 2400, 120),
      point('2026-11-12', 110, 5, 2640, 128.33),
    ]

    it('mesure au choix : charge max, 1RM estimé ou volume (kg dans les trois cas)', () => {
      expect(construireGraphique(historique, 'charge').points.map((p) => p.valeur)).toEqual([95, 100, 100, 110])
      expect(construireGraphique(historique, 'rm').points.map((p) => p.valeur)).toEqual([110.83, 116.67, 120, 128.33])
      const volume = construireGraphique(historique, 'volume')
      expect(volume.points.map((p) => p.valeur)).toEqual([2090, 2200, 2400, 2640])
      expect([volume.unite, volume.mesure]).toEqual(['kg', 'volume'])
    })

    it('graduations rondes qui encadrent les valeurs, y en haut pour les grandes valeurs', () => {
      const g = construireGraphique(historique)
      const valeurs = g.graduationsY.map((t) => Number(t.libelle.replace(',', '.')))
      expect(valeurs[0]).toBeLessThanOrEqual(95)
      expect(valeurs.at(-1)).toBeGreaterThanOrEqual(110)
      expect(valeurs.every((v, i) => i === 0 || v > valeurs[i - 1])).toBe(true)
      // Plus la valeur est grande, plus le point est haut (y plus petit)
      const ys = g.graduationsY.map((t) => t.y)
      expect(ys[0]).toBeGreaterThan(ys.at(-1)!)
      expect(g.points[3].y).toBeLessThan(g.points[0].y)
    })

    it('dates en abscisse : première et dernière, et au plus quatre repères', () => {
      const g = construireGraphique(historique)
      expect(g.graduationsX[0].libelle).toBe('10 oct.')
      expect(g.graduationsX.at(-1)!.libelle).toBe('12 nov.')
      expect(g.graduationsX.length).toBeLessThanOrEqual(4)
      expect(construireGraphique([point('2026-10-10', 95, 5, 0, 0)]).graduationsX.map((t) => t.libelle)).toEqual(['10 oct.'])
    })

    it('année ajoutée aux dates quand l’historique en couvre deux', () => {
      const g = construireGraphique([point('2025-12-20', 90, 5, 0, 0), point('2026-01-10', 95, 5, 0, 0)])
      expect(g.graduationsX.map((t) => t.libelle)).toEqual(['20 déc. 25', '10 janv. 26'])
    })

    it('record : la valeur maximale, la plus récente à égalité', () => {
      expect(construireGraphique(historique).indexRecord).toBe(3)
      expect(construireGraphique([point('2026-10-10', 100, 5, 0, 0), point('2026-10-17', 100, 5, 0, 0)]).indexRecord).toBe(1)
      expect(construireGraphique([]).indexRecord).toBe(-1)
    })

    it('exercice au poids du corps ou en durée : charge max seule, 1RM et volume non proposés', () => {
      const corps = construireGraphique([{ dateIso: '2026-10-10', maxChargeKg: 0, reps: 8, enSecondes: false, volumeKg: 0, rmEstimeKg: 0 }], 'rm')
      expect(corps.mesuresDisponibles).toEqual(['charge'])
      expect([corps.mesure, corps.unite]).toEqual(['charge', 'reps'])
      expect(construireGraphique(historique).mesuresDisponibles).toEqual(['charge', 'rm', 'volume'])
    })

    it('valeur constante : la courbe garde de l’air autour (pas de division par zéro)', () => {
      const g = construireGraphique([point('2026-10-10', 100, 5, 0, 0), point('2026-10-17', 100, 5, 0, 0)])
      expect(g.points.every((p) => Number.isFinite(p.y))).toBe(true)
      expect(g.points[0].y).toBe(g.points[1].y)
    })
  })

  it('synthèse : record, progression depuis la première séance chargée et meilleur 1RM', () => {
    const p = (dateIso: string, c: number, r: number, rm: number) => ({ dateIso, maxChargeKg: c, reps: r, enSecondes: false, volumeKg: 0, rmEstimeKg: rm })
    expect(syntheseExercice([p('2026-10-10', 95, 5, 110.83), p('2026-11-12', 110, 5, 128.33), p('2026-11-20', 105, 6, 126)])).toEqual({
      recordKg: 110, recordDateIso: '2026-11-12', progressionKg: 10, depuisIso: '2026-10-10', rmKg: 128.33,
    })
    expect(syntheseExercice([p('2026-10-10', 0, 8, 0)])).toBeNull()
    expect(syntheseExercice([])).toBeNull()
  })
})
