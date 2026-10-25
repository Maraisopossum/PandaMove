// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'

let base: Db
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import SeanceListScreen from './SeanceListScreen'

beforeEach(() => {
  base = createTestDb()
})
afterEach(cleanup)

async function seance(id: string, nom: string, extra: Record<string, unknown> = {}) {
  await inserer(base, 'seances', {
    id, user_id: 'u1', updated_at: 'u', deleted_at: null, nom, groupes_musculaires: '["DOS"]',
    duree_estimee_min: 45, notes: '', seance_category: 'STRENGTH', created_at: 'c', is_archived: 0, ...extra,
  })
}

function monter() {
  return render(
    <MemoryRouter initialEntries={['/strength']}>
      <Routes>
        <Route path="/strength" element={<SeanceListScreen />} />
        <Route path="/strength/new" element={<p>Écran création</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('états de la liste des séances types', () => {
  it('aucune séance : panda, explication de ce qu\'est une séance type et bouton de création', async () => {
    monter()
    expect(await screen.findByText("Aucune séance type pour l'instant.")).toBeTruthy()
    expect(screen.getByText(/modèle réutilisable/)).toBeTruthy()
    await waitFor(() => expect(document.querySelector('img.calendrier__panda')).not.toBeNull())
    fireEvent.click(screen.getByRole('link', { name: 'Créer ma première séance' }))
    expect(await screen.findByText('Écran création')).toBeTruthy()
    // Pas de champ de recherche inutile
    expect(screen.queryByLabelText('Rechercher une séance')).toBeNull()
  })

  it('seules des séances archivées : message dédié et section des archives', async () => {
    await seance('a1', 'Ancienne', { is_archived: 1 })
    monter()
    expect(await screen.findByText(/Aucune séance type active/)).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Séances archivées' })).toBeTruthy()
    expect(screen.queryByText("Aucune séance type pour l'instant.")).toBeNull()
  })

  it('une séance directe n\'apparaît jamais parmi les modèles', async () => {
    await seance('d1', 'Directe', { seance_category: 'STRENGTH_ONESHOT' })
    monter()
    expect(await screen.findByText("Aucune séance type pour l'instant.")).toBeTruthy()
    expect(screen.queryByText('Directe')).toBeNull()
  })

  it('recherche : absente sous 6 modèles, présente ensuite ; filtre sans accent ni casse, message si rien ne correspond', async () => {
    for (let i = 1; i <= 5; i++) await seance(`s${i}`, `Séance ${i}`)
    const { unmount } = monter()
    await screen.findByText('Séance 1')
    expect(screen.queryByLabelText('Rechercher une séance')).toBeNull()
    unmount()
    cleanup()

    await seance('s6', 'Épaules lourdes', { groupes_musculaires: '["EPAULES"]' })
    monter()
    const champ = await screen.findByLabelText('Rechercher une séance')
    fireEvent.change(champ, { target: { value: 'EPAULE' } })
    expect(screen.getByText('Épaules lourdes')).toBeTruthy()
    expect(screen.queryByText('Séance 1')).toBeNull()
    fireEvent.change(champ, { target: { value: 'zzz' } })
    expect(screen.getByText('Aucune séance ne correspond à « zzz ».')).toBeTruthy()
    fireEvent.change(champ, { target: { value: '' } })
    expect(screen.getByText('Séance 1')).toBeTruthy()
  })

  it('les notes de la séance s\'affichent sur la carte', async () => {
    await seance('n1', 'Avec note', { notes: 'Tempo lent sur la descente' })
    monter()
    expect(await screen.findByText('Tempo lent sur la descente')).toBeTruthy()
  })
})
