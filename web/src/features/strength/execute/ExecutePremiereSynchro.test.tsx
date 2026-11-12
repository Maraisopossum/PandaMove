// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'

// Appareil neuf : la base locale est vide au premier rendu, la séance arrive avec la première synchronisation.
// `waitForFirstSync` (PowerSync) est simulé par une promesse que chaque test résout à la main.
let terminerSynchro: () => void = () => {}
const base = Object.assign(createTestDb(), {
  waitForFirstSync: vi.fn(
    () =>
      new Promise<void>((resolve) => {
        terminerSynchro = resolve
      }),
  ),
})
vi.mock('../../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import ReportScreen from '../report/ReportScreen'
import ExecuteScreen from './ExecuteScreen'

beforeEach(() => {
  base.waitForFirstSync.mockClear()
})
afterEach(() => {
  cleanup()
})

const commun = { user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null }
await inserer(base, 'exercises', { ...commun, id: 'x1', name: 'Développé couché' })
await inserer(base, 'exercises', { ...commun, id: 'x2', name: 'Gainage planche' })

// Ce que la synchronisation apporte : le modèle (2 exercices) et la séance jouée sur l'autre appareil, avec SES
// lignes (un seul exercice, 3 séries prévues) et ses 3 séries validées.
async function recevoirSeanceJouee(id: string, { terminee = false } = {}) {
  const seanceId = `s-${id}`
  await inserer(base, 'seances', { ...commun, id: seanceId, nom: 'Haut du corps', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
  const exercice = (exId: string, champs: Record<string, unknown>) =>
    inserer(base, 'exercices_seance', {
      ...commun, id: exId, seance_id: seanceId, bloc_id: null, nombre_series_prevues: 3, reps_cibles: '8', charge_cible: '50 kg',
      reps_type: 'REPS', temps_repos_sec: 90, ...champs,
    })
  await exercice(`${id}-m1`, { exercise_id: 'x1', position: 0, instance_seance_id: null })
  await exercice(`${id}-m2`, { exercise_id: 'x2', position: 1, instance_seance_id: null })
  await inserer(base, 'instances_seance', {
    ...commun, id, seance_id: seanceId, date: '2026-11-12', notes: '', is_completed: terminee ? 1 : 0,
    completed_at: terminee ? '2026-11-12T11:00:00.000Z' : null, duration_seconds: terminee ? 1800 : 0, created_at: 'c',
    started_at: '2026-11-12T10:30:00.000Z', progression_json: terminee ? '{"evaluee":true,"decisions":{}}' : null,
  })
  await exercice(`${id}-j1`, { exercise_id: 'x1', position: 0, instance_seance_id: id, exercice_source_id: `${id}-m1` })
  for (const numero of [1, 2, 3]) {
    await inserer(base, 'series_realisees', {
      ...commun, id: `${id}-serie-${numero}`, instance_seance_id: id, exercice_seance_id: `${id}-j1`, numero_serie: numero,
      reps_realisees: 8, charge_kg: 50, rpe: null, notes: '', is_completed: 1,
    })
  }
}

const lignesInstance = (id: string) =>
  base.getAll<{ id: string }>('SELECT id FROM exercices_seance WHERE instance_seance_id = ? AND deleted_at IS NULL', [id])

function monter(chemin: string) {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route path="/strength/instance/:id" element={<ExecuteScreen />} />
        <Route path="/strength/instance/:id/correct" element={<ExecuteScreen correction />} />
        <Route path="/strength/instance/:id/report" element={<ReportScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Ouverture d’une séance avant la fin de la première synchronisation', () => {
  it('exécution : « Chargement… » au lieu de « Séance introuvable », puis la séance reçue, sans recopier le modèle', async () => {
    monter('/strength/instance/i-exec')
    expect(screen.getByText('Chargement…')).toBeTruthy()
    await vi.waitFor(() => expect(base.waitForFirstSync).toHaveBeenCalled())
    expect(screen.getByText('Chargement…')).toBeTruthy()
    expect(screen.queryByText('Séance introuvable.')).toBeNull()
    expect(screen.queryByText('Aucun exercice enregistré pour cette séance.')).toBeNull()

    await recevoirSeanceJouee('i-exec')
    await act(async () => terminerSynchro())

    expect(await screen.findByRole('heading', { level: 1, name: 'Haut du corps' })).toBeTruthy()
    expect(screen.getByRole('article', { name: 'Développé couché' })).toBeTruthy()
    expect(screen.queryByRole('article', { name: 'Gainage planche' })).toBeNull()
    // Isolation : seules les lignes de la séance jouée, aucune copie du modèle ajoutée
    expect((await lignesInstance('i-exec')).map((l) => l.id)).toEqual(['i-exec-j1'])
  })

  it('exécution : une séance prévue reçue sans ses lignes n’est copiée qu’après la synchronisation', async () => {
    await inserer(base, 'seances', { ...commun, id: 's-prevue', nom: 'Bas du corps', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
    await inserer(base, 'exercices_seance', {
      ...commun, id: 'prevue-m1', seance_id: 's-prevue', exercise_id: 'x2', bloc_id: null, position: 0, nombre_series_prevues: 2,
      reps_cibles: '45', charge_cible: 'PDC', reps_type: 'DURATION', temps_repos_sec: 60, instance_seance_id: null,
    })
    await inserer(base, 'instances_seance', {
      ...commun, id: 'i-prevue', seance_id: 's-prevue', date: '2026-11-12', notes: '', is_completed: 0, completed_at: null,
      duration_seconds: 0, created_at: 'c',
    })
    monter('/strength/instance/i-prevue')
    await vi.waitFor(() => expect(base.waitForFirstSync).toHaveBeenCalled())
    expect(screen.getByText('Chargement…')).toBeTruthy()
    expect(await lignesInstance('i-prevue')).toHaveLength(0)

    await act(async () => terminerSynchro())
    expect(await screen.findByRole('article', { name: 'Gainage planche' })).toBeTruthy()
    expect(await lignesInstance('i-prevue')).toHaveLength(1)
  })

  it('exécution : séance toujours absente après la synchronisation -> « Séance introuvable. »', async () => {
    monter('/strength/instance/i-absente')
    await vi.waitFor(() => expect(base.waitForFirstSync).toHaveBeenCalled())
    await act(async () => terminerSynchro())
    expect(await screen.findByText('Séance introuvable.')).toBeTruthy()
  })

  it('séance complète en local : ouverture sans attendre la synchronisation', async () => {
    await recevoirSeanceJouee('i-locale')
    monter('/strength/instance/i-locale')
    expect(await screen.findByRole('article', { name: 'Développé couché' })).toBeTruthy()
    expect(base.waitForFirstSync).not.toHaveBeenCalled()
  })

  it('correction : même attente, puis la séance terminée reçue', async () => {
    monter('/strength/instance/i-corr/correct')
    await vi.waitFor(() => expect(base.waitForFirstSync).toHaveBeenCalled())
    expect(screen.getByText('Chargement…')).toBeTruthy()

    await recevoirSeanceJouee('i-corr', { terminee: true })
    await act(async () => terminerSynchro())

    expect(await screen.findByText('Correction d’une séance terminée')).toBeTruthy()
    expect(screen.getByRole('article', { name: 'Développé couché' })).toBeTruthy()
    expect((await lignesInstance('i-corr')).map((l) => l.id)).toEqual(['i-corr-j1'])
  })

  it('rapport : « Chargement… » jusqu’à la synchronisation, puis le bilan de la séance reçue', async () => {
    monter('/strength/instance/i-bilan/report')
    await vi.waitFor(() => expect(base.waitForFirstSync).toHaveBeenCalled())
    expect(screen.getByText('Chargement…')).toBeTruthy()

    await recevoirSeanceJouee('i-bilan', { terminee: true })
    await act(async () => terminerSynchro())

    expect(await screen.findByText('Développé couché')).toBeTruthy()
    expect(screen.queryByText('Séance introuvable.')).toBeNull()
  })
})
