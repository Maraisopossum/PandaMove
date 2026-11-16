import { describe, expect, it } from 'vitest'
import { cloreSimulation, demarrerSimulation, enregistrerSegment } from '../../core/db/repos/hyrox'
import { ajouterEntree, ajouterEau } from '../../core/db/repos/nutrition'
import { creerObjectifPlan } from '../../core/db/repos/objectifsPlan'
import { createTestDb } from '../../test/sqliteDb'
import { lireDonneesCiblees, MODULES_EXPORT, resumerSelection, versCsv, versJson } from './exportCible'

const MAINTENANT = new Date(2026, 10, 14, 15, 0)
const segments = [
  { rang: 1, type: 'course' as const, station: null, cibleS: 300, chargeLabel: null },
  { rang: 2, type: 'station' as const, station: 'skierg' as const, cibleS: 240, chargeLabel: null },
]

async function simulation(db: ReturnType<typeof createTestDb>, jour: string, statut: 'terminee' | 'abandonnee' = 'terminee') {
  const id = await demarrerSimulation(db, { forme: 'complete', categorie: 'open', genre: 'homme', segments, debutAt: `${jour}T12:00:00.000Z` })
  await enregistrerSegment(db, id, 1, 1500)
  await enregistrerSegment(db, id, 2, 400)
  await cloreSimulation(db, id, statut)
  return id
}

describe('export ciblé : Hyrox, plans, nutrition', () => {
  it('propose les trois nouvelles familles', () => {
    expect(MODULES_EXPORT.map((m) => m.id)).toEqual(expect.arrayContaining(['hyrox', 'plans', 'nutrition']))
  })

  it('Hyrox : simulations terminées de la période, avec le temps de chaque segment dans le JSON seulement', async () => {
    const db = createTestDb()
    const id = await simulation(db, '2026-11-05')
    await simulation(db, '2026-11-06', 'abandonnee')
    await simulation(db, '2026-08-01')
    const d = await lireDonneesCiblees(db, ['hyrox'], 'mois', MAINTENANT)
    expect(d.hyrox).toHaveLength(1)
    expect(d.hyrox![0]).toMatchObject({ id, date: '2026-11-05', titre: 'Simulation Hyrox · complete', duree_s: 1900, sport: 'hyrox' })
    expect(d.hyrox_segments?.map((s) => [s.rang, s.reel_s])).toEqual([[1, 1500], [2, 400]])
    expect((await lireDonneesCiblees(db, ['hyrox'], 'tout', MAINTENANT)).hyrox).toHaveLength(2)
    expect(resumerSelection(d)).toBe('1 simulation Hyrox')
    expect(JSON.parse(versJson(d, 'mois', MAINTENANT)).modules.hyrox_segments).toHaveLength(2)
    expect(versCsv(d)).toContain('hyrox;2026-11-05;Simulation Hyrox · complete;hyrox;1900;')
    expect(versCsv(d)).not.toContain('skierg')
  })

  it('Plans : tous les objectifs, la période ne s’y applique pas', async () => {
    const db = createTestDb()
    await creerObjectifPlan(db, { nom: 'Semi de Lille', discipline: 'course', date: '2027-04-04', distanceM: 21_097, cibleS: 6000 })
    const d = await lireDonneesCiblees(db, ['plans'], 'mois', MAINTENANT)
    expect(d.plans?.map((l) => [l.titre, l.date, l.distance_m, l.duree_s])).toEqual([['Semi de Lille', '2027-04-04', 21_097, 6000]])
    expect(resumerSelection(d)).toBe('1 objectif de plan')
  })

  it('Nutrition : journal du jour avec l’eau, filtré par période', async () => {
    const db = createTestDb()
    await ajouterEntree(db, { date: '2026-11-10', repas: 'dejeuner', nom: 'Riz', quantiteG: 150, apport: { kcal: 195, proteines: 4, glucides: 42, lipides: 0.5, fibres: 0.6 }, source: 'manuel' })
    await ajouterEau(db, '2026-11-10', 250)
    await ajouterEntree(db, { date: '2026-08-01', repas: 'diner', nom: 'Pâtes', quantiteG: 200, apport: { kcal: 300, proteines: 10, glucides: 60, lipides: 2, fibres: 3 }, source: 'manuel' })
    const d = await lireDonneesCiblees(db, ['nutrition'], 'mois', MAINTENANT)
    expect(d.nutrition?.map((l) => [l.titre, l.repas])).toEqual(expect.arrayContaining([['Riz', 'dejeuner']]))
    expect(d.nutrition).toHaveLength(2)
    expect(d.nutrition?.find((l) => l.repas === 'eau')).toMatchObject({ quantite_g: 250, detail: 'eau · 250 ml' })
    expect(d.nutrition?.find((l) => l.titre === 'Riz')?.detail).toBe('dejeuner · 150 g · 195 kcal')
    expect((await lireDonneesCiblees(db, ['nutrition'], 'tout', MAINTENANT)).nutrition).toHaveLength(3)
    expect(resumerSelection(d)).toBe('2 lignes du journal alimentaire')
  })
})
