// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { cloreSimulation, creerCourseHyrox, demarrerSimulation, enregistrerSegment, lireObjectifHyrox, lireSegments, lireSimulations } from '../../core/db/repos/hyrox'
import { createTestDb } from '../../test/sqliteDb'

let base: Db
vi.mock('../../core/db/client', () => ({ getDb: () => base }))

import BilanHyroxScreen from './BilanHyroxScreen'
import JourJHyroxScreen from './JourJHyroxScreen'
import SimulationHyroxScreen from './SimulationHyroxScreen'
import StationDetailHyroxScreen from './StationDetailHyroxScreen'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 15, 10, 0, 0))
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
        <Route path="/hyrox/stations/:cle" element={<StationDetailHyroxScreen />} />
        <Route path="/hyrox/jour-j" element={<JourJHyroxScreen />} />
        <Route path="/hyrox/simulation" element={<SimulationHyroxScreen />} />
        <Route path="/hyrox/bilan/:id" element={<BilanHyroxScreen />} />
      </Routes>
    </MemoryRouter>,
  )

async function passage(reel: number, debutAt: string) {
  const id = await demarrerSimulation(base, {
    forme: 'partielle', categorie: 'open', genre: 'homme', debutAt,
    segments: [{ rang: 2, type: 'station', station: 'skierg', cibleS: 240, chargeLabel: null }],
  })
  await enregistrerSegment(base, id, 2, reel)
  await cloreSimulation(base, id, 'terminee')
}

describe('détail d’une station', () => {
  it('montre le meilleur temps, l’évolution, les points clés et les erreurs', async () => {
    await passage(260, '2026-11-01T10:00:00.000Z')
    await passage(240, '2026-11-08T10:00:00.000Z')
    monter('/hyrox/stations/skierg')
    expect(await screen.findByRole('heading', { name: '4:00' })).toBeTruthy()
    const evol = screen.getByRole('region', { name: 'Évolution' })
    expect(within(evol).getAllByRole('listitem')).toHaveLength(2)
    expect(within(evol).getByRole('link', { name: 'Simuler cette station' }).getAttribute('href')).toBe('/hyrox/simulation?station=skierg')
    expect(screen.getByRole('region', { name: 'Points clés' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Erreurs fréquentes' })).toBeTruthy()
  })

  it('invite à simuler quand rien n’est chronométré, et dit si la station est inconnue', async () => {
    monter('/hyrox/stations/rowing')
    expect(await screen.findByText(/Aucun temps pour le moment/)).toBeTruthy()
    cleanup()
    monter('/hyrox/stations/golf')
    expect(await screen.findByText(/Station introuvable/)).toBeTruthy()
  })

  it('la simulation s’ouvre sur la station demandée', async () => {
    monter('/hyrox/simulation?station=rowing')
    expect((await screen.findByLabelText('Forme') as HTMLSelectElement).value).toBe('station')
    expect((screen.getByLabelText('Station') as HTMLSelectElement).value).toBe('rowing')
  })
})

describe('jour J', () => {
  it('garde la liste de préparation cochée sur l’appareil', async () => {
    monter('/hyrox/jour-j')
    const case1 = await screen.findByRole('checkbox', { name: /Dossard et pièce d’identité/ })
    fireEvent.click(case1)
    expect((case1 as HTMLInputElement).checked).toBe(true)
    cleanup()
    monter('/hyrox/jour-j')
    expect(((await screen.findByRole('checkbox', { name: /Dossard et pièce d’identité/ })) as HTMLInputElement).checked).toBe(true)
  })

  it('montre le plan de course avec les cibles de l’objectif', async () => {
    await creerCourseHyrox(base, { nom: 'Hyrox', categorie: 'open', genre: 'homme', objectifS: 4200 })
    monter('/hyrox/jour-j')
    const plan = await screen.findByRole('region', { name: 'Plan de course' })
    expect(within(plan).getAllByRole('listitem')).toHaveLength(16)
    expect(within(plan).getByText(/152 kg/)).toBeTruthy()
  })

  it('enregistre le résultat officiel complet : simulation terminée et résultat de l’objectif', async () => {
    await creerCourseHyrox(base, { nom: 'Hyrox', categorie: 'open', genre: 'homme', objectifS: 4200 })
    monter('/hyrox/jour-j')
    const champs = await screen.findAllByPlaceholderText('4:35')
    expect(champs).toHaveLength(16)
    champs.forEach((c) => fireEvent.change(c, { target: { value: '4:00' } }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le résultat' }))
    expect(await screen.findByRole('heading', { name: 'Bilan de simulation' })).toBeTruthy()
    await waitFor(async () => expect((await lireObjectifHyrox(base))?.resultatS).toBe(3840))
    const [sim] = await lireSimulations(base)
    expect(sim).toMatchObject({ forme: 'complete', statut: 'terminee', totalS: 3840, notes: 'Course officielle' })
    expect(await lireSegments(base, sim.id)).toHaveLength(16)
  })

  it('accepte un résultat partiel sans fixer le résultat de l’objectif, et refuse un temps illisible ou vide', async () => {
    await creerCourseHyrox(base, { nom: 'Hyrox', categorie: 'open', genre: 'homme' })
    monter('/hyrox/jour-j')
    const champs = await screen.findAllByPlaceholderText('4:35')
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le résultat' }))
    expect(await screen.findByText(/au moins un temps/)).toBeTruthy()
    fireEvent.change(champs[0], { target: { value: 'vite' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le résultat' }))
    expect(await screen.findByText(/4:35 ou 1:02:10/)).toBeTruthy()
    fireEvent.change(champs[0], { target: { value: '4:50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le résultat' }))
    await waitFor(async () => expect(await lireSimulations(base)).toHaveLength(1))
    expect((await lireObjectifHyrox(base))?.resultatS).toBeNull()
  })
})
