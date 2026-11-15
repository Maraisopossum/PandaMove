// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { creerObjectifPlan, lireObjectifsPlan } from '../../core/db/repos/objectifsPlan'
import { creer } from '../../core/db/repos/seancesCardio'
import { createTestDb } from '../../test/sqliteDb'

let base: Db
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import AjusterPlanScreen from './AjusterPlanScreen'
import JalonPlanScreen from './JalonPlanScreen'
import ObjectifPlanScreen from './ObjectifPlanScreen'
import PlansScreen from './PlansScreen'

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
        <Route path="/plans" element={<PlansScreen />} />
        <Route path="/plans/objectif" element={<ObjectifPlanScreen />} />
        <Route path="/plans/objectif/:id" element={<ObjectifPlanScreen />} />
        <Route path="/plans/jalon/:cle" element={<JalonPlanScreen />} />
        <Route path="/plans/ajuster" element={<AjusterPlanScreen />} />
      </Routes>
    </MemoryRouter>,
  )

async function jalon() {
  await creer(base, 'course', { date: '2026-11-17', titre: 'Footing', detail: '45 min' })
  await creer(base, 'course', { date: '2026-11-24', titre: 'Sortie longue', detail: '1 h 30' })
  return creer(base, 'course', { date: '2026-12-06', titre: 'Course test 10 km', detail: '50 min', jalon: 'Test 10 km' })
}

