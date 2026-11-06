// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'

const base = createTestDb()
vi.mock('../../core/db/client', () => ({ getDb: () => base }))

import { OngletsSeances } from './OngletsSeances'

afterEach(cleanup)

const afficher = (actif: Parameters<typeof OngletsSeances>[0]['actif'], comptes?: Parameters<typeof OngletsSeances>[0]['comptes']) =>
  render(
    <MemoryRouter>
      <OngletsSeances actif={actif} comptes={comptes} />
    </MemoryRouter>,
  )

describe('OngletsSeances', () => {
  it('lie les trois vues existantes et marque la vue courante', () => {
    afficher('programmees')
    const liens = screen.getAllByRole('link')
    expect(liens.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Types', '/strength'],
      ['Programmées', '/strength/planned'],
      ['Terminées', '/strength/done'],
    ])
    expect(liens.filter((l) => l.getAttribute('aria-current') === 'page').map((l) => l.textContent)).toEqual(['Programmées'])
  })

  it('affiche les effectifs quand ils sont connus', () => {
    afficher('types', { types: 4, programmees: 2, terminees: 12 })
    expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual(['Types4', 'Programmées2', 'Terminées12'])
  })

  it('sans effectifs fournis, les lit dans la base (même nombres que les listes)', async () => {
    const c = { user_id: 'u1', updated_at: 'u0', deleted_at: null }
    await inserer(base, 'seances', { ...c, id: 'sa', nom: 'Pull', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
    await inserer(base, 'seances', { ...c, id: 'sb', nom: 'Push', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
    await inserer(base, 'seances', { ...c, id: 'sc', nom: 'Archivée', is_archived: 1, seance_category: 'STRENGTH', created_at: 'c' })
    await inserer(base, 'instances_seance', { ...c, id: 'p1', seance_id: 'sa', date: '2026-11-09', is_completed: 0 })
    await inserer(base, 'instances_seance', { ...c, id: 'f1', seance_id: 'sa', date: '2026-11-02', is_completed: 1, duration_seconds: 3000 })
    await inserer(base, 'instances_seance', { ...c, id: 'f2', seance_id: 'sb', date: '2026-11-03', is_completed: 1, duration_seconds: 3000 })
    afficher('programmees')
    await waitFor(() => expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual(['Types2', 'Programmées1', 'Terminées2']))
  })
})
