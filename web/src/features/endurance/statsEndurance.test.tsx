// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { creerSortie, type Sortie } from '../../core/db/repos/sorties'
import { createTestDb } from '../../test/sqliteDb'
import { calculerStatsEndurance } from './calculsEndurance'
import { calculerCarte, formaterCoordonnees, lieuxFrequentes, tracesDe, type Trace } from './carteSorties'

const base = createTestDb()
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import StatsScreen from '../stats/StatsScreen'

afterEach(cleanup)

const sortie = (date: string, extra: Partial<Sortie> = {}): Sortie => ({
  id: date, sport: 'course', date, debutAt: null, titre: 'Course', dureeS: 3000, dureeDeplacementS: null, distanceM: 10_000, denivelePosM: 50,
  deniveleNegM: null, fcMoy: 150, fcMax: null, rpe: null, puissanceMoyW: null, puissanceMaxW: null, puissanceNormW: null, cadenceMoy: null,
  enSalle: false, notes: null, lien: null, source: 'manuel', empreinte: null, seanceId: null, tours: null, serie: null, trace: null, createdAt: '', ...extra,
})

describe('calculerStatsEndurance', () => {
  const maintenant = new Date(2026, 10, 11)
  it('totalise le sport demandé, allure globale et records', () => {
    const liste = [
      sortie('2026-11-10'),
      sortie('2026-11-03', { distanceM: 5000, dureeS: 1400, fcMoy: 160 }),
      sortie('2026-11-04', { sport: 'velo' }),
      sortie('2026-08-01'),
    ]
    const s = calculerStatsEndurance(liste, 'course', '30j', maintenant)
    expect(s).toMatchObject({ nombre: 2, distanceM: 15_000, dureeS: 4400, fcMoy: 155, rythmeGlobal: 293.3333333333333 })
    expect(s.records.plusLongue).toEqual({ distanceM: 10_000, date: '2026-11-10' })
    expect(s.records.meilleureAllure).toEqual({ secParKm: 280, date: '2026-11-03' })
    expect(s.records.meilleureVitesse).toBeNull()
    expect(s.parJour).toEqual([0, 1, 0, 0, 0, 0, 0].map((_, i) => (i === 1 ? 2 : 0)))
  })

  it('vélo : vitesse globale en km/h et meilleure vitesse sur 10 km et plus', () => {
    const v = [sortie('2026-11-10', { sport: 'velo', distanceM: 30_000, dureeS: 3600 }), sortie('2026-11-05', { sport: 'velo', distanceM: 5000, dureeS: 600 })]
    const s = calculerStatsEndurance(v, 'velo', '30j', maintenant)
    expect(s.rythmeGlobal).toBeCloseTo((35_000 / 1000) / (4200 / 3600), 5)
    expect(s.records.meilleureVitesse).toEqual({ kmh: 30, date: '2026-11-10' })
    expect(s.records.meilleureAllure).toBeNull()
  })

  it('mois vides compris, sans sortie : zéros et pas de record', () => {
    const s = calculerStatsEndurance([], 'course', '3m', maintenant)
    expect(s.mois.map((m) => m.mois)).toEqual(['2026-09', '2026-10', '2026-11'])
    expect(s).toMatchObject({ nombre: 0, rythmeGlobal: null, fcMoy: null })
    expect(s.records.plusLongue).toBeNull()
  })
})

// Boucle de 1 km environ autour de (50,6 ; 3,07)
const boucle = (dLat = 0): Trace => Array.from({ length: 60 }, (_, i) => [50.6 + dLat + 0.004 * Math.sin((i / 60) * 6.283), 3.07 + 0.006 * Math.cos((i / 60) * 6.283)])

describe('carte des sorties', () => {
  it('compte les sorties distinctes par cellule : le tronc commun est le plus fréquenté', () => {
    const c = calculerCarte([boucle(), boucle(), boucle(0.02)])
    expect(c).not.toBeNull()
    expect(c?.max).toBe(2)
    expect(c?.sorties).toBe(3)
    expect(c?.cellules.some((x) => x.niveau === 4)).toBe(true)
    expect(c?.cellules.some((x) => x.niveau <= 2)).toBe(true)
    expect(c?.hauteur).toBeLessThanOrEqual(320 * 1.6)
  })

  it('sans tracé : null ; les sorties en salle et les tracés trop courts sont ignorés', () => {
    expect(calculerCarte([])).toBeNull()
    expect(tracesDe([{ trace: JSON.stringify(boucle()), enSalle: true }, { trace: JSON.stringify([[50, 3]]), enSalle: false }, { trace: null, enSalle: false }])).toEqual([])
  })

  it('lieux de départ : regroupe par zone d\'environ 1 km, les plus fréquents d\'abord', () => {
    const t = (tr: Trace, km: number) => ({ trace: JSON.stringify(tr), enSalle: false, distanceM: km * 1000 })
    const lieux = lieuxFrequentes([t(boucle(), 8), t(boucle(0.0001), 5), t(boucle(0.5), 12)])
    expect(lieux).toHaveLength(2)
    expect(lieux[0]).toMatchObject({ sorties: 2, distanceM: 13_000 })
    expect(formaterCoordonnees(50.6588, 3.0766)).toBe('50,659° N · 3,077° E')
    expect(formaterCoordonnees(-19.25, -146.7)).toBe('19,250° S · 146,700° O')
  })
})

describe('écran Statistiques : vues Course et Vélo', () => {
  it('propose les trois vues et affiche les statistiques et la carte de la vue Course', async () => {
    await creerSortie(base, { sport: 'course', date: new Date().toISOString().slice(0, 10), dureeS: 3000, distanceM: 10_000, trace: JSON.stringify(boucle()), fcMoy: 150 })
    render(<StatsScreen />)
    expect(screen.getAllByRole('button', { name: /Renforcement|Course|Vélo/ }).map((b) => b.textContent)).toEqual(['Renforcement', 'Course', 'Vélo'])
    fireEvent.click(screen.getByRole('button', { name: 'Course' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Carte des sorties' })).toBeTruthy())
    expect(screen.getByRole('heading', { name: 'Records de la période' })).toBeTruthy()
    expect(screen.getByRole('img', { name: /Zones parcourues/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Vélo' }))
    await waitFor(() => expect(screen.getByText(/Aucune sortie de vélo/)).toBeTruthy())
  })
})
