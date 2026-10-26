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

beforeEach(async () => {
  base = createTestDb()
  await inserer(base, 'seances', { ...b, id: 's1', nom: 'Pull', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
  await inserer(base, 'instances_seance', { ...b, id: 'plan', seance_id: 's1', date: '2026-10-26', is_completed: 0 })
  await inserer(base, 'instances_seance', { ...b, id: 'fait', seance_id: 's1', date: '2026-10-05', is_completed: 1, duration_seconds: 2700 })
})
afterEach(cleanup)

function monter(type: 'programmees' | 'terminees') {
  return render(
    <MemoryRouter initialEntries={['/liste']}>
      <Routes>
        <Route path="/liste" element={<ListeInstancesScreen type={type} />} />
      </Routes>
    </MemoryRouter>,
  )
}

const ligne = async (id: string) => base.get<{ date: string; deleted_at: string | null }>('SELECT date, deleted_at FROM instances_seance WHERE id = ?', [id])

describe('Séances programmées : actions', () => {
  it('changer la date : dialogue, focus sur le champ date, la date est enregistrée et la liste relue', async () => {
    monter('programmees')
    const declencheur = await screen.findByRole('button', { name: 'Changer la date de Pull du lun. 26 oct.' })
    declencheur.focus()
    fireEvent.click(declencheur)
    const dialogue = await screen.findByRole('dialog')
    const champ = within(dialogue).getByLabelText('Nouvelle date') as HTMLInputElement
    expect(champ.value).toBe('2026-10-26')
    await waitFor(() => expect(document.activeElement).toBe(champ))
    fireEvent.change(champ, { target: { value: '2026-11-03' } })
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Confirmer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect((await ligne('plan')).date).toBe('2026-11-03')
    expect(await screen.findByText(/mar\. 3 nov\./)).toBeTruthy()
  })

  it('date invalide : message français, dialogue ouvert, rien écrit', async () => {
    monter('programmees')
    fireEvent.click(await screen.findByRole('button', { name: 'Changer la date de Pull du lun. 26 oct.' }))
    fireEvent.change(await screen.findByLabelText('Nouvelle date'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Date invalide')
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect((await ligne('plan')).date).toBe('2026-10-26')
  })

  it('supprimer : focus initial sur Annuler, Annuler ne supprime rien, Supprimer fait un tombstone', async () => {
    monter('programmees')
    const declencheur = await screen.findByRole('button', { name: 'Supprimer Pull du lun. 26 oct.' })
    fireEvent.click(declencheur)
    const annuler = await screen.findByRole('button', { name: 'Annuler' })
    await waitFor(() => expect(document.activeElement).toBe(annuler))
    fireEvent.click(annuler)
    expect((await ligne('plan')).deleted_at).toBeNull()

    fireEvent.click(declencheur)
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect((await ligne('plan')).deleted_at).not.toBeNull()
    expect(await screen.findByText('Aucune séance programmée.')).toBeTruthy()
  })
})

describe('Séances terminées : actions', () => {
  it('pas de changement de date (elle ancre les statistiques) ; suppression avec confirmation', async () => {
    monter('terminees')
    await screen.findByText('Pull')
    expect(screen.queryByRole('button', { name: /Changer la date/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer Pull du lun. 5 oct.' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect((await ligne('fait')).deleted_at).not.toBeNull()
    expect((await ligne('plan')).deleted_at).toBeNull()
  })
})
