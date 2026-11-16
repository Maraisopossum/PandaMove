// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cloreSimulation, demarrerSimulation, enregistrerSegment } from '../../core/db/repos/hyrox'
import { creerSortie } from '../../core/db/repos/sorties'
import { createTestDb } from '../../test/sqliteDb'
import { chargeSortie } from '../endurance/calculCharge'
import { fenetresBilan, lireBilan } from '../home/bilanSemaine'
import { calculerFormeJour } from '../home/donneesAccueil'
import { lireApportHyrox, lireSortiesPourCharge, RPE_PAR_FORME, simulationEnSortie } from './chargeHyrox'
import { calculerStatsHyrox } from './calculsStatsHyrox'

const base = createTestDb()
vi.mock('../../core/db/client', () => ({ getDb: () => base }))

import { StatsHyrox } from './StatsHyrox'

afterEach(cleanup)

const segments = [
  { rang: 1, type: 'course' as const, station: null, cibleS: 300, chargeLabel: null },
  { rang: 2, type: 'station' as const, station: 'skierg' as const, cibleS: 240, chargeLabel: null },
]

// Midi UTC : le même jour local sous tous les fuseaux
async function simulation(db: ReturnType<typeof createTestDb>, jour: string, totalS: number, forme: 'complete' | 'partielle' = 'complete', statut: 'terminee' | 'abandonnee' = 'terminee') {
  const id = await demarrerSimulation(db, { forme, categorie: 'open', genre: 'homme', segments, debutAt: `${jour}T12:00:00.000Z` })
  await enregistrerSegment(db, id, 1, Math.round(totalS / 2))
  await enregistrerSegment(db, id, 2, totalS - Math.round(totalS / 2))
  await cloreSimulation(db, id, statut)
  return id
}

describe('simulations Hyrox dans le bilan de la semaine', () => {
  it('une simulation terminée s’ajoute aux séances terminées et au temps de sport ; une abandonnée ou hors semaine non', async () => {
    const db = createTestDb()
    await simulation(db, '2026-11-04', 4200)
    await simulation(db, '2026-11-03', 1800, 'partielle', 'abandonnee')
    await simulation(db, '2026-10-20', 3900)
    await creerSortie(db, { sport: 'course', date: '2026-11-03', dureeS: 1800, distanceM: 5000 })
    const { courante } = fenetresBilan('2026-11-05')
    const bilan = await lireBilan(db, courante)
    expect(bilan).toMatchObject({ dureeS: 1800 + 4200, distanceM: 5000 })
    expect(bilan.terminees).toBe(1)
    expect(await lireApportHyrox(db, courante.debut, courante.fin)).toEqual({ nombre: 1, dureeS: 4200 })
  })
})

describe('simulations Hyrox dans la charge d’entraînement', () => {
  it('une simulation terminée devient une sortie de course avec un effort supposé selon sa forme', async () => {
    const db = createTestDb()
    await simulation(db, '2026-11-04', 3600)
    await simulation(db, '2026-11-02', 1800, 'partielle')
    await simulation(db, '2026-11-01', 900, 'complete', 'abandonnee')
    const liste = await lireSortiesPourCharge(db)
    expect(liste).toHaveLength(2)
    const complete = liste.find((s) => s.dureeS === 3600)!
    expect(complete).toMatchObject({ sport: 'course', date: '2026-11-04', rpe: RPE_PAR_FORME.complete, distanceM: null })
    // une heure à RPE 8 = 100 x (8/7)² points
    expect(chargeSortie(complete, { ftpW: null, fcMax: null, fcRepos: 55 }).points).toBeCloseTo(100 * (8 / 7) ** 2, 5)
  })

  it('la forme du jour existe dès qu’il y a une simulation, même sans sortie', async () => {
    const db = createTestDb()
    const id = await simulation(db, '2026-11-04', 3600)
    const forme = calculerFormeJour(await lireSortiesPourCharge(db), {}, '2026-11-05')
    expect(forme).not.toBeNull()
    expect(forme!.fatigue).toBeGreaterThan(0)
    expect(simulationEnSortie({ id, courseId: null, forme: 'station', categorie: 'open', genre: 'homme', debutAt: '2026-11-04T12:00:00.000Z', statut: 'terminee', totalS: 600, reference: false, notes: null, createdAt: '' }).rpe).toBe(7)
  })
})

describe('statistiques Hyrox', () => {
  it('compte les simulations terminées de la période, meilleur temps des complètes seulement', async () => {
    const db = createTestDb()
    await simulation(db, '2026-11-10', 4400)
    await simulation(db, '2026-11-03', 4100)
    await simulation(db, '2026-11-05', 1500, 'partielle')
    await simulation(db, '2026-11-04', 700, 'complete', 'abandonnee')
    await simulation(db, '2026-08-01', 3900)
    const { lireSimulations } = await import('../../core/db/repos/hyrox')
    const stats = calculerStatsHyrox(await lireSimulations(db), '30j', new Date(2026, 10, 11, 9))
    expect(stats).toMatchObject({ nombre: 3, dureeS: 4400 + 4100 + 1500, moyenneS: Math.round(10_000 / 3), meilleureCompleteS: 4100, parForme: { complete: 2, partielle: 1, station: 0 } })
    expect(stats.liste.map((s) => s.totalS)).toEqual([4400, 1500, 4100])
    expect(calculerStatsHyrox([], '30j', new Date(2026, 10, 11)).meilleureCompleteS).toBeNull()
  })

  it('l’onglet affiche le résumé et la liste, ou invite à ouvrir Hyrox quand il n’y a rien', async () => {
    const aujourdhui = new Date()
    const jour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const monter = () => render(<MemoryRouter><StatsHyrox /></MemoryRouter>)
    monter()
    expect(await screen.findByText(/Aucune simulation Hyrox terminée/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ouvrir Hyrox' }).getAttribute('href')).toBe('/hyrox')
    cleanup()

    await simulation(base, jour(aujourdhui), 4200)
    monter()
    expect((await screen.findAllByText('1:10:00', { selector: 'dd' })).length).toBe(3)
    expect(screen.getByText('simulation terminée')).toBeTruthy()
    expect(screen.getByRole('link', { name: /1:10:00 · Complète/ }).getAttribute('href')).toMatch(/^\/hyrox\/bilan\//)
    fireEvent.click(screen.getByRole('button', { name: 'Tout' }))
    expect(screen.getByRole('button', { name: 'Tout' }).getAttribute('aria-pressed')).toBe('true')
  })
})
