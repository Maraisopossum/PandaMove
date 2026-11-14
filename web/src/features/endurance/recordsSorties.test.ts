import { describe, expect, it } from 'vitest'
import type { Sortie, Sport } from '../../core/db/repos/sorties'
import { analyserSortie, badgesParSortie, bilanHebdo, calculerRecords, comparerSortie, joursRestants, verdict } from './recordsSorties'
import type { Echantillon } from './statsSorties'

const ech = (t: number, extra: Partial<Echantillon>): Echantillon => ({ t, fc: null, w: null, v: null, a: null, c: null, ...extra })

function sortie(partiel: Partial<Sortie> & { id: string; date: string }, serie?: Echantillon[]): Sortie {
  return {
    sport: 'course', debutAt: null, titre: 'Sortie', dureeS: null, dureeDeplacementS: null, distanceM: null, denivelePosM: null,
    deniveleNegM: null, fcMoy: null, fcMax: null, rpe: null, puissanceMoyW: null, puissanceMaxW: null, puissanceNormW: null,
    cadenceMoy: null, enSalle: false, notes: null, lien: null, source: 'manuel', empreinte: null, seanceId: null, tours: null,
    serie: serie ? JSON.stringify(serie) : null, trace: null, ...partiel,
  } as Sortie
}

// Course à allure constante (secondes par km) sur `km` kilomètres, un échantillon toutes les 10 s
function course(id: string, date: string, secParKm: number, km: number): Sortie {
  const v = 1000 / secParKm
  const duree = Math.round(secParKm * km)
  const serie = Array.from({ length: Math.floor(duree / 10) + 1 }, (_, i) => ech(i * 10, { v }))
  return sortie({ id, date, distanceM: km * 1000, dureeS: duree }, serie)
}

function velo(id: string, date: string, watts: number, minutes: number): Sortie {
  const serie = Array.from({ length: minutes * 6 + 1 }, (_, i) => ech(i * 10, { w: watts, v: 8 }))
  return sortie({ id, date, sport: 'velo', distanceM: minutes * 60 * 8, dureeS: minutes * 60 }, serie)
}

describe('analyserSortie', () => {
  it('course : meilleurs temps sur les distances couvertes seulement', () => {
    const a = analyserSortie(course('c1', '2026-11-01', 300, 12)) // 5:00 /km
    expect(Object.keys(a.temps).sort()).toEqual(['10k', '1k', '5k'])
    expect(Math.abs(a.temps['5k'] - 1500)).toBeLessThanOrEqual(2)
    expect(a.efforts).toEqual({})
  })

  it('vélo : meilleurs efforts de puissance selon la durée et l’espacement', () => {
    const a = analyserSortie(velo('v1', '2026-11-01', 210, 45))
    expect(a.efforts).toEqual({ '1min': 210, '5min': 210, '20min': 210 }) // 45 min < 60 min
    expect(a.temps).toEqual({})
  })

  it('sortie saisie à la main (sans série) : analyse vide', () => {
    expect(analyserSortie(sortie({ id: 'm', date: '2026-11-01', distanceM: 5000, dureeS: 1500 }))).toEqual({ id: 'm', date: '2026-11-01', temps: {}, efforts: {} })
    expect(analyserSortie(sortie({ id: 'x', date: '2026-11-01', serie: 'pas du json' }))).toMatchObject({ temps: {}, efforts: {} })
  })
})

