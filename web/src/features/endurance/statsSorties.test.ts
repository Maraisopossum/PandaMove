import { describe, expect, it } from 'vitest'
import type { Sortie } from '../../core/db/repos/sorties'
import { calculerStats, courbeSerie, lireSerie, lireTrace, projeterTrace } from './statsSorties'

const sortie = (date: string, extra: Partial<Sortie> = {}): Sortie => ({
  id: date, sport: 'course', date, debutAt: null, titre: 'Course', dureeS: 3000, dureeDeplacementS: null, distanceM: 10_000, denivelePosM: 50,
  deniveleNegM: null, fcMoy: 150, fcMax: null, rpe: null, puissanceMoyW: null, puissanceMaxW: null, puissanceNormW: null, cadenceMoy: null,
  enSalle: false, notes: null, lien: null, source: 'manuel', empreinte: null, seanceId: null, tours: null, serie: null, trace: null, createdAt: '', ...extra,
})

describe('calculerStats', () => {
  const maintenant = new Date(2026, 10, 11) // mercredi 11 novembre 2026
  const liste = [sortie('2026-11-10'), sortie('2026-11-03', { distanceM: 5000, fcMoy: 160, denivelePosM: null }), sortie('2026-09-01'), sortie('2026-11-02', { distanceM: null, fcMoy: null })]

  it('totalise la période (1 mois) et ignore ce qui est avant', () => {
    const s = calculerStats(liste, '30j', maintenant)
    expect(s).toMatchObject({ nombre: 3, distanceM: 15_000, dureeS: 9000, denivelePosM: 100, fcMoy: 155 })
    expect(s.plusLongue).toEqual({ distanceM: 10_000, date: '2026-11-10' })
  })

  it('regroupe par semaine, semaines vides comprises, jusqu\'à la semaine courante', () => {
    const s = calculerStats(liste, '30j', maintenant)
    expect(s.semaines.at(-1)).toEqual({ lundi: '2026-11-09', distanceM: 10_000 })
    expect(s.semaines.find((w) => w.lundi === '2026-11-02')?.distanceM).toBe(5000)
    expect(s.semaines.find((w) => w.lundi === '2026-10-19')?.distanceM).toBe(0)
  })

  it('« tout » démarre à la première sortie ; sans sortie dans la période, tout est à zéro', () => {
    expect(calculerStats(liste, 'tout', maintenant).semaines[0].lundi).toBe('2026-08-31')
    expect(calculerStats(liste, '7j', new Date(2026, 11, 30))).toMatchObject({ nombre: 0, distanceM: 0, fcMoy: null, semaines: [], plusLongue: null })
  })
})

describe('trace et série', () => {
  it('JSON absent ou invalide : listes vides', () => {
    expect(lireTrace({ trace: null })).toEqual([])
    expect(lireTrace({ trace: '{pas json' })).toEqual([])
    expect(lireSerie({ serie: '{"a":1}' })).toEqual([])
  })

  it('projette la trace dans le cadre (nord en haut) et refuse moins de deux points', () => {
    expect(projeterTrace([[50, 3]], 100, 100)).toBe('')
    const pts = projeterTrace([[50, 3], [50.01, 3.01]], 100, 100).split(' ').map((p) => p.split(',').map(Number))
    expect(pts[0][1]).toBeGreaterThan(pts[1][1])
    for (const [x, y] of pts) expect(x >= 0 && x <= 100 && y >= 0 && y <= 100).toBe(true)
  })

  it('courbe d\'une grandeur : ignore les valeurs absentes, null sous deux points', () => {
    const e = (t: number, fc: number | null) => ({ t, fc, w: null, v: null, a: null, c: null })
    expect(courbeSerie([e(0, 100), e(10, null)], 'fc', 100, 50)).toBeNull()
    const c = courbeSerie([e(0, 100), e(5, null), e(10, 160)], 'fc', 100, 50)
    expect(c).toMatchObject({ min: 100, max: 160 })
    expect(c?.points.split(' ')).toHaveLength(2)
  })
})
