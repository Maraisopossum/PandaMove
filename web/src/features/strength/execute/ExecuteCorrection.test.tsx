// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, Link, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../../core/db/Db'
import { deterministicId } from '../../../core/db/ids'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'

let base: Db
vi.mock('../../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import ExecuteScreen from './ExecuteScreen'
import ReportScreen from '../report/ReportScreen'

afterEach(cleanup)

const commun = { user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null }
const E1 = deterministicId('i1', 'e1')
const LARGE = { timeout: 5000 }

// Séance terminée de 2 séries prévues, dont la première seulement a été validée
beforeEach(async () => {
  base = createTestDb()
  await inserer(base, 'seances', { ...commun, id: 's1', nom: 'Haut du corps', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
  await inserer(base, 'exercises', { ...commun, id: 'x1', name: 'Développé couché' })
  await inserer(base, 'exercices_seance', {
    ...commun, id: E1, seance_id: 's1', exercise_id: 'x1', position: 0, nombre_series_prevues: 2,
    reps_cibles: '8', charge_cible: '60 kg', reps_type: 'REPS', temps_repos_sec: 90, instance_seance_id: 'i1', exercice_source_id: 'e1',
  })
  await inserer(base, 'instances_seance', {
    ...commun, id: 'i1', seance_id: 's1', date: '2026-10-24', notes: '', is_completed: 1, completed_at: '2026-10-24T11:00:00.000Z',
    duration_seconds: 2700, created_at: 'c', started_at: '2026-10-24T10:15:00.000Z', progression_json: '{"evaluee":true,"decisions":{}}',
  })
  await inserer(base, 'series_realisees', {
    ...commun, id: 'r1', instance_seance_id: 'i1', exercice_seance_id: E1, numero_serie: 1, reps_realisees: 8, charge_kg: 60,
    is_completed: 1, notes: '', validated_at: '2026-10-24T10:20:00.000Z',
  })
})

function monter(chemin = '/strength/instance/i1/correct') {
  const routeur = createMemoryRouter(
    [
      {
        path: '/strength/instance/:id',
        element: (
          <>
            <ExecuteScreen />
            <Link to="/calendar">Aller au calendrier</Link>
          </>
        ),
      },
      {
        path: '/strength/instance/:id/correct',
        element: (
          <>
            <ExecuteScreen correction />
            <Link to="/calendar">Aller au calendrier</Link>
          </>
        ),
      },
      { path: '/strength/instance/:id/report', element: <ReportScreen /> },
      { path: '/calendar', element: <p>Calendrier</p> },
    ],
    { initialEntries: [chemin] },
  )
  render(<RouterProvider router={routeur} />)
  return routeur
}

const serie2 = () => within(screen.getByRole('article', { name: 'Développé couché' }))

describe('corriger une séance terminée (Android : icône Modifier du rapport)', () => {
  it('le rapport propose « Corriger la séance » pour une séance terminée', async () => {
    monter('/strength/instance/i1/report')
    const lien = await screen.findByRole('link', { name: 'Corriger la séance' }, LARGE)
    expect(lien.getAttribute('href')).toBe('/strength/instance/i1/correct')
  })

  it('écran de correction : séance terminée mais modifiable, sans Démarrer / Terminer', async () => {
    monter()
    await screen.findByRole('heading', { level: 1, name: 'Haut du corps' }, LARGE)
    expect(screen.getByText('Correction d’une séance terminée')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Démarrer' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Terminer la séance' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Actions de la séance' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Retour au rapport' }).getAttribute('href')).toBe('/strength/instance/i1/report')
    expect(serie2().getByRole('button', { name: 'Valider la série 2' })).toBeTruthy()
  })

  it('valider une série manquante l’écrit sur l’instance, sans toucher à l’horloge ni à l’état « terminée »', async () => {
    monter()
    await screen.findByRole('heading', { level: 1, name: 'Haut du corps' }, LARGE)
    fireEvent.click(serie2().getByRole('button', { name: 'Valider la série 2' }))
    await waitFor(async () => {
      const n = await base.get<{ n: number }>("SELECT COUNT(*) AS n FROM series_realisees WHERE instance_seance_id = 'i1' AND is_completed = 1 AND deleted_at IS NULL")
      expect(n.n).toBe(2)
    }, LARGE)
    const inst = await base.get<{ done: number; s: string | null; d: number }>("SELECT is_completed AS done, started_at AS s, duration_seconds AS d FROM instances_seance WHERE id = 'i1'")
    expect(inst).toEqual({ done: 1, s: '2026-10-24T10:15:00.000Z', d: 2700 })
  })

  it('annuler la validation d’une série la retire (suppression logique)', async () => {
    monter()
    await screen.findByRole('heading', { level: 1, name: 'Haut du corps' }, LARGE)
    fireEvent.click(serie2().getByRole('button', { name: 'Annuler la validation de la série 1' }))
    await waitFor(async () => {
      const d = await base.get<{ d: string | null }>("SELECT deleted_at AS d FROM series_realisees WHERE id = 'r1'")
      expect(d.d).not.toBeNull()
    }, LARGE)
  })

  it('la séance a une série de plus : « Ajouter » écrit sur la ligne d’instance, jamais le modèle', async () => {
    await inserer(base, 'exercices_seance', { ...commun, id: 'e1', seance_id: 's1', exercise_id: 'x1', position: 0, nombre_series_prevues: 2, instance_seance_id: null })
    monter()
    await screen.findByRole('heading', { level: 1, name: 'Haut du corps' }, LARGE)
    fireEvent.click(serie2().getByRole('button', { name: 'Ajouter' }))
    await waitFor(async () => {
      const n = await base.get<{ n: number }>(`SELECT nombre_series_prevues AS n FROM exercices_seance WHERE id = '${E1}'`)
      expect(n.n).toBe(3)
    }, LARGE)
    expect((await base.get<{ n: number }>("SELECT nombre_series_prevues AS n FROM exercices_seance WHERE id = 'e1'")).n).toBe(2)
  })

  it('sortie sans modification : aucun dialogue', async () => {
    const routeur = monter()
    await screen.findByRole('heading', { level: 1, name: 'Haut du corps' }, LARGE)
    fireEvent.click(screen.getByRole('link', { name: 'Aller au calendrier' }))
    await waitFor(() => expect(routeur.state.location.pathname).toBe('/calendar'))
  })

  it('sortie après modification : « Retourner au rapport ? » (Retourner / Continuer à modifier)', { timeout: 20_000 }, async () => {
    const routeur = monter()
    await screen.findByRole('heading', { level: 1, name: 'Haut du corps' }, LARGE)
    fireEvent.click(serie2().getByRole('button', { name: 'Valider la série 2' }))
    await waitFor(() => expect(serie2().getByRole('button', { name: 'Annuler la validation de la série 2' })).toBeTruthy(), LARGE)
    fireEvent.click(screen.getByRole('link', { name: 'Aller au calendrier' }))
    const dialogue = await screen.findByRole('dialog', { name: 'Retourner au rapport ?' }, LARGE)
    expect(within(dialogue).getByText('Les modifications ont été enregistrées automatiquement.')).toBeTruthy()
    expect(document.activeElement).toBe(within(dialogue).getByRole('button', { name: 'Continuer à modifier' }))
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Continuer à modifier' }))
    expect(routeur.state.location.pathname).toBe('/strength/instance/i1/correct')
    fireEvent.click(screen.getByRole('link', { name: 'Aller au calendrier' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Retourner au rapport ?' }, LARGE)).getByRole('button', { name: 'Retourner' }))
    await waitFor(() => expect(routeur.state.location.pathname).toBe('/calendar'))
  })

  it('« Retour au rapport » ne demande rien (tout est déjà enregistré)', async () => {
    const routeur = monter()
    await screen.findByRole('heading', { level: 1, name: 'Haut du corps' }, LARGE)
    fireEvent.click(serie2().getByRole('button', { name: 'Valider la série 2' }))
    await waitFor(() => expect(serie2().getByRole('button', { name: 'Annuler la validation de la série 2' })).toBeTruthy(), LARGE)
    fireEvent.click(screen.getByRole('link', { name: 'Retour au rapport' }))
    await waitFor(() => expect(routeur.state.location.pathname).toBe('/strength/instance/i1/report'))
  })

  it('l’écran normal d’une séance terminée reste en lecture seule', async () => {
    monter('/strength/instance/i1')
    await screen.findByRole('heading', { level: 1, name: 'Haut du corps' }, LARGE)
    expect(screen.queryByRole('button', { name: 'Valider la série 2' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Voir le bilan' })).toBeTruthy()
  })

  it('une séance non terminée ne s’ouvre pas en correction : redirigée vers l’exécution', async () => {
    await base.execute("UPDATE instances_seance SET is_completed = 0, completed_at = NULL WHERE id = 'i1'")
    const routeur = monter()
    await waitFor(() => expect(routeur.state.location.pathname).toBe('/strength/instance/i1'), LARGE)
  })
})
