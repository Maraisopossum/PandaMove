// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { MUSCLE_GROUPS } from '../../core/db/types'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'

let base: Db
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: '11111111-1111-4111-8111-111111111111' } } }),
}))

import StatsScreen from './StatsScreen'

const b = { user_id: 'u1', updated_at: '2026-01-01T00:00:00Z', deleted_at: null }

async function seanceTerminee(id: string, date: string, reps: number, charge: number) {
  await inserer(base, 'instances_seance', { ...b, id, seance_id: 's1', date, is_completed: 1, duration_seconds: 1800 })
  await inserer(base, 'exercices_seance', {
    ...b, id: `es-${id}`, seance_id: 's1', exercise_id: 'ex-dc', instance_seance_id: id, position: 0, reps_type: 'REPS',
  })
  await inserer(base, 'series_realisees', {
    ...b, id: `sr-${id}`, instance_seance_id: id, exercice_seance_id: `es-${id}`, numero_serie: 1,
    reps_realisees: reps, charge_kg: charge, is_completed: 1,
  })
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 24, 15, 0))
  localStorage.clear()
  base = createTestDb()
  await inserer(base, 'exercises', {
    ...b, id: 'ex-dc', name: 'Développé couché', category: 'CHEST', muscle_groups: '["PECTORAUX"]', muscle_primary: '',
  })
  await seanceTerminee('i1', '2026-10-20', 10, 120) // 1 200 kg
  await seanceTerminee('i2', '2026-08-01', 10, 100) // hors des 30 derniers jours
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.clear()
})

const texte = (el: Element) => (el.textContent ?? '').replace(/\s/g, ' ')

describe('StatsScreen', () => {
  it('affiche le résumé de la période, la figure et les 16 groupes', async () => {
    render(<StatsScreen />)
    const resume = await screen.findByRole('region', { name: 'Résumé de la période' })
    await waitFor(() => expect(texte(resume)).toContain('1 200 kg'))
    expect(texte(resume)).toMatch(/1\s*séance terminée/)
    expect(screen.getByRole('button', { name: '30 jours' }).getAttribute('aria-pressed')).toBe('true')

    const liste = screen.getByRole('list', { name: 'Séries par groupe musculaire' })
    expect(within(liste).getAllByRole('listitem')).toHaveLength(MUSCLE_GROUPS.length)
    expect(texte(within(liste).getAllByRole('listitem')[0])).toMatch(/Pectoraux.*1 série/)
    expect(texte(liste)).toContain('Adducteurs')
    expect(texte(liste)).toContain('Autre')
  })

  it('bascule entre face et dos', async () => {
    render(<StatsScreen />)
    const figure = await screen.findByRole('figure', { name: /Heatmap musculaire/ })
    const image = () => figure.querySelector('img')?.getAttribute('src')
    expect(image()).toBe('/panda/heatmap-male-face.webp')
    expect(figure.querySelector('title')?.textContent).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Dos' }))
    expect(screen.getByRole('button', { name: 'Dos' }).getAttribute('aria-pressed')).toBe('true')
    expect(image()).toBe('/panda/heatmap-male-dos.webp')
  })

  it('changer de période recharge les chiffres et retient le choix', async () => {
    render(<StatsScreen />)
    const resume = await screen.findByRole('region', { name: 'Résumé de la période' })
    await waitFor(() => expect(texte(resume)).toContain('1 200 kg'))
    fireEvent.click(screen.getByRole('button', { name: '3 mois' }))
    await waitFor(() => expect(texte(resume)).toContain('2 200 kg'))
    expect(localStorage.getItem('pandamove.stats.periode')).toBe('3m')
  })

  it('état vide quand aucune séance terminée sur la période', async () => {
    // Seule la séance d'août existe : rien sur les 7 derniers jours
    localStorage.setItem('pandamove.stats.periode', '7j')
    await base.execute('DELETE FROM series_realisees WHERE id = ?', ['sr-i1'])
    await base.execute('DELETE FROM instances_seance WHERE id = ?', ['i1'])
    render(<StatsScreen />)
    expect(await screen.findByText('Aucune séance terminée sur cette période.')).toBeTruthy()
    expect(screen.queryByRole('figure')).toBeNull()
    // L'historique reste disponible (toutes dates)
    expect(screen.getByRole('region', { name: "Historique d'un exercice" })).toBeTruthy()
  })

  it("erreur de lecture : alertes visibles, jamais l'état vide", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reelle = base
    base = { ...reelle, getAll: () => Promise.reject(new Error('base indisponible')) }
    render(<StatsScreen />)
    expect(await screen.findByText('Le chargement des statistiques a échoué.')).toBeTruthy()
    expect(await screen.findByText("Le chargement de l'historique a échoué.")).toBeTruthy()
    expect(screen.queryByText('Aucune séance terminée sur cette période.')).toBeNull()
  })

  it("affiche l'historique de l'exercice en graphique et en tableau", async () => {
    render(<StatsScreen />)
    const section = await screen.findByRole('region', { name: "Historique d'un exercice" })
    const tableau = await within(section).findByRole('table')
    await waitFor(() => expect(within(tableau).getAllByRole('row')).toHaveLength(3))
    expect(texte(tableau)).toMatch(/1 août 2026.*100 kg.*10/)
    expect(texte(tableau)).toMatch(/20 oct\. 2026.*120 kg.*10/)
    expect(within(section).getByRole('combobox', { name: 'Exercice' })).toBeTruthy()
    expect(section.querySelector('svg polyline')).toBeTruthy()
  })
})
