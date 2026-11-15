import { describe, expect, it } from 'vitest'
import { ajouterJours } from '../calendar/grille'
import {
  debutDuPlan, dureeSemaine, ecrireReglagesPlanHyrox, genererPlanHyrox, lireReglagesPlanHyrox, repartirPhases, REGLAGES_PLAN_HYROX_DEFAUT, type ReglagesPlanHyrox,
} from './planHyrox'
import { ecrireRepartition, lireRepartition } from './simulation'

const r = (extra: Partial<ReglagesPlanHyrox> = {}): ReglagesPlanHyrox => ({ ...REGLAGES_PLAN_HYROX_DEFAUT, ...extra })
// Dimanche 15 novembre 2026 : le lundi de la semaine est le 9
const AUJ = '2026-11-15'

describe('phases', () => {
  it.each([2, 3, 4, 8, 12, 17, 30, 52])('%i semaines : autant de phases que de semaines, affûtage à la fin', (n) => {
    const p = repartirPhases(n, 1)
    expect(p).toHaveLength(n)
    expect(p[n - 1]).toBe('affutage')
  })

  it('sans affûtage, aucune semaine d’affûtage ; une préparation courte saute la base', () => {
    expect(repartirPhases(12, 0)).not.toContain('affutage')
    expect(repartirPhases(2, 0)).toEqual(['specifique', 'specifique'])
    expect(repartirPhases(12, 1).filter((x) => x === 'base').length).toBeGreaterThan(0)
  })

  it('l’affûtage ne dépasse jamais la durée du plan', () => {
    expect(repartirPhases(2, 3)).toEqual(['specifique', 'affutage'])
  })

  it('les phases se suivent dans l’ordre', () => {
    const ordre = ['base', 'construction', 'specifique', 'affutage']
    const idx = repartirPhases(20, 2).map((x) => ordre.indexOf(x))
    expect(idx).toEqual([...idx].sort((a, b) => a - b))
  })
})

describe('génération du plan', () => {
  it('respecte la durée et le nombre de séances par semaine demandés', () => {
    const plan = genererPlanHyrox(r({ semaines: 9, seancesParSemaine: 3, affutageSemaines: 0 }), null, AUJ)
    expect(plan).toHaveLength(9)
    expect(plan.every((s) => s.seances.length === 3)).toBe(true)
    expect(plan[0].debut).toBe('2026-11-09')
    expect(plan[1].debut).toBe('2026-11-16')
  })

  it('les séances tombent dans leur semaine, sur des jours distincts', () => {
    for (const n of [2, 3, 4, 5, 6]) {
      const plan = genererPlanHyrox(r({ semaines: 6, seancesParSemaine: n, affutageSemaines: 0 }), null, AUJ)
      for (const s of plan) {
        expect(new Set(s.seances.map((x) => x.date)).size).toBe(n)
        for (const x of s.seances) expect(x.date >= s.debut && x.date < ajouterJours(s.debut, 7)).toBe(true)
      }
    }
  })

  it('une semaine allégée est plus courte, jamais en affûtage', () => {
    const plan = genererPlanHyrox(r({ semaines: 12, allegeeToutesLes: 4 }), null, AUJ)
    const allegees = plan.filter((s) => s.allegee).map((s) => s.rang)
    expect(allegees).toEqual([4, 8])
    expect(dureeSemaine(plan[3])).toBeLessThan(dureeSemaine(plan[2]))
    expect(genererPlanHyrox(r({ allegeeToutesLes: 0 }), null, AUJ).some((s) => s.allegee)).toBe(false)
    expect(plan.filter((s) => s.phase === 'affutage').some((s) => s.allegee)).toBe(false)
  })

  it('les simulations n’apparaissent qu’en phase spécifique et se coupent', () => {
    const avec = genererPlanHyrox(r({ semaines: 16, seancesParSemaine: 6, simulations: true }), null, AUJ)
    const sims = avec.flatMap((s) => s.seances.filter((x) => x.type === 'simulation').map(() => s.phase))
    expect(sims.length).toBeGreaterThan(0)
    expect(sims.every((p) => p === 'specifique')).toBe(true)
    const sans = genererPlanHyrox(r({ semaines: 16, seancesParSemaine: 6, simulations: false }), null, AUJ)
    expect(sans.some((s) => s.seances.some((x) => x.type === 'simulation'))).toBe(false)
  })

  it('l’affûtage est plus léger, et la dernière semaine compte une séance de moins', () => {
    const plan = genererPlanHyrox(r({ semaines: 10, seancesParSemaine: 4, affutageSemaines: 2 }), null, AUJ)
    expect(plan.filter((s) => s.phase === 'affutage')).toHaveLength(2)
    expect(dureeSemaine(plan[9])).toBeLessThan(dureeSemaine(plan[5]))
    expect(plan[9].seances).toHaveLength(3)
  })

  it('toutes les durées sont des multiples de 5 minutes', () => {
    const plan = genererPlanHyrox(r({ semaines: 20 }), null, AUJ)
    expect(plan.flatMap((s) => s.seances).every((x) => x.dureeMin > 0 && x.dureeMin % 5 === 0)).toBe(true)
  })
})

describe('début du plan', () => {
  it('finit la semaine de la course quand une date existe', () => {
    // Course le dimanche 14 mars 2027 : sa semaine commence le lundi 8 mars ; 12 semaines
    expect(debutDuPlan(r({ semaines: 12 }), '2027-03-14', AUJ)).toBe('2026-12-21')
    const plan = genererPlanHyrox(r({ semaines: 12 }), '2027-03-14', AUJ)
    expect(plan[11].debut).toBe('2027-03-08')
  })

  it('sinon commence au jour choisi (ramené au lundi), ou cette semaine', () => {
    expect(debutDuPlan(r({ debut: '2026-12-02', finSurCourse: false }), '2027-03-14', AUJ)).toBe('2026-11-30')
    expect(debutDuPlan(r(), null, AUJ)).toBe('2026-11-09')
    expect(debutDuPlan(r({ debut: '2026-12-02' }), null, AUJ)).toBe('2026-11-30')
  })
})

describe('réglages enregistrés', () => {
  it('relit les réglages avec bornes et valeurs par défaut', () => {
    expect(lireReglagesPlanHyrox(null)).toEqual(REGLAGES_PLAN_HYROX_DEFAUT)
    expect(lireReglagesPlanHyrox('pas du json')).toEqual(REGLAGES_PLAN_HYROX_DEFAUT)
    const l = lireReglagesPlanHyrox(JSON.stringify({ plan: { semaines: 999, seancesParSemaine: 1, affutageSemaines: 9, allegeeToutesLes: 5, debut: 'demain', simulations: 'oui' } }))
    expect(l).toMatchObject({ semaines: 52, seancesParSemaine: 2, affutageSemaines: 3, allegeeToutesLes: 4, debut: null, simulations: true })
  })

  it('l’écriture garde la répartition des temps et inversement', () => {
    const json = ecrireReglagesPlanHyrox(ecrireRepartition({ partCoursesPct: 60 }), r({ semaines: 20 }))
    expect(lireRepartition(json).partCoursesPct).toBe(60)
    expect(lireReglagesPlanHyrox(json).semaines).toBe(20)
    const json2 = ecrireRepartition({ partCoursesPct: 50 }, json)
    expect(lireReglagesPlanHyrox(json2).semaines).toBe(20)
    expect(lireRepartition(json2).partCoursesPct).toBe(50)
  })
})
