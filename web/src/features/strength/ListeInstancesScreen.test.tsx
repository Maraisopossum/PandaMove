// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'

let base: Db
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import ListeInstancesScreen from './ListeInstancesScreen'

const b = { user_id: 'u1', updated_at: 'u0', deleted_at: null }

beforeEach(() => {
  base = createTestDb()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function semer() {
  await inserer(base, 'seances', { ...b, id: 's1', nom: 'Pull', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
  await inserer(base, 'seances', { ...b, id: 's2', nom: 'Jambes', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c', deleted_at: 'x' })
  await inserer(base, 'instances_seance', { ...b, id: 'plan', seance_id: 's1', date: '2026-10-26', is_completed: 0 })
  await inserer(base, 'instances_seance', {
    ...b, id: 'cours', seance_id: 's2', date: '2026-10-24', is_completed: 0, started_at: '2026-10-24T08:00:00.000Z',
  })
  await inserer(base, 'instances_seance', { ...b, id: 'fait', seance_id: 's1', date: '2026-10-05', is_completed: 1, duration_seconds: 2700 })
  await inserer(base, 'series_realisees', {
    ...b, id: 'x1', instance_seance_id: 'fait', exercice_seance_id: 'e1', numero_serie: 1, is_completed: 1,
  })
}

function monter(type: 'programmees' | 'terminees') {
  return render(
    <MemoryRouter initialEntries={['/liste']}>
      <Routes>
        <Route path="/liste" element={<ListeInstancesScreen type={type} />} />
        <Route path="/strength" element={<p>Écran séances types</p>} />
        <Route path="/strength/instance/:id" element={<p>Écran exécution</p>} />
        <Route path="/strength/instance/:id/report" element={<p>Écran bilan</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Séances programmées', () => {
  it('liste sémantique, date croissante, date en français, badge « En cours », lien vers l’exécution', async () => {
    await semer()
    monter('programmees')
    expect(screen.getByRole('heading', { level: 1, name: 'Séances programmées' })).toBeTruthy()
    const liste = await screen.findByRole('list')
    const liens = within(liste).getAllByRole('link')
    expect(liens.map((l) => l.getAttribute('href'))).toEqual(['/strength/instance/cours', '/strength/instance/plan'])
    expect(liens[0].textContent).toContain('Jambes')
    expect(liens[0].textContent).toContain('sam. 24 oct.')
    expect(within(liens[0]).getByText('En cours')).toBeTruthy()
    expect(liens[1].textContent).toContain('lun. 26 oct.')
    expect(within(liens[1]).queryByText('En cours')).toBeNull()
    expect(document.body.textContent).not.toContain('📅')
    fireEvent.click(liens[1])
    expect(await screen.findByText('Écran exécution')).toBeTruthy()
  })

  it('état vide : panda assis et lien vers les séances types', async () => {
    monter('programmees')
    expect(await screen.findByText('Aucune séance programmée.')).toBeTruthy()
    await waitFor(() => expect(document.querySelector('img.calendrier__panda')).not.toBeNull())
    expect(document.querySelector('img.calendrier__panda')!.getAttribute('src')).toMatch(/pose_sitting|sitting/)
    expect(screen.getByRole('link', { name: 'Voir les séances types' }).getAttribute('href')).toBe('/strength')
  })

  it("erreur : alerte sans faux état vide ; « Réessayer » efface l'erreur et relit", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await semer()
    const vraie = base
    let panne = true
    base = { ...vraie, getAll: (sql, params) => (panne ? Promise.reject(new Error('HS')) : vraie.getAll(sql, params)) }
    monter('programmees')
    expect((await screen.findByRole('alert')).textContent).toBe('Le chargement des séances a échoué.')
    expect(screen.queryByText('Aucune séance programmée.')).toBeNull()
    panne = false
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByText('Pull')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('Séances terminées', () => {
  it('nom, date, durée et séries validées ; lien vers le bilan', async () => {
    await semer()
    monter('terminees')
    expect(screen.getByRole('heading', { level: 1, name: 'Séances terminées' })).toBeTruthy()
    const liens = within(await screen.findByRole('list')).getAllByRole('link')
    expect(liens).toHaveLength(1)
    expect(liens[0].getAttribute('href')).toBe('/strength/instance/fait/report')
    expect(liens[0].textContent).toContain('Pull')
    expect(liens[0].textContent).toContain('lun. 5 oct. · 45 min · 1 série validée')
  })

  it('état vide', async () => {
    monter('terminees')
    expect(await screen.findByText('Aucune séance terminée pour le moment.')).toBeTruthy()
  })
})
