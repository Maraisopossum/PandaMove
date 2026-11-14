// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { creer } from '../../core/db/repos/seancesCardio'
import { importerProgramme2027 } from '../calendar/seancesCardio/importerProgramme2027'
import { createTestDb } from '../../test/sqliteDb'
import { CLE_REGLAGES_PLANS } from './reglagesPlans'

let base: Db
vi.mock('../../core/db/client', () => ({ getDb: () => base }))

import PlansScreen from './PlansScreen'
import ReglagesPlansScreen from './ReglagesPlansScreen'

// Samedi 14 novembre 2026 : semaine 2 du programme 2027
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 14, 15, 0))
  base = createTestDb()
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const monter = (ecran: React.ReactNode) =>
  render(
    <MemoryRouter>{ecran}</MemoryRouter>,
  )

describe('écran Plans', () => {
  it('invite à importer le programme quand aucune séance n’est planifiée', async () => {
    monter(<PlansScreen />)
    expect(await screen.findByText(/Aucune séance de course ou de vélo/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Calendrier' }).getAttribute('href')).toBe('/calendar')
  })

  it('montre la frise du programme 2027, ses jalons, la semaine en cours et les phases déduites', async () => {
    await importerProgramme2027(base, 'u1')
    monter(<PlansScreen />)
    expect(await screen.findByRole('img', { name: /31 semaines du plan, 3 jalons/ })).toBeTruthy()
    const etat = screen.getByRole('region', { name: 'Où j’en suis' })
    expect(within(etat).getByText('2 sur 31')).toBeTruthy()
    expect(within(etat).getByText('J-78')).toBeTruthy()
    expect(within(etat).getByText(/Ravensberg, 31 janvier/)).toBeTruthy()
    const phases = screen.getByRole('region', { name: /Phases déduites/ })
    expect(within(phases).getAllByText('Affûtage', { selector: 'strong' }).length).toBe(3)
    expect(within(phases).getByText('Reprise', { selector: 'strong' })).toBeTruthy()
    const jalons = screen.getByRole('region', { name: 'Jalons' })
    expect(within(jalons).getAllByRole('listitem')).toHaveLength(3)
  })

  it('calcule la réalisation avec la mesure choisie dans les réglages', async () => {
    await importerProgramme2027(base, 'u1')
    await base.execute("UPDATE seances_course SET is_validated = 1 WHERE date < '2026-11-09'")
    await base.execute("UPDATE seances_velo SET is_validated = 1 WHERE date < '2026-11-09'")
    monter(<PlansScreen />)
    const etat = await screen.findByRole('region', { name: 'Où j’en suis' })
    await waitFor(() => expect(within(etat).getByText(/séances faites ÷ séances prévues/)).toBeTruthy())
    expect(within(etat).getByText(/faites? sur \d+ échues?/)).toBeTruthy()
  })

  it('ne compte pas les séances facultatives dans le taux', async () => {
    await creer(base, 'course', { date: '2026-11-10', titre: 'Footing', detail: '45 min' })
    await creer(base, 'course', { date: '2026-11-12', titre: 'Bonus', detail: '30 min', optionnelle: true })
    monter(<PlansScreen />)
    const etat = await screen.findByRole('region', { name: 'Où j’en suis' })
    expect(await within(etat).findByText(/0 séance faite sur 1 échue/)).toBeTruthy()
  })
})

describe('écran Réglages des plans', () => {
  it('propose les valeurs par défaut validées et retient la mesure choisie sur l’appareil', async () => {
    monter(<ReglagesPlansScreen />)
    expect((screen.getByLabelText(/Durée minimale pour compter une séance/) as HTMLInputElement).value).toBe('80')
    expect((screen.getByLabelText(/part comptée/) as HTMLInputElement).value).toBe('50')
    expect(screen.getByRole('button', { name: 'Séances' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Durée' }))
    expect(screen.getByRole('button', { name: 'Durée' }).getAttribute('aria-pressed')).toBe('true')
    expect(JSON.parse(window.localStorage.getItem(CLE_REGLAGES_PLANS) ?? '{}').mesure).toBe('duree')
  })

  it('rétablit les réglages par défaut', () => {
    window.localStorage.setItem(CLE_REGLAGES_PLANS, JSON.stringify({ mesure: 'les-deux', seuilBonPct: 90 }))
    monter(<ReglagesPlansScreen />)
    expect(screen.getByRole('button', { name: 'Les deux' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Rétablir les réglages par défaut' }))
    expect(screen.getByRole('button', { name: 'Séances' }).getAttribute('aria-pressed')).toBe('true')
    expect(window.localStorage.getItem(CLE_REGLAGES_PLANS)).toBeNull()
  })
})
