// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { creer, definirValidation, lirePlage, PREFIXE_SEANCE_HYROX } from '../../core/db/repos/seancesCardio'
import { createTestDb } from '../../test/sqliteDb'
import { apercuAgendaHyrox, appliquerPlanAgenda, retirerPlanAgenda } from './agendaHyrox'
import { genererPlanHyrox, REGLAGES_PLAN_HYROX_DEFAUT } from './planHyrox'
import { construirePlan } from '../plans/plan'

let base: Db
vi.mock('../../core/db/client', () => ({ getDb: () => base }))

import PlanHyroxScreen from './PlanHyroxScreen'

const AUJ = '2026-11-15'
const plan = () => genererPlanHyrox({ ...REGLAGES_PLAN_HYROX_DEFAUT, semaines: 4, seancesParSemaine: 3, affutageSemaines: 0 }, null, AUJ)
const hyrox = async () => (await lirePlage(base, 'course', '0000-01-01', '9999-12-31')).filter((s) => s.titre.startsWith(PREFIXE_SEANCE_HYROX))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 15, 10, 0, 0))
  base = createTestDb()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('application du plan à l’agenda', () => {
  it('ajoute les séances à venir sous forme de séances de course titrées « Hyrox · »', async () => {
    const p = plan()
    const n = await appliquerPlanAgenda(base, p, AUJ)
    const seances = await hyrox()
    expect(n).toBe(seances.length)
    expect(n).toBe(p.flatMap((s) => s.seances).filter((x) => x.date >= AUJ).length)
    expect(seances[0]).toMatchObject({ genre: 'course', isValidated: false })
    expect(seances[0].detail).toMatch(/^\d+ min$/)
    expect(seances.every((s) => s.date >= AUJ)).toBe(true)
  })

  it('réappliquer remplace les séances à venir sans doublon et garde les séances faites', async () => {
    await appliquerPlanAgenda(base, plan(), AUJ)
    const [premiere] = await hyrox()
    await definirValidation(base, 'course', premiere.id, true)
    const avant = (await hyrox()).length
    const a = await apercuAgendaHyrox(base, plan(), AUJ)
    expect(a).toMatchObject({ gardees: 1, aRemplacer: avant - 1 })
    await appliquerPlanAgenda(base, plan(), AUJ)
    const apres = await hyrox()
    expect(apres.filter((s) => s.isValidated)).toHaveLength(1)
    expect(apres).toHaveLength(avant + 1)
  })

  it('retire seulement les séances Hyrox à venir non faites, jamais les autres séances', async () => {
    await creer(base, 'course', { date: '2026-11-20', titre: 'Footing du plan d’endurance' })
    await appliquerPlanAgenda(base, plan(), AUJ)
    const [premiere] = await hyrox()
    await definirValidation(base, 'course', premiere.id, true)
    const n = await retirerPlanAgenda(base, AUJ)
    expect(n).toBeGreaterThan(0)
    expect((await hyrox()).map((s) => s.id)).toEqual([premiere.id])
    expect((await lirePlage(base, 'course', '0000-01-01', '9999-12-31')).some((s) => s.titre.startsWith('Footing'))).toBe(true)
  })

  it('les séances passées du plan ne sont pas ajoutées', async () => {
    const p = genererPlanHyrox({ ...REGLAGES_PLAN_HYROX_DEFAUT, semaines: 3, debut: '2026-11-02', finSurCourse: false, affutageSemaines: 0 }, null, AUJ)
    expect((await apercuAgendaHyrox(base, p, AUJ)).passees).toBeGreaterThan(0)
    await appliquerPlanAgenda(base, p, AUJ)
    expect((await hyrox()).every((s) => s.date >= AUJ)).toBe(true)
  })

  it('le plan d’endurance ignore les séances Hyrox', async () => {
    await creer(base, 'course', { date: '2026-11-17', titre: 'Footing', detail: '45 min' })
    await appliquerPlanAgenda(base, plan(), AUJ)
    const toutes = await lirePlage(base, 'course', '0000-01-01', '9999-12-31')
    expect(construirePlan(toutes.filter((s) => !s.titre.startsWith(PREFIXE_SEANCE_HYROX)))?.semaines).toHaveLength(1)
    expect(construirePlan(toutes)!.semaines.length).toBeGreaterThan(1)
  })
})

describe('écran du plan : agenda', () => {
  const monter = () => render(<MemoryRouter initialEntries={['/hyrox/plan']}><Routes><Route path="/hyrox/plan" element={<PlanHyroxScreen />} /></Routes></MemoryRouter>)

  it('montre l’aperçu, applique puis retire les séances', async () => {
    monter()
    expect(await screen.findByText(/séances? à ajouter/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer à l’agenda' }))
    expect(await screen.findByText(/ajoutées? à l’agenda/)).toBeTruthy()
    await waitFor(async () => expect((await hyrox()).length).toBeGreaterThan(0))
    await waitFor(() => expect((screen.getByRole('button', { name: /Retirer les séances/ }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: /Retirer les séances/ }))
    expect(await screen.findByText(/retirées? de l’agenda/)).toBeTruthy()
    expect(await hyrox()).toEqual([])
  })
})