describe('records', () => {
  const sorties = [
    course('a', '2026-08-10', 330, 6),
    course('b', '2026-09-12', 315, 6),
    course('c', '2026-10-21', 313, 11),
    course('d', '2026-11-04', 295, 6),
  ]
  const analyses = sorties.map(analyserSortie)
  const r = calculerRecords(sorties, analyses, 'course')

  it('meilleur temps par distance : la sortie la plus rapide, null pour une distance jamais couverte', () => {
    const par = Object.fromEntries(r.distances.map((d) => [d.definition.id, d.record]))
    expect(par['5k']!.sortieId).toBe('d')
    expect(par['10k']!.sortieId).toBe('c')
    expect(par['semi']).toBeNull()
    expect(par['marathon']).toBeNull()
    expect(Math.abs(par['5k']!.dureeS - 1475)).toBeLessThanOrEqual(2)
    expect(par['5k']!.allure).toBeCloseTo(par['5k']!.dureeS / 5, 5)
  })

  it('évolution du 5 km : un point par mois, trié, six mois au plus', () => {
    expect(r.evolution5k.map((p) => p.mois)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11'])
    expect(r.evolution5k[0].dureeS).toBeGreaterThan(r.evolution5k[3].dureeS)
    const nombreux = Array.from({ length: 9 }, (_, i) => course(`m${i}`, `2026-0${i + 1}-15`, 320, 6))
    expect(calculerRecords(nombreux, nombreux.map(analyserSortie), 'course').evolution5k).toHaveLength(6)
  })

  it('autres records : plus longue, plus longue durée, meilleure semaine, dénivelé', () => {
    const avecDeniv = [...sorties, sortie({ id: 'e', date: '2026-11-05', distanceM: 3000, dureeS: 900, denivelePosM: 312 })]
    const autres = Object.fromEntries(calculerRecords(avecDeniv, avecDeniv.map(analyserSortie), 'course').autres.map((a) => [a.id, a]))
    expect(autres['plus-longue']).toMatchObject({ valeur: 11_000, date: '2026-10-21' })
    expect(autres['plus-longue-duree']).toMatchObject({ valeur: Math.round(313 * 11), date: '2026-10-21' })
    // Semaine du 2 nov. : 6 km + 3 km ; semaine du 19 oct. : 11 km
    expect(autres['meilleure-semaine']).toMatchObject({ valeur: 11_000, date: '2026-10-19' })
    expect(autres['denivele']).toMatchObject({ valeur: 312, date: '2026-11-05' })
  })

  it('à égalité, la plus ancienne sortie garde le record', () => {
    const deux = [course('x', '2026-09-01', 300, 6), course('y', '2026-10-01', 300, 6)]
    const rec = calculerRecords(deux, deux.map(analyserSortie), 'course')
    expect(rec.distances.find((d) => d.definition.id === '5k')!.record!.sortieId).toBe('x')
  })

  it('vélo : meilleurs efforts de puissance, sans temps par distance', () => {
    const v = [velo('v1', '2026-10-01', 180, 70), velo('v2', '2026-11-01', 230, 30)]
    const rec = calculerRecords(v, v.map(analyserSortie), 'velo')
    expect(rec.efforts.find((e) => e.definition.id === '20min')!.record).toMatchObject({ watts: 230, sortieId: 'v2' })
    expect(rec.efforts.find((e) => e.definition.id === '60min')!.record).toMatchObject({ watts: 180, sortieId: 'v1' })
    expect(rec.distances.every((d) => d.record === null)).toBe(true)
  })
})

describe('badges de la liste', () => {
  it('aucun badge tant qu’il n’y a qu’une sortie ; sinon les records, sans le 1 km ni le marathon', () => {
    const seule = [course('a', '2026-11-01', 300, 12)]
    expect(badgesParSortie(seule, calculerRecords(seule, seule.map(analyserSortie), 'course'), 'course')).toEqual({})

    const deux = [course('a', '2026-10-01', 330, 6), course('b', '2026-11-01', 300, 12)]
    const b = badgesParSortie(deux, calculerRecords(deux, deux.map(analyserSortie), 'course'), 'course')
    expect(b['b']).toContain('Sortie la plus longue')
    expect(b['b'].some((t) => t.startsWith('Meilleur 5 km : '))).toBe(true)
    expect(b['b'].some((t) => t.startsWith('Meilleur 10 km : '))).toBe(true)
    expect(b['b'].some((t) => t.includes('1 km'))).toBe(false)
    expect(b['a']).toBeUndefined()
  })

  it('vélo : record de puissance sur 5, 20 et 60 minutes', () => {
    const v = [velo('v1', '2026-10-01', 180, 70), velo('v2', '2026-11-01', 230, 30)]
    const b = badgesParSortie(v, calculerRecords(v, v.map(analyserSortie), 'velo'), 'velo')
    expect(b['v2']).toEqual(expect.arrayContaining(['Record de puissance sur 5 min : 230 W', 'Record de puissance sur 20 min : 230 W']))
    expect(b['v1']).toEqual(expect.arrayContaining(['Record de puissance sur 60 min : 180 W', 'Sortie la plus longue']))
  })
})

describe('bilan de la semaine', () => {
  // Jeudi 12 novembre 2026 : la semaine commence le lundi 9 ; la précédente, du 2 au 5 pour la comparaison
  const s = (id: string, date: string, km: number, min: number, sport: Sport = 'course') => sortie({ id, date, sport, distanceM: km * 1000, dureeS: min * 60 })
  const liste = [s('1', '2026-11-09', 8, 42), s('2', '2026-11-11', 4, 23), s('3', '2026-11-02', 10, 55), s('4', '2026-11-05', 5, 28), s('5', '2026-11-06', 20, 100), s('6', '2026-11-10', 30, 60, 'velo')]

  it('semaine en cours, même point de la précédente, un seul sport', () => {
    const b = bilanHebdo(liste, 'course', '2026-11-12')
    expect(b.nombre).toBe(2)
    expect(b.distanceM).toBe(12_000)
    expect(b.dureeS).toBe(65 * 60)
    expect(b.distancePrecedenteM).toBe(15_000) // 2 nov. et 5 nov. ; pas le 6 nov. (après le point de comparaison)
    expect(b.rythme).toBeCloseTo((65 * 60) / 12, 5) // secondes par km
  })

  it('vélo : rythme en km/h ; semaine vide : zéro et pas de rythme', () => {
    expect(bilanHebdo(liste, 'velo', '2026-11-12').rythme).toBeCloseTo(30, 5)
    const vide = bilanHebdo([], 'course', '2026-11-12')
    expect(vide).toEqual({ nombre: 0, distanceM: 0, dureeS: 0, rythme: null, distancePrecedenteM: 0 })
  })

  it('jours restants dans la semaine', () => {
    expect(joursRestants('2026-11-12')).toBe(3) // jeudi : vendredi, samedi, dimanche
    expect(joursRestants('2026-11-15')).toBe(0) // dimanche
    expect(joursRestants('2026-11-09')).toBe(6) // lundi
  })
})

describe('comparaison avec les sorties précédentes', () => {
  const v = (id: string, date: string, km: number, kmh: number, deniv: number) =>
    sortie({ id, date, sport: 'velo', distanceM: km * 1000, dureeS: Math.round((km / kmh) * 3600), denivelePosM: deniv })
  const autres = [v('a', '2026-10-20', 40, 30, 600), v('b', '2026-10-25', 50, 31, 640), v('c', '2026-11-01', 58, 30.6, 680)]

  it('position de la sortie et de la moyenne sur l’échelle des sorties comparées', () => {
    const s = v('s', '2026-11-08', 66, 31.2, 412)
    const r = comparerSortie(s, [...autres, s])!
    expect(r.nombre).toBe(4)
    expect(r.rangDistance).toBe(1)
    const par = Object.fromEntries(r.comparaisons.map((c) => [c.id, c]))
    expect(par['distance'].positionSortie).toBe(100)
    expect(par['distance'].moyenne).toBeCloseTo((40_000 + 50_000 + 58_000) / 3, 5)
    expect(par['denivele'].positionSortie).toBe(0)
    expect(verdict(par['distance'])).toBe('Plus longue que d’habitude')
    expect(verdict(par['denivele'])).toBe('Plus plate que d’habitude')
    expect(verdict(par['rythme'])).toBe('Dans la moyenne')
  })

  it('moins de trois sorties comparables, autre sport ou plus de 30 jours : pas de comparaison', () => {
    const s = v('s', '2026-11-08', 66, 31.2, 412)
    expect(comparerSortie(s, [autres[0], autres[1], s])).toBeNull()
    expect(comparerSortie(s, [...autres.map((x) => ({ ...x, sport: 'course' as Sport })), s])).toBeNull()
    expect(comparerSortie(s, [...autres.map((x) => ({ ...x, date: '2026-09-01' })), s])).toBeNull()
  })

  it('allure de course : une valeur plus basse est plus rapide', () => {
    const c = (id: string, date: string, secKm: number) => sortie({ id, date, distanceM: 10_000, dureeS: secKm * 10 })
    const base = [c('a', '2026-10-20', 330), c('b', '2026-10-25', 330), c('d', '2026-11-01', 330)]
    const s = c('s', '2026-11-08', 300)
    const r = comparerSortie(s, [...base, s])!
    const allure = r.comparaisons.find((x) => x.id === 'rythme')!
    expect(allure.nom).toBe('Allure')
    expect(verdict(allure)).toBe('Plus rapide que d’habitude')
    expect(verdict({ ...allure, sortie: 360 })).toBe('Plus lente que d’habitude')
  })
})
