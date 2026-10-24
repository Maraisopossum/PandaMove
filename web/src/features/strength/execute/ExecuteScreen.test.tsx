// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'

const base = createTestDb()
vi.mock('../../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import ExecuteScreen from './ExecuteScreen'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const commun = { user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null }
await inserer(base, 'seances', { ...commun, id: 's1', nom: 'Haut du corps', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
await inserer(base, 'exercises', { ...commun, id: 'x1', name: 'Développé couché' })
await inserer(base, 'exercises', { ...commun, id: 'x2', name: 'Gainage planche' })
await inserer(base, 'blocs_seance', { ...commun, id: 'b1', seance_id: 's1', nom: 'Bloc principal', position: 0, instance_seance_id: null })
await inserer(base, 'exercices_seance', {
  ...commun, id: 'e1', seance_id: 's1', exercise_id: 'x1', bloc_id: 'b1', position: 0, nombre_series_prevues: 3,
  reps_cibles: '8-10', charge_cible: '60 kg', reps_type: 'REPS', temps_repos_sec: 90, instance_seance_id: null,
})
await inserer(base, 'exercices_seance', {
  ...commun, id: 'e2', seance_id: 's1', exercise_id: 'x2', bloc_id: 'b1', position: 1, nombre_series_prevues: 2,
  reps_cibles: '45s', charge_cible: 'PDC', reps_type: 'DURATION', temps_repos_sec: 60, instance_seance_id: null,
})

async function instance(id: string, terminee = false) {
  await inserer(base, 'instances_seance', {
    ...commun, id, seance_id: 's1', date: '2026-10-24', notes: '', is_completed: terminee ? 1 : 0,
    completed_at: terminee ? '2026-10-24T11:00:00.000Z' : null, duration_seconds: terminee ? 2700 : 0, created_at: 'c',
  })
}

function monter(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/strength/instance/${id}`]}>
      <Routes>
        <Route path="/strength/instance/:id" element={<ExecuteScreen />} />
        <Route path="/strength/instance/:id/report" element={<p>Écran bilan</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const carte = (nom: string) => screen.getByRole('article', { name: nom })
const series = (instanceId: string) =>
  base.getAll<{ id: string; numero_serie: number; reps_realisees: number; charge_kg: number | null; rpe: number | null }>(
    'SELECT id, numero_serie, reps_realisees, charge_kg, rpe FROM series_realisees WHERE instance_seance_id = ? ORDER BY numero_serie',
    [instanceId],
  )

describe('ExecuteScreen', () => {
  it('affiche la séance, les cibles, le chrono et le bouton Démarrer', async () => {
    await instance('i-affiche')
    monter('i-affiche')
    expect(await screen.findByRole('heading', { level: 1, name: 'Haut du corps' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Bloc principal' })).toBeTruthy()
    const chrono = screen.getByRole('timer')
    expect(chrono.textContent).toBe('00:00')
    expect(chrono.getAttribute('aria-live')).toBe('off')
    expect(chrono.getAttribute('aria-label')).toBe('Temps écoulé : moins d’une minute')
    expect(screen.getByRole('button', { name: 'Démarrer' })).toBeTruthy()
    expect(within(carte('Développé couché')).getByText('3 séries × 8-10 · 60 kg · repos 90 s')).toBeTruthy()
    // DURATION : le champ est libellé en secondes
    expect(within(carte('Gainage planche')).getByLabelText('Durée (s)')).toBeTruthy()
    expect(within(carte('Développé couché')).getByLabelText('Répétitions')).toBeTruthy()
    // Panda de motivation avant le démarrage, décoratif
    await waitFor(() => expect(document.querySelector('img.execution__panda')).not.toBeNull())
    expect(document.querySelector('img.execution__panda')!.getAttribute('alt')).toBe('')
    expect(document.querySelector('img.execution__panda')!.getAttribute('src')).toMatch(/^\/panda\/motivation-male-sm\.webp$/)
  })

  it('démarre, valide une série avec une charge décimale « 17,5 » puis la corrige en place', async () => {
    await instance('i-saisie')
    monter('i-saisie')
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer' }))
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeTruthy()
    // Séance démarrée : le panda de motivation laisse la place à la saisie
    expect(document.querySelector('.execution__panda')).toBeNull()

    const dc = carte('Développé couché')
    fireEvent.change(within(dc).getByLabelText('Répétitions'), { target: { value: '8' } })
    fireEvent.change(within(dc).getByLabelText('Charge (kg)'), { target: { value: '17,5' } })
    fireEvent.change(within(dc).getByLabelText('RPE (facultatif)'), { target: { value: '8' } })
    fireEvent.click(within(dc).getByRole('button', { name: 'Valider la série' }))

    await waitFor(async () => expect(await series('i-saisie')).toMatchObject([{ numero_serie: 1, reps_realisees: 8, charge_kg: 17.5, rpe: 8 }]))
    const ligne = await within(dc).findByRole('group', { name: 'Série 1' })
    expect(await screen.findByText(/^Repos : /)).toBeTruthy()

    fireEvent.change(within(ligne).getByLabelText('Répétitions'), { target: { value: '7' } })
    fireEvent.click(within(ligne).getByRole('button', { name: 'Corriger la série 1' }))
    await waitFor(async () => expect(await series('i-saisie')).toMatchObject([{ numero_serie: 1, reps_realisees: 7, charge_kg: 17.5 }]))
    expect(await series('i-saisie')).toHaveLength(1)
  })

  it('affiche une erreur de saisie en français', async () => {
    await instance('i-erreur')
    monter('i-erreur')
    const dc = await screen.findByRole('article', { name: 'Développé couché' })
    fireEvent.click(within(dc).getByRole('button', { name: 'Valider la série' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Saisissez un nombre de répétitions entier.')
  })

  it('pause puis reprise', async () => {
    await instance('i-pause')
    monter('i-pause')
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Pause' }))
    expect(await screen.findByRole('button', { name: 'Reprendre' })).toBeTruthy()
    expect(screen.getByText('En pause')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre' }))
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeTruthy()
  })

  it('« Terminer la séance » demande confirmation puis ouvre le bilan', async () => {
    await instance('i-fin')
    monter('i-fin')
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer' }))
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    fireEvent.click(await screen.findByRole('button', { name: 'Terminer la séance' }))
    expect(confirmer).toHaveBeenCalledTimes(1)
    const ligne = () => base.get<{ is_completed: number }>("SELECT is_completed FROM instances_seance WHERE id = 'i-fin'")
    expect((await ligne()).is_completed).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }))
    expect(await screen.findByText('Écran bilan')).toBeTruthy()
    expect((await ligne()).is_completed).toBe(1)
  })

  it('une séance terminée est affichée en lecture seule', async () => {
    await instance('i-terminee', true)
    monter('i-terminee')
    expect(await screen.findByText('Séance terminée')).toBeTruthy()
    expect(screen.getByRole('timer').textContent).toBe('45:00')
    expect(screen.queryByRole('button', { name: 'Démarrer' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Valider la série' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Voir le bilan' }).getAttribute('href')).toBe('/strength/instance/i-terminee/report')
  })
})
