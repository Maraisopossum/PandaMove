// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'

const base = createTestDb()
vi.mock('../../../core/db/client', () => ({ getDb: () => base }))

import { BandeauSeanceActive } from './BandeauSeanceActive'

afterEach(cleanup)

const commun = { user_id: 'u1', updated_at: 'u', deleted_at: null }
await inserer(base, 'seances', { ...commun, id: 's1', nom: 'Haut du corps', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
const debut = new Date(Date.now() - 5 * 60_000).toISOString()
await inserer(base, 'instances_seance', {
  ...commun, id: 'i-active', seance_id: 's1', date: '2026-10-24', notes: '', is_completed: 0, completed_at: null, duration_seconds: 0, created_at: 'c', started_at: debut,
})
await inserer(base, 'instances_seance', {
  ...commun, id: 'i-finie', seance_id: 's1', date: '2026-10-24', notes: '', is_completed: 1, completed_at: debut, duration_seconds: 10, created_at: 'c', started_at: debut,
})

const monter = (chemin: string) =>
  render(
    <MemoryRouter initialEntries={[chemin]}>
      <BandeauSeanceActive />
    </MemoryRouter>,
  )

describe('BandeauSeanceActive', () => {
  it('propose de reprendre la séance démarrée et non terminée, avec son chrono', async () => {
    monter('/strength/planned')
    const bandeau = await screen.findByRole('region', { name: 'Séance en cours' })
    expect(bandeau.textContent).toContain('Haut du corps')
    expect(bandeau.querySelector('[role="timer"]')!.textContent).toMatch(/^0[45]:\d\d$/)
    expect(screen.getByRole('link', { name: 'Reprendre' }).getAttribute('href')).toBe('/strength/instance/i-active')
  })

  it("n'apparaît pas sur l'écran de la séance elle-même", async () => {
    monter('/strength/instance/i-active')
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('region', { name: 'Séance en cours' })).toBeNull()
  })
})
