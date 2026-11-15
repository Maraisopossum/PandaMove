// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { cloreSimulation, creerCourseHyrox, demarrerSimulation, enregistrerSegment, lireObjectifHyrox, lireSimulations } from '../../core/db/repos/hyrox'
import { createTestDb } from '../../test/sqliteDb'

let base: Db
vi.mock('../../core/db/client', () => ({ getDb: () => base }))

import BilanHyroxScreen from './BilanHyroxScreen'
import HyroxScreen from './HyroxScreen'
import ObjectifHyroxScreen from './ObjectifHyroxScreen'
import RecordsHyroxScreen from './RecordsHyroxScreen'
import SimulationHyroxScreen from './SimulationHyroxScreen'
import StationsHyroxScreen from './StationsHyroxScreen'

// Dimanche 15 novembre 2026
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
        <Route path="/hyrox" element={<HyroxScreen />} />
        <Route path="/hyrox/objectif" element={<ObjectifHyroxScreen />} />
        <Route path="/hyrox/stations" element={<StationsHyroxScreen />} />
        <Route path="/hyrox/simulation" element={<SimulationHyroxScreen />} />
        <Route path="/hyrox/bilan/:id" element={<BilanHyroxScreen />} />
        <Route path="/hyrox/records" element={<RecordsHyroxScreen />} />
      </Routes>
    </MemoryRouter>,
  )

const segmentsDeux = [
  { rang: 1, type: 'course' as const, station: null, cibleS: 300, chargeLabel: null },
  { rang: 2, type: 'station' as const, station: 'skierg', cibleS: 240, chargeLabel: null },
]

async function simulationTerminee(totalCourse: number, totalStation: number, extra: { reference?: boolean } = {}) {
  const id = await demarrerSimulation(base, { forme: 'partielle', categorie: 'open', genre: 'homme', segments: segmentsDeux })
  await enregistrerSegment(base, id, 1, totalCourse)
  await enregistrerSegment(base, id, 2, totalStation)
  await cloreSimulation(base, id, 'terminee')
  if (extra.reference) await base.execute('UPDATE hyrox_simulations SET reference = 1 WHERE id = ?', [id])
  return id
}

describe('accueil Hyrox', () => {
  it('fonctionne sans objectif ni date de course', async () => {
    monter('/hyrox')
    expect(await screen.findByText('Sans date de course')).toBeTruthy()
    expect(screen.getByText(/Aucun objectif pour le moment/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Lancer une simulation' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Définir un objectif' })).toBeTruthy()
  })

  it('affiche le compte à rebours quand une date est fixée', async () => {
    await creerCourseHyrox(base, { nom: 'Hyrox Lille', categorie: 'open', genre: 'homme', date: '2027-01-14', objectifS: 4200 })
    monter('/hyrox')
    expect(await screen.findByRole('heading', { name: 'J-60' })).toBeTruthy()
    expect(screen.getByText(/Hyrox Lille/)).toBeTruthy()
  })

  it('signale un objectif très éloigné de l’estimation, sans rien refuser', async () => {
    await creerCourseHyrox(base, { nom: 'Hyrox', categorie: 'open', genre: 'homme', objectifS: 600 })
    await simulationTerminee(1500, 1500)
    await base.execute("UPDATE hyrox_simulations SET forme = 'complete'")
    monter('/hyrox')
    expect(await screen.findByText(/plus rapide que votre dernière simulation/)).toBeTruthy()
  })

  it('propose de reprendre une simulation en cours', async () => {
    await demarrerSimulation(base, { forme: 'partielle', categorie: 'open', genre: 'homme', segments: segmentsDeux })
    monter('/hyrox')
    expect(await screen.findByRole('link', { name: 'Reprendre la simulation' })).toBeTruthy()
  })
})

