// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { saveSettings } from '../../core/db/repos/settings'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'

const base = createTestDb()
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import HomeScreen from './HomeScreen'

afterEach(cleanup)

describe('HomeScreen', () => {
  it('affiche le panda de la variante choisie dans le profil et les accès rapides', async () => {
    await saveSettings(base, 'u1', { pandaVariant: 'female' })
    render(
      <MemoryRouter>
        <HomeScreen />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Accueil' })).toBeTruthy()
    const panda = await screen.findByRole('img', { name: 'Panda joyeux, bras ouverts' })
    expect(panda.getAttribute('src')).toBe('/panda/joy-female-sm.webp')
    expect(panda.getAttribute('srcset')).toBe('/panda/joy-female-sm.webp 320w, /panda/joy-female-lg.webp 640w')
    expect(panda.getAttribute('loading')).toBe('lazy')
    expect([panda.getAttribute('width'), panda.getAttribute('height')]).toEqual(['320', '480'])
    expect(screen.getByRole('link', { name: 'Renforcement' }).getAttribute('href')).toBe('/strength')
    expect(screen.getByRole('link', { name: 'Calendrier' }).getAttribute('href')).toBe('/calendar')
  })

  it('affiche la carte « Pour commencer » tant qu’aucune séance n’existe, puis plus du tout', async () => {
    render(
      <MemoryRouter>
        <HomeScreen />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { level: 2, name: 'Pour commencer' })).toBeTruthy()
    cleanup()
    await inserer(base, 'seances', { id: 's1', user_id: 'u1', updated_at: 'u', deleted_at: null, nom: 'Pull', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
    render(
      <MemoryRouter>
        <HomeScreen />
      </MemoryRouter>,
    )
    await screen.findByRole('link', { name: 'Renforcement' })
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.queryByRole('heading', { name: 'Pour commencer' })).toBeNull()
  })
})