describe('nouvel objectif', () => {
  it('enregistre un objectif puis revient à la liste des plans', async () => {
    monter('/plans/objectif')
    fireEvent.change(await screen.findByLabelText('Nom'), { target: { value: 'Semi de Lille' } })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2027-04-18' } })
    fireEvent.change(screen.getByLabelText(/Temps visé/), { target: { value: '1:45:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(async () => expect(await lireObjectifsPlan(base)).toHaveLength(1))
    expect(await lireObjectifsPlan(base)).toMatchObject([{ nom: 'Semi de Lille', date: '2027-04-18', cibleS: 6300, priorite: 'B' }])
    expect(await screen.findByRole('heading', { name: 'Plans' })).toBeTruthy()
  })

  it('signale un conflit sans empêcher l’enregistrement', async () => {
    await jalon()
    monter('/plans/objectif')
    fireEvent.change(await screen.findByLabelText('Nom'), { target: { value: 'Course test' } })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-12-13' } })
    const alerte = await screen.findByRole('alert')
    expect(within(alerte).getByText(/Test 10 km/)).toBeTruthy()
    expect(within(alerte).getByText(/7 jours d’écart/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer quand même' }))
    await waitFor(async () => expect(await lireObjectifsPlan(base)).toHaveLength(1))
  })

  it('ne signale rien quand l’alerte est coupée dans les réglages', async () => {
    window.localStorage.setItem('pandamove.plans.reglages', JSON.stringify({ alerteJalons: false }))
    await jalon()
    monter('/plans/objectif')
    fireEvent.change(await screen.findByLabelText('Date'), { target: { value: '2026-12-13' } })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('refuse un temps visé illisible', async () => {
    monter('/plans/objectif')
    fireEvent.change(await screen.findByLabelText('Nom'), { target: { value: 'Semi' } })
    fireEvent.change(screen.getByLabelText(/Temps visé/), { target: { value: 'vite' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText(/48:30 ou 1:10:00/)).toBeTruthy()
    expect(await lireObjectifsPlan(base)).toEqual([])
  })

  it('modifie puis supprime un objectif existant', async () => {
    const id = await creerObjectifPlan(base, { nom: 'Semi', discipline: 'course', date: '2027-04-18' })
    monter(`/plans/objectif/${id}`)
    fireEvent.change(await screen.findByLabelText('Nom'), { target: { value: 'Semi de Lille' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(async () => expect((await lireObjectifsPlan(base))[0].nom).toBe('Semi de Lille'))
    cleanup()
    monter(`/plans/objectif/${id}`)
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer l’objectif' }))
    await waitFor(async () => expect(await lireObjectifsPlan(base)).toEqual([]))
  })
})

describe('liste des jalons', () => {
  it('liste les jalons du plan et les objectifs, avec un lien vers chaque page', async () => {
    await jalon()
    await creerObjectifPlan(base, { nom: 'Semi de Lille', discipline: 'course', date: '2027-04-18' })
    monter('/plans')
    const carte = await screen.findByRole('region', { name: 'Jalons et objectifs' })
    expect(within(carte).getAllByRole('listitem')).toHaveLength(2)
    expect(within(carte).getByRole('link', { name: /Test 10 km/ }).getAttribute('href')).toMatch(/^\/plans\/jalon\/s-/)
    expect(within(carte).getByRole('link', { name: /Semi de Lille/ }).getAttribute('href')).toMatch(/^\/plans\/jalon\/o-/)
    expect(within(carte).getByRole('link', { name: 'Nouvel objectif' })).toBeTruthy()
  })

  it('signale deux échéances trop proches', async () => {
    await jalon()
    await creerObjectifPlan(base, { nom: 'Autre course', discipline: 'course', date: '2026-12-10' })
    monter('/plans')
    expect(await screen.findByText(/Échéances trop proches/)).toBeTruthy()
  })
})

describe('page jalon', () => {
  it('montre le compte à rebours, la préparation restante et les séances clés', async () => {
    const id = await jalon()
    monter(`/plans/jalon/s-${id}`)
    expect(await screen.findByRole('heading', { name: 'J-22' })).toBeTruthy()
    expect(screen.getByText(/Les trois plus longues séances/)).toBeTruthy()
    const cles = screen.getByRole('region', { name: 'Séances clés avant le jour' })
    expect(within(cles).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('region', { name: 'Préparation restante' })).toBeTruthy()
  })

  it('crée l’objectif du jalon avec le résultat saisi et affiche l’écart', async () => {
    const id = await jalon()
    monter(`/plans/jalon/s-${id}`)
    fireEvent.change(await screen.findByLabelText('Temps visé'), { target: { value: '50:00' } })
    fireEvent.change(screen.getByLabelText('Temps officiel'), { target: { value: '48:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText(/1:30 sous l’objectif/)).toBeTruthy()
    const o = await lireObjectifsPlan(base)
    expect(o).toHaveLength(1)
    expect(o[0]).toMatchObject({ seanceId: id, statut: 'fait', cibleS: 3000, resultatS: 2910, nom: 'Test 10 km' })
    // Un deuxième enregistrement met à jour la même ligne
    fireEvent.change(screen.getByLabelText('Temps officiel'), { target: { value: '51:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText(/1:00 au-dessus de l’objectif/)).toBeTruthy()
    expect(await lireObjectifsPlan(base)).toHaveLength(1)
  })

  it('dit quand le jalon est introuvable', async () => {
    await jalon()
    monter('/plans/jalon/s-inconnu')
    expect(await screen.findByText(/Jalon introuvable/)).toBeTruthy()
  })
})

describe('ajuster le plan', () => {
  it('décale les séances à venir après aperçu, puis annule le décalage', async () => {
    await jalon()
    monter('/plans/ajuster')
    fireEvent.click(await screen.findByRole('button', { name: 'Voir l’aperçu' }))
    const apercu = await screen.findByRole('region', { name: 'Aperçu du décalage' })
    expect(within(apercu).getByText(/2 séances/)).toBeTruthy()
    expect(within(apercu).getByText(/1 jalon\)/)).toBeTruthy()
    fireEvent.click(within(apercu).getByRole('button', { name: 'Appliquer' }))
    const statut = await screen.findByRole('status')
    expect(within(statut).getByText(/2 séances décalées/)).toBeTruthy()
    const dates = async () => (await base.getAll<{ date: string }>('SELECT date FROM seances_course ORDER BY date')).map((l) => l.date)
    expect(await dates()).toEqual(['2026-11-24', '2026-12-01', '2026-12-06'])
    fireEvent.click(within(statut).getByRole('button', { name: 'Annuler le décalage' }))
    await waitFor(async () => expect(await dates()).toEqual(['2026-11-17', '2026-11-24', '2026-12-06']))
  })

  it('invite à planifier quand il n’y a aucune séance', async () => {
    monter('/plans/ajuster')
    expect(await screen.findByText(/Aucune séance de course ou de vélo/)).toBeTruthy()
  })

  it('n’affiche aucune proposition quand la réalisation est correcte', async () => {
    await jalon()
    monter('/plans/ajuster')
    expect(await screen.findByText(/Aucune proposition pour le moment/)).toBeTruthy()
  })
})