describe('objectif Hyrox', () => {
  it('enregistre un objectif sans date puis revient à l’accueil', async () => {
    monter('/hyrox/objectif')
    fireEvent.change(await screen.findByLabelText('Nom'), { target: { value: 'Ma préparation' } })
    fireEvent.change(screen.getByLabelText('Catégorie'), { target: { value: 'pro' } })
    fireEvent.change(screen.getByLabelText(/Temps visé/), { target: { value: '1:10:00' } })
    expect(await screen.findByRole('heading', { name: 'Répartition' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(async () => expect(await lireObjectifHyrox(base)).not.toBeNull())
    expect(await lireObjectifHyrox(base)).toMatchObject({ nom: 'Ma préparation', date: null, categorie: 'pro', objectifS: 4200 })
    expect(await screen.findByRole('heading', { name: 'Hyrox' })).toBeTruthy()
  })

  it('refuse un temps illisible', async () => {
    monter('/hyrox/objectif')
    fireEvent.change(await screen.findByLabelText(/Temps visé/), { target: { value: 'vite' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText(/1:10:00 ou 48:30/)).toBeTruthy()
    expect(await lireObjectifHyrox(base)).toBeNull()
  })

  it('modifie puis supprime l’objectif existant', async () => {
    await creerCourseHyrox(base, { nom: 'Ancien', categorie: 'open', genre: 'homme' })
    monter('/hyrox/objectif')
    fireEvent.change(await screen.findByLabelText('Nom'), { target: { value: 'Nouveau' } })
    fireEvent.change(screen.getByLabelText(/Date de la course/), { target: { value: '2027-03-14' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(async () => expect((await lireObjectifHyrox(base))?.nom).toBe('Nouveau'))
    expect((await lireObjectifHyrox(base))?.date).toBe('2027-03-14')
    cleanup()
    monter('/hyrox/objectif')
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer l’objectif' }))
    await waitFor(async () => expect(await lireObjectifHyrox(base)).toBeNull())
  })
})

describe('stations', () => {
  it('liste les huit stations avec la charge de la catégorie de l’objectif', async () => {
    await creerCourseHyrox(base, { nom: 'Hyrox', categorie: 'pro', genre: 'femme' })
    monter('/hyrox/stations')
    expect(await screen.findByText(/Charges Pro · Femme/)).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(8)
    expect(screen.getByRole('heading', { name: /Sled Push/ }).textContent).toContain('152 kg')
  })
})

describe('simulation', () => {
  it('chronomètre une station seule, enregistre le temps puis ouvre le bilan', async () => {
    monter('/hyrox/simulation')
    fireEvent.change(await screen.findByLabelText('Forme'), { target: { value: 'station' } })
    fireEvent.change(screen.getByLabelText('Station'), { target: { value: 'rowing' } })
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer' }))
    const zone = await screen.findByRole('region', { name: 'Simulation en cours' })
    expect(within(zone).getByRole('heading', { name: 'Rowing' })).toBeTruthy()
    vi.setSystemTime(new Date(2026, 10, 15, 10, 1, 35))
    fireEvent.click(within(zone).getByRole('button', { name: 'Terminer' }))
    expect(await screen.findByRole('heading', { name: 'Bilan de simulation' })).toBeTruthy()
    const [sim] = await lireSimulations(base)
    expect(sim).toMatchObject({ statut: 'terminee', forme: 'station', totalS: 95 })
    expect(screen.getByRole('heading', { name: '1:35' })).toBeTruthy()
  })

  it('passe d’un segment au suivant avec l’écart à la cible, et reprend après un rechargement', async () => {
    await creerCourseHyrox(base, { nom: 'Hyrox', categorie: 'open', genre: 'homme', objectifS: 4400 })
    monter('/hyrox/simulation')
    fireEvent.change(await screen.findByLabelText('Forme'), { target: { value: 'partielle' } })
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer' }))
    let zone = await screen.findByRole('region', { name: 'Simulation en cours' })
    expect(within(zone).getByText('Segment 1 sur 8')).toBeTruthy()
    expect(within(zone).getByText(/Cible/)).toBeTruthy()
    vi.setSystemTime(new Date(2026, 10, 15, 10, 5, 10))
    fireEvent.click(within(zone).getByRole('button', { name: 'Segment suivant' }))
    expect(await screen.findByText('Segment 2 sur 8')).toBeTruthy()
    cleanup()
    // Rechargement : le chrono repart du bon endroit, depuis les temps enregistrés
    vi.setSystemTime(new Date(2026, 10, 15, 10, 6, 0))
    monter('/hyrox/simulation')
    zone = await screen.findByRole('region', { name: 'Simulation en cours' })
    expect(within(zone).getByText('Segment 2 sur 8')).toBeTruthy()
    expect(within(zone).getByRole('heading', { name: 'SkiErg' })).toBeTruthy()
    expect(within(zone).getByText('0:50')).toBeTruthy()
  })

  it('abandonne après confirmation et garde les segments déjà chronométrés', async () => {
    const id = await demarrerSimulation(base, { forme: 'partielle', categorie: 'open', genre: 'homme', segments: segmentsDeux })
    await enregistrerSegment(base, id, 1, 280)
    monter('/hyrox/simulation')
    const zone = await screen.findByRole('region', { name: 'Simulation en cours' })
    fireEvent.click(within(zone).getByRole('button', { name: 'Abandonner' }))
    fireEvent.click(within(zone).getByRole('button', { name: 'Confirmer l’abandon' }))
    await waitFor(async () => expect((await lireSimulations(base))[0].statut).toBe('abandonnee'))
    expect((await lireSimulations(base))[0].totalS).toBe(280)
  })
})

describe('bilan', () => {
  it('montre le total, l’écart, les segments, les forts et faibles ; définit puis retire la référence', async () => {
    const id = await simulationTerminee(330, 230)
    await base.execute("UPDATE hyrox_simulations SET forme = 'complete'")
    monter(`/hyrox/bilan/${id}`)
    expect(await screen.findByRole('heading', { name: '9:20' })).toBeTruthy()
    expect(screen.getByText('+0:20')).toBeTruthy()
    expect(screen.getByText(/À travailler :/).parentElement?.textContent).toContain('Course 1 km')
    expect(screen.getByText(/Points forts :/).parentElement?.textContent).toContain('SkiErg')
    fireEvent.click(screen.getByRole('button', { name: 'Définir comme référence' }))
    expect(await screen.findByRole('button', { name: 'Retirer des références' })).toBeTruthy()
    expect((await lireSimulations(base))[0].reference).toBe(true)
  })

  it('enregistre des notes puis supprime la simulation', async () => {
    const id = await simulationTerminee(300, 240)
    monter(`/hyrox/bilan/${id}`)
    fireEvent.change(await screen.findByLabelText('Notes'), { target: { value: 'Bonne séance' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les notes' }))
    await waitFor(async () => expect((await lireSimulations(base))[0].notes).toBe('Bonne séance'))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la simulation' }))
    await waitFor(async () => expect(await lireSimulations(base)).toEqual([]))
    expect(await screen.findByRole('heading', { name: 'Hyrox' })).toBeTruthy()
  })

  it('dit quand la simulation est introuvable', async () => {
    monter('/hyrox/bilan/inconnue')
    expect(await screen.findByText(/Simulation introuvable/)).toBeTruthy()
  })
})

describe('records', () => {
  it('affiche le meilleur kilomètre et le meilleur temps par station', async () => {
    await simulationTerminee(310, 240)
    await simulationTerminee(290, 250)
    monter('/hyrox/records')
    const carte = await screen.findByRole('region', { name: 'Meilleurs temps' })
    expect(within(carte).getByText('4:50')).toBeTruthy()
    expect(within(carte).getByText('4:00')).toBeTruthy()
    expect(within(carte).getAllByText('pas encore chronométré')).toHaveLength(7)
  })
})
