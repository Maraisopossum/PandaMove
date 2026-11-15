// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { creerCourseHyrox, lireObjectifHyrox } from '../../core/db/repos/hyrox'
import { createTestDb } from '../../test/sqliteDb'
import { lireReglagesPlanHyrox } from './planHyrox'
import { lireRepartition } from './simulation'

let base: Db
vi.mock('../../core/db/client', () => ({ getDb: () => base }))

import PlanHyroxScreen from './PlanHyroxScreen'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 15, 10, 0, 0))
  base = createTestDb()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const monter = () =>
  render(
    <MemoryRouter initialEntries={['/hyrox/plan']}>
      <Routes>
        <Route path="/hyrox/plan" element={<PlanHyroxScreen />} />
      </Routes>
    </MemoryRouter>,
  )

describe('plan de préparation Hyrox', () => {
  it('se génère sans objectif ni date, avec la durée par défaut', async () => {
    monter()
    const semaines = await screen.findByRole('region', { name: 'Semaines du plan' })
    expect(within(semaines).getAllByRole('article')).toHaveLength(12)
    expect(screen.getByText(/12 semaines du 9 novembre 2026/)).toBeTruthy()
  })

  it('se recalcule quand on change la durée et le nombre de séances', async () => {
    monter()
    const curseur = await screen.findByLabelText(/Nombre de semaines/)
    fireEvent.change(curseur, { target: { value: '6' } })
    const semaines = screen.getByRole('region', { name: 'Semaines du plan' })
    expect(within(semaines).getAllByRole('article')).toHaveLength(6)
    fireEvent.change(screen.getByLabelText('Séances par semaine'), { target: { value: '2' } })
    expect(within(within(semaines).getAllByRole('article')[0]).getAllByRole('listitem')).toHaveLength(2)
  })

  it('enregistre les réglages en créant un objectif, sans écraser la répartition ensuite', async () => {
    monter()
    fireEvent.change(await screen.findByLabelText(/Nombre de semaines/), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les réglages' }))
    expect(await screen.findByText(/Réglages enregistrés/)).toBeTruthy()
    const o = await lireObjectifHyrox(base)
    expect(o?.nom).toBe('Préparation Hyrox')
    expect(lireReglagesPlanHyrox(o?.repartitionJson).semaines).toBe(20)
    expect(lireRepartition(o?.repartitionJson).partCoursesPct).toBe(55)
  })

  it('finit le plan la semaine de la course quand une date est fixée, et propose de ne pas le faire', async () => {
    await creerCourseHyrox(base, { nom: 'Hyrox', categorie: 'open', genre: 'homme', date: '2027-03-14' })
    monter()
    expect(await screen.findByText(/du 21 décembre 2026 au 8 mars 2027/)).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: /Terminer le plan la semaine de la course/ }))
    expect(screen.getByLabelText(/Début du plan/)).toBeTruthy()
    expect(screen.getByText(/12 semaines du 9 novembre 2026/)).toBeTruthy()
  })

  it('relit les réglages enregistrés et rétablit les valeurs par défaut', async () => {
    await creerCourseHyrox(base, { nom: 'Hyrox', categorie: 'open', genre: 'homme', repartitionJson: JSON.stringify({ partCoursesPct: 55, plan: { semaines: 8 } }) })
    monter()
    const semaines = await screen.findByRole('region', { name: 'Semaines du plan' })
    expect(within(semaines).getAllByRole('article')).toHaveLength(8)
    fireEvent.click(screen.getByRole('button', { name: 'Rétablir les valeurs par défaut' }))
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Semaines du plan' })).getAllByRole('article')).toHaveLength(12))
  })
})
