import { describe, expect, it } from 'vitest'
import {
  bilanSimulation, calculerRecords, ciblesCourseComplete, ciblesPourSegments, deriveCourse, ecartObjectifPct, ecrireRepartition, estimerTemps, formaterChrono, formaterEcart,
  lireRepartition, lireTempsHyrox, PART_COURSES_DEFAUT, segmentsDeForme, SEGMENTS_COMPLETS, type SegmentMesure,
} from './simulation'
import { chargeStation, STATIONS } from './stations'

const mesure = (rang: number, reelS: number | null, cibleS: number | null = null, extra: Partial<SegmentMesure> = {}): SegmentMesure => ({
  rang, type: rang % 2 === 1 ? 'course' : 'station', station: rang % 2 === 1 ? null : STATIONS[rang / 2 - 1].cle, cibleS, reelS, ...extra,
})

describe('stations', () => {
  it('le catalogue compte huit stations et la charge dépend de la catégorie et du genre', () => {
    expect(STATIONS).toHaveLength(8)
    expect(chargeStation('sled_push', 'open', 'homme')).toBe('152 kg')
    expect(chargeStation('sled_push', 'pro', 'femme')).toBe('152 kg')
    expect(chargeStation('skierg', 'open', 'homme')).toBeNull()
  })
})

describe('forme d’une simulation', () => {
  it('la course complète alterne un kilomètre et une station, huit fois', () => {
    const s = segmentsDeForme('complete')
    expect(s).toHaveLength(16)
    expect(s.map((x) => x.type)).toEqual(Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? 'course' : 'station')))
    expect(s[15]).toMatchObject({ rang: 16, station: 'wall_balls' })
  })

  it('la forme partielle garde les quatre premiers kilomètres et stations', () => {
    const s = segmentsDeForme('partielle')
    expect(s).toHaveLength(8)
    expect(s[7].station).toBe('burpees')
  })

  it('une station seule demande la station', () => {
    expect(segmentsDeForme('station', 'rowing')).toEqual([{ rang: 1, type: 'station', station: 'rowing' }])
    expect(() => segmentsDeForme('station')).toThrow()
  })
})

describe('répartition du temps visé', () => {
  it('somme à l’objectif (à l’arrondi près) avec 55 % pour les courses par défaut', () => {
    const c = ciblesCourseComplete(4200, PART_COURSES_DEFAUT)
    expect(Math.abs(c.reduce((t, x) => t + x, 0) - 4200)).toBeLessThanOrEqual(8)
    const courses = c.filter((_, i) => i % 2 === 0).reduce((t, x) => t + x, 0)
    expect(Math.abs(courses - 4200 * 0.55)).toBeLessThanOrEqual(4)
  })

  it('la part des courses est bornée', () => {
    expect(ciblesCourseComplete(4200, 99)).toEqual(ciblesCourseComplete(4200, 70))
    expect(ciblesCourseComplete(4200, 1)).toEqual(ciblesCourseComplete(4200, 30))
  })

  it('les cibles d’une forme réduite reprennent celles de la course complète', () => {
    const toutes = ciblesCourseComplete(4200, 55)
    const cibles = ciblesPourSegments(segmentsDeForme('station', 'wall_balls'), 4200, 55)
    expect(cibles).toEqual([toutes[15]])
    expect(ciblesPourSegments(segmentsDeForme('partielle'), 4200, 55)).toEqual(toutes.slice(0, 8))
    expect(ciblesPourSegments(SEGMENTS_COMPLETS, null, 55).every((c) => c === null)).toBe(true)
  })

  it('lit et écrit le réglage, avec repli sur la valeur par défaut', () => {
    expect(lireRepartition(ecrireRepartition({ partCoursesPct: 60 }))).toEqual({ partCoursesPct: 60 })
    expect(lireRepartition(null).partCoursesPct).toBe(55)
    expect(lireRepartition('pas du json').partCoursesPct).toBe(55)
    expect(lireRepartition('{"partCoursesPct":5}').partCoursesPct).toBe(30)
  })
})

describe('bilan', () => {
  it('somme les segments, écart à la cible, forts et faibles', () => {
    const b = bilanSimulation([mesure(1, 310, 300), mesure(2, 230, 240), mesure(3, 330, 300), mesure(4, 300, 240)])!
    expect(b.totalS).toBe(1170)
    expect(b.cibleS).toBe(1080)
    expect(b.ecartS).toBe(90)
    expect(b.faibles.map((s) => s.rang)).toEqual([4, 3, 1])
    expect(b.forts.map((s) => s.rang)).toEqual([2])
    expect(b.kilometres).toEqual([310, 330])
    expect(deriveCourse(b.kilometres)).toBe(20)
  })

  it('sans cible, pas d’écart ; ignore les segments non chronométrés ; vide donne null', () => {
    const b = bilanSimulation([mesure(1, 300), mesure(2, null, 240)])!
    expect(b).toMatchObject({ totalS: 300, cibleS: null, ecartS: null, faibles: [], forts: [] })
    expect(bilanSimulation([mesure(1, null)])).toBeNull()
    expect(deriveCourse([300])).toBeNull()
  })
})

describe('records et estimation', () => {
  it('meilleur temps par station et meilleur kilomètre', () => {
    const r = calculerRecords([mesure(1, 310), mesure(2, 240), mesure(3, 290), mesure(4, 230), mesure(5, 0), mesure(6, null)])
    expect(r.meilleurKm).toBe(290)
    expect(r.parStation).toEqual({ skierg: 240, sled_push: 230 })
  })

  it('estimation en fourchette de 3 % et écart à l’objectif', () => {
    expect(estimerTemps(4000)).toEqual({ basS: 3880, hautS: 4120 })
    expect(Math.round(ecartObjectifPct(3800, 4000))).toBe(5)
    expect(ecartObjectifPct(4200, 4000)).toBeLessThan(0)
  })
})

describe('temps', () => {
  it('formate les durées et les écarts', () => {
    expect(formaterChrono(65)).toBe('1:05')
    expect(formaterChrono(4200)).toBe('1:10:00')
    expect(formaterEcart(12)).toBe('+0:12')
    expect(formaterEcart(-75)).toBe('−1:15')
    expect(formaterEcart(0)).toBe('0:00')
  })

  it('lit les temps saisis', () => {
    expect(lireTempsHyrox('1:10:00')).toBe(4200)
    expect(lireTempsHyrox('48:30')).toBe(2910)
    for (const mauvais of ['', 'vite', '48', '1:75', '1:99:00', '10:5']) expect(lireTempsHyrox(mauvais), mauvais).toBeNull()
  })
})
