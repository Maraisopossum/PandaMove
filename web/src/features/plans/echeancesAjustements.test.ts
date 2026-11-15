import { describe, expect, it } from 'vitest'
import type { ObjectifPlan } from '../../core/db/repos/objectifsPlan'
import type { SeanceCardio } from '../../core/db/repos/seancesCardio'
import { createTestDb } from '../../test/sqliteDb'
import { creer, lirePlage } from '../../core/db/repos/seancesCardio'
import { apercuDecalage, appliquerDeplacements, proposerAjustements } from './ajustements'
import { conflitsAvec, conflitsEntreEcheances, construireEcheances, formaterTemps, lireTemps } from './echeances'
import { construirePlan } from './plan'
import { REGLAGES_PLANS_DEFAUT } from './reglagesPlans'

const seance = (id: string, date: string, extra: Partial<SeanceCardio> = {}): SeanceCardio =>
  ({ id, genre: 'course', date, titre: `Séance ${id}`, consigne: null, detail: '60 min', optionnelle: false, jalon: null, lien: null, isValidated: false, supprimee: false, createdAt: '', ...extra })

const objectif = (id: string, date: string, extra: Partial<ObjectifPlan> = {}): ObjectifPlan =>
  ({ id, nom: `Objectif ${id}`, discipline: 'course', date, distanceM: null, cibleS: null, priorite: 'B', statut: 'prevu', resultatS: null, seanceId: null, notes: null, createdAt: '', ...extra })

describe('échéances', () => {
  const plan = construirePlan([seance('a', '2027-01-26'), seance('j', '2027-01-31', { jalon: 'Ravensberg' })])

  it('réunit les jalons du plan et les objectifs, sans doublon quand un objectif reprend un jalon', () => {
    const e = construireEcheances(plan, [objectif('o1', '2027-03-14'), objectif('o2', '2027-01-31', { seanceId: 'j', nom: 'Ravensberg 10 km', cibleS: 2880, priorite: 'A' })])
    expect(e.map((x) => [x.cle, x.nom, x.cibleS])).toEqual([['s-j', 'Ravensberg 10 km', 2880], ['o-o1', 'Objectif o1', null]])
  })

  it('un jalon sans objectif est de priorité A et prévu', () => {
    expect(construireEcheances(plan, [])[0]).toMatchObject({ cle: 's-j', priorite: 'A', statut: 'prevu', semaine: 0, objectifId: null })
  })

  it('sans plan, seuls les objectifs comptent', () => {
    expect(construireEcheances(null, [objectif('o1', '2027-03-14')]).map((x) => x.cle)).toEqual(['o-o1'])
  })

  it('détecte les échéances à moins de 10 jours, hors abandonnées', () => {
    const e = construireEcheances(plan, [objectif('o1', '2027-02-07'), objectif('o2', '2027-02-09', { statut: 'abandonne' }), objectif('o3', '2027-02-20')])
    expect(conflitsAvec('2027-02-07', e).map((c) => [c.echeance.cle, c.jours])).toEqual([['o-o1', 0], ['s-j', 7]])
    expect(conflitsAvec('2027-02-07', e, 'o-o1').map((c) => c.echeance.cle)).toEqual(['s-j'])
    expect(conflitsEntreEcheances(e).map((c) => [c.a.cle, c.b.cle, c.jours])).toEqual([['s-j', 'o-o1', 7]])
  })

  it('dix jours pile ne sont plus un conflit', () => {
    const e = construireEcheances(plan, [objectif('o1', '2027-02-10')])
    expect(conflitsAvec('2027-02-10', e).map((c) => c.echeance.cle)).toEqual(['o-o1'])
    expect(conflitsEntreEcheances(e)).toEqual([])
  })
})

describe('temps', () => {
  it('lit et formate les temps', () => {
    expect(lireTemps('48:30')).toBe(2910)
    expect(lireTemps('1:10:00')).toBe(4200)
    expect(lireTemps(' 5:05 ')).toBe(305)
    for (const mauvais of ['', 'abc', '48', '1:75', '1:10:75', '1:99:00']) expect(lireTemps(mauvais), mauvais).toBeNull()
    expect(formaterTemps(2910)).toBe('48:30')
    expect(formaterTemps(4200)).toBe('1:10:00')
    expect(formaterTemps(305)).toBe('5:05')
  })
})

describe('ajustement du plan', () => {
  const seances = [
    seance('a', '2026-11-10', { isValidated: true }),
    seance('b', '2026-11-17'),
    seance('c', '2026-11-19'),
    seance('j', '2026-11-22', { jalon: 'Test' }),
    seance('v', '2026-11-18', { genre: 'velo', isValidated: true }),
  ]

  it('l’aperçu du décalage laisse les jalons et les séances faites à leur date', () => {
    const plan = construirePlan(seances, [], { aujourdhui: '2026-11-16' })!
    const a = apercuDecalage(plan, '2026-11-16')
    expect(a.deplacements.map((d) => [d.id, d.de, d.vers])).toEqual([['b', '2026-11-17', '2026-11-24'], ['c', '2026-11-19', '2026-11-26']])
    expect(a.jalonsFixes).toBe(1)
    expect(a.validees).toBe(1)
  })

  it('applique puis annule un décalage en base', async () => {
    const db = createTestDb()
    const id = await creer(db, 'course', { date: '2026-11-17', titre: 'Footing', detail: '45 min' })
    const plan = construirePlan(await lirePlage(db, 'course', '0000-01-01', '9999-12-31'), [], { aujourdhui: '2026-11-16' })!
    const { deplacements } = apercuDecalage(plan, '2026-11-16')
    await appliquerDeplacements(db, deplacements, 1)
    expect((await lirePlage(db, 'course', '0000-01-01', '9999-12-31'))[0]).toMatchObject({ id, date: '2026-11-24' })
    await appliquerDeplacements(db, deplacements, -1)
    expect((await lirePlage(db, 'course', '0000-01-01', '9999-12-31'))[0].date).toBe('2026-11-17')
  })

  it('propose de décaler après trois semaines sous le seuil, et seulement alors', () => {
    const manques = [
      seance('a', '2026-11-02'), seance('b', '2026-11-09'), seance('c', '2026-11-16'), seance('d', '2026-11-23'),
    ]
    const plan = construirePlan(manques, [], { aujourdhui: '2026-11-25' })!
    expect(proposerAjustements(plan, '2026-11-25', REGLAGES_PLANS_DEFAUT)).toHaveLength(1)
    expect(proposerAjustements(plan, '2026-11-25', { ...REGLAGES_PLANS_DEFAUT, prevenirTroisSemaines: false })).toEqual([])
    const bien = construirePlan(manques.map((s) => ({ ...s, isValidated: true })), [], { aujourdhui: '2026-11-25' })!
    expect(proposerAjustements(bien, '2026-11-25', REGLAGES_PLANS_DEFAUT)).toEqual([])
  })
})
