// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { creer } from '../../core/db/repos/seancesCardio'
import { creerSortie } from '../../core/db/repos/sorties'
import { createTestDb } from '../../test/sqliteDb'

let base: Db
vi.mock('../../core/db/client', () => ({ getDb: () => base }))

import EvolutionPlanScreen from './EvolutionPlanScreen'
import SemainePlanScreen from './SemainePlanScreen'

// Samedi 14 novembre 2026
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

const monter = (chemin: string) =>
  render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route path="/plans/semaine" element={<SemainePlanScreen />} />
        <Route path="/plans/semaine/:debut" element={<SemainePlanScreen />} />
        <Route path="/plans/evolution" element={<EvolutionPlanScreen />} />
      </Routes>
    </MemoryRouter>,
  )

async function programme() {
  const course = await creer(base, 'course', { date: '2026-11-10', titre: 'Footing facile', detail: '45 min' })
  await creer(base, 'velo', { date: '2026-11-11', titre: 'Vélo Zwift', detail: '60 min' })
  await creer(base, 'course', { date: '2026-11-12', titre: 'Fractionné', detail: '40 min' })
  await creer(base, 'course', { date: '2026-11-13', titre: 'Bonus', detail: '30 min', optionnelle: true })
  await creer(base, 'course', { date: '2026-11-17', titre: 'Footing semaine suivante', detail: '45 min', jalon: 'Test' })
  return course
}

describe('semaine du plan', () => {
  it('invite à planifier des séances quand il n’y en a pas', async () => {
    monter('/plans/semaine')
    expect(await screen.findByText(/Aucune séance de course ou de vélo/)).toBeTruthy()
  })

  it('liste les séances de la semaine en cours avec leur état', async () => {
    await programme()
    monter('/plans/semaine')
    const liste = await screen.findByRole('region', { name: 'Séances de la semaine' })
    expect(within(liste).getAllByRole('listitem')).toHaveLength(4)
    expect(within(liste).getAllByText('Manquée')).toHaveLength(3)
    expect(within(liste).getByText('Facultative')).toBeTruthy()
    expect(screen.getByText('Semaine 1 sur 2')).toBeTruthy()
  })

  it('propose de rattacher une sortie, puis valide la séance une fois confirmé', async () => {
    await programme()
    await creerSortie(base, { sport: 'course', date: '2026-11-10', titre: 'Footing du matin', dureeS: 2400, source: 'manuel' })
    monter('/plans/semaine')
    const rattach = await screen.findByRole('region', { name: 'Sorties à rattacher' })
    expect(within(rattach).getByText(/Footing du matin/)).toBeTruthy()
    fireEvent.click(within(rattach).getByRole('button', { name: 'Rattacher' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Sorties à rattacher' })).toBeNull())
    const liste = screen.getByRole('region', { name: 'Séances de la semaine' })
    expect(within(liste).getAllByText('Faite')).toHaveLength(1)
    const ligne = await base.getOptional<{ is_validated: number }>("SELECT is_validated FROM seances_course WHERE titre = 'Footing facile'")
    expect(ligne?.is_validated).toBe(1)
  })

  it('« Non, hors plan » écarte la proposition sans rien écrire', async () => {
    await programme()
    await creerSortie(base, { sport: 'course', date: '2026-11-10', titre: 'Footing du matin', dureeS: 2400, source: 'manuel' })
    monter('/plans/semaine')
    fireEvent.click(await screen.findByRole('button', { name: 'Non, hors plan' }))
    expect(screen.queryByRole('region', { name: 'Sorties à rattacher' })).toBeNull()
    const ligne = await base.getOptional<{ is_validated: number }>("SELECT is_validated FROM seances_course WHERE titre = 'Footing facile'")
    expect(ligne?.is_validated).toBe(0)
  })

  it('ne propose aucun rattachement quand le réglage est coupé', async () => {
    window.localStorage.setItem('pandamove.plans.reglages', JSON.stringify({ proposerRattachement: false }))
    await programme()
    await creerSortie(base, { sport: 'course', date: '2026-11-10', titre: 'Footing du matin', dureeS: 2400, source: 'manuel' })
    monter('/plans/semaine')
    await screen.findByRole('region', { name: 'Séances de la semaine' })
    expect(screen.queryByRole('region', { name: 'Sorties à rattacher' })).toBeNull()
  })

  it('navigue d’une semaine à l’autre', async () => {
    await programme()
    monter('/plans/semaine')
    fireEvent.click(await screen.findByRole('button', { name: 'Semaine suivante' }))
    expect(await screen.findByText('Semaine 2 sur 2')).toBeTruthy()
    expect(screen.getByText(/Footing semaine suivante/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Semaine suivante' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('évolution du plan', () => {
  it('montre le taux de réalisation avec sa définition et le volume prévu et réalisé', async () => {
    const id = await programme()
    await base.execute('UPDATE seances_course SET is_validated = 1 WHERE id = ?', [id])
    monter('/plans/evolution')
    const taux = await screen.findByRole('region', { name: /Taux de réalisation/ })
    expect(within(taux).getByText(/séances faites ÷ séances prévues/)).toBeTruthy()
    expect(within(taux).getByText('33 %')).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Volume par semaine' })).toBeTruthy()
  })

  it('suit la mesure réglée et change de période', async () => {
    await programme()
    window.localStorage.setItem('pandamove.plans.reglages', JSON.stringify({ mesure: 'duree' }))
    monter('/plans/evolution')
    const taux = await screen.findByRole('region', { name: /Taux de réalisation/ })
    expect(within(taux).getByText(/durée réalisée ÷ durée prévue/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '4 semaines' }))
    expect(screen.getByRole('button', { name: '4 semaines' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('compare la plus longue sortie à la durée du jalon final', async () => {
    await programme()
    await creerSortie(base, { sport: 'course', date: '2026-11-10', titre: 'Longue', dureeS: 1800, source: 'manuel' })
    monter('/plans/evolution')
    const long = await screen.findByRole('region', { name: /Sortie longue vers Test/ })
    expect(within(long).getByText(/30 min/)).toBeTruthy()
    expect(within(long).getByText(/45 min/)).toBeTruthy()
  })
})
