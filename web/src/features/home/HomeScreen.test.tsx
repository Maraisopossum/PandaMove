// @vitest-environment jsdom
import { cleanup, within, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    // Les six modules sont accessibles depuis l'accueil, chacun avec sa pastille décorative
    const acces = screen.getByRole('navigation', { name: 'Accès rapides' })
    expect(within(acces).getAllByRole('link').map((l) => [l.getAttribute('aria-label'), l.getAttribute('href')])).toEqual([
      ['Renforcement', '/strength'], ['Course', '/running'], ['Vélo', '/cycling'],
      ['Calendrier', '/calendar'], ['Statistiques', '/stats'], ['Respiration', '/breathing'],
    ])
    for (const img of acces.querySelectorAll('img')) expect(img.getAttribute('alt')).toBe('')
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

  describe('agenda : prochaine séance et rythme de la semaine', () => {
    const b = { user_id: 'u1', updated_at: 'u0', deleted_at: null }

    beforeEach(() => {
      // Seule l'horloge est simulée (jeudi 5 novembre 2026) : les minuteries réelles servent à findBy / waitFor
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(2026, 10, 5, 9, 0))
    })
    afterEach(() => vi.useRealTimers())

    const monter = () =>
      render(
        <MemoryRouter>
          <HomeScreen />
        </MemoryRouter>,
      )

    it('montre la prochaine séance avec un lien d’exécution, et la semaine avec ses jours faits et prévus', async () => {
      await inserer(base, 'seances', { ...b, id: 'sa', nom: 'Haut du corps A', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
      await inserer(base, 'instances_seance', { ...b, id: 'faite', seance_id: 'sa', date: '2026-11-02', is_completed: 1, duration_seconds: 3000 })
      await inserer(base, 'instances_seance', { ...b, id: 'du-jour', seance_id: 'sa', date: '2026-11-05', is_completed: 0 })
      monter()
      const section = await screen.findByRole('region', { name: 'Prochaine séance' })
      expect(within(section).getByText('Haut du corps A')).toBeTruthy()
      expect(within(section).getByText('Aujourd’hui')).toBeTruthy()
      expect(within(section).getByRole('link', { name: /Commencer/ }).getAttribute('href')).toBe('/strength/instance/du-jour')

      const semaine = screen.getByRole('region', { name: 'Cette semaine' })
      const jours = within(semaine).getAllByRole('listitem')
      expect(jours).toHaveLength(7)
      expect(jours[0].textContent).toContain('séance terminée')
      expect(jours[3].textContent).toContain('séance prévue')
      expect(jours[3].className).toContain('accueil__jour--auj')
      expect(semaine.textContent).toContain('1 terminée sur 2')
    })
  })
})
