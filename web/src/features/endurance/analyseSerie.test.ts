import { describe, expect, it } from 'vitest'
import { distanceCumulee, ecartMedian, meilleurEffort, meilleurTemps, tempsParZone } from './analyseSerie'
import type { Echantillon } from './statsSorties'

const ech = (t: number | null, extra: Partial<Echantillon> = {}): Echantillon => ({ t, fc: null, w: null, v: null, a: null, c: null, ...extra })

// Série régulière : un échantillon toutes les `pas` secondes, avec vitesse / puissance / FC fournies par instant
const serie = (duree: number, pas: number, f: (t: number) => Partial<Echantillon>): Echantillon[] =>
  Array.from({ length: Math.floor(duree / pas) + 1 }, (_, i) => ech(i * pas, f(i * pas)))

describe('distance cumulée', () => {
  it('intègre la vitesse : 3 m/s pendant 10 min = 1 800 m', () => {
    const c = distanceCumulee(serie(600, 10, () => ({ v: 3 })), null)!
    expect(c.d[c.d.length - 1]).toBeCloseTo(1800, 5)
    expect(c.t[0]).toBe(0)
  })

  it('remise à l’échelle sur la distance officielle (à ± 40 %), sinon inexploitable', () => {
    const s = serie(600, 10, () => ({ v: 3 }))
    expect(distanceCumulee(s, 1900)!.d.at(-1)).toBeCloseTo(1900, 5)
    expect(distanceCumulee(s, 4000)).toBeNull()
    expect(distanceCumulee(s, 900)).toBeNull()
  })

  it('trop peu de points, vitesse absente ou nulle : null ; temps manquants ignorés', () => {
    expect(distanceCumulee([ech(0, { v: 3 }), ech(10, { v: 3 })], null)).toBeNull()
    expect(distanceCumulee(serie(100, 10, () => ({ v: null })), null)).toBeNull()
    const avecTrou = [ech(null, { v: 9 }), ...serie(100, 10, () => ({ v: 2 }))]
    expect(distanceCumulee(avecTrou, null)!.d.at(-1)).toBeCloseTo(200, 5)
  })

  it('vitesse manquante sur un point : la précédente est conservée', () => {
    const s = serie(100, 10, (t) => ({ v: t === 50 ? null : 2 }))
    expect(distanceCumulee(s, null)!.d.at(-1)).toBeCloseTo(200, 5)
  })
})

describe('meilleur temps sur une distance', () => {
  it('allure constante 4:00 /km (4,1667 m/s) : 5 km en 20:00', () => {
    const c = distanceCumulee(serie(2400, 10, () => ({ v: 1000 / 240 })), null)!
    expect(meilleurTemps(c, 5000)).toBeCloseTo(1200, 0)
    expect(meilleurTemps(c, 1000)).toBeCloseTo(240, 0)
  })

  it('trouve le tronçon le plus rapide : 10 min lentes puis 5 min rapides puis 10 min lentes', () => {
    const c = distanceCumulee(serie(1500, 5, (t) => ({ v: t >= 600 && t < 900 ? 5 : 3 })), null)!
    // Les 1 500 m du bloc rapide (5 m/s pendant 300 s) se courent en 300 s
    // (le trapèze lisse la montée en vitesse sur un intervalle d'échantillonnage : 1 à 2 s d'écart)
    expect(Math.abs(meilleurTemps(c, 1500)! - 300)).toBeLessThan(2)
  })

  it('sortie plus courte que la distance : null', () => {
    const c = distanceCumulee(serie(600, 10, () => ({ v: 3 })), null)!
    expect(meilleurTemps(c, 5000)).toBeNull()
  })
})

describe('meilleur effort de puissance', () => {
  it('bloc de 5 min à 300 W entouré de 150 W : 5 min = 300 W, 10 min plus bas, 20 min impossible', () => {
    const s = serie(900, 5, (t) => ({ w: t >= 300 && t < 600 ? 300 : 150 }))
    expect(meilleurEffort(s, 300)).toBe(300)
    expect(meilleurEffort(s, 600)).toBe(225)
    expect(meilleurEffort(s, 1200)).toBeNull()
  })

  it('espacement trop large pour la durée demandée : null (jamais inventé)', () => {
    const s = serie(3600, 30, () => ({ w: 200 }))
    expect(meilleurEffort(s, 60)).toBeNull() // 30 s > 60 / 4
    expect(meilleurEffort(s, 300)).toBe(200)
  })

  it('puissance absente sur plus de 20 % des échantillons : null', () => {
    const s = serie(900, 5, (t) => ({ w: t % 20 === 0 ? 200 : null }))
    expect(meilleurEffort(s, 300)).toBeNull()
    expect(meilleurEffort(serie(900, 5, () => ({})), 300)).toBeNull()
  })

  it('un effort qui commence entre deux échantillons est interpolé', () => {
    const s = serie(600, 10, (t) => ({ w: t >= 200 && t < 500 ? 280 : 100 }))
    expect(meilleurEffort(s, 300)).toBe(280)
  })
})

describe('temps par zone', () => {
  // FTP 200 W : limites 110 / 150 / 180 / 210 W
  it('répartit le temps entre les cinq zones de puissance', () => {
    const s = serie(500, 10, (t) => ({ w: [100, 140, 170, 200, 260][Math.floor(t / 100)] }))
    const z = tempsParZone(s, 'w', 200)!
    expect(z.map((x) => x.nom)).toEqual(['Z1', 'Z2', 'Z3', 'Z4', 'Z5'])
    expect(z.map((x) => x.plage)).toEqual(['< 110 W', '110 – 149 W', '150 – 179 W', '180 – 209 W', '≥ 210 W'])
    // 51 échantillons, 50 intervalles de 10 s : 100 s par zone
    expect(z.map((x) => x.dureeS)).toEqual([100, 100, 100, 100, 100])
    expect(z.reduce((t, x) => t + x.part, 0)).toBeCloseTo(1, 10)
  })

  it('zones de fréquence cardiaque en pourcentage de la FC max', () => {
    const s = serie(300, 10, (t) => ({ fc: t < 150 ? 110 : 175 }))
    const z = tempsParZone(s, 'fc', 190)!
    expect(z.map((x) => x.plage)).toEqual(['< 114 bpm', '114 – 132 bpm', '133 – 151 bpm', '152 – 170 bpm', '≥ 171 bpm'])
    expect(z[0].dureeS).toBe(150)
    expect(z[4].dureeS).toBe(150)
  })

  it('un arrêt de l’enregistrement ne compte pas plus de 2 minutes', () => {
    const s = [ech(0, { w: 100 }), ech(10, { w: 100 }), ech(20, { w: 100 }), ech(3600, { w: 100 })]
    expect(tempsParZone(s, 'w', 200)![0].dureeS).toBe(10 + 10 + 120)
  })

  it('sans référence, sans mesure ou sans série : null', () => {
    const s = serie(300, 10, () => ({ w: 150 }))
    expect(tempsParZone(s, 'w', null)).toBeNull()
    expect(tempsParZone(s, 'w', 0)).toBeNull()
    expect(tempsParZone(s, 'fc', 190)).toBeNull()
    expect(tempsParZone([], 'w', 200)).toBeNull()
  })
})

describe('espacement des échantillons', () => {
  it('médian, 0 sans deux points', () => {
    expect(ecartMedian(serie(100, 10, () => ({})))).toBe(10)
    expect(ecartMedian([ech(0)])).toBe(0)
    expect(ecartMedian([])).toBe(0)
  })
})
