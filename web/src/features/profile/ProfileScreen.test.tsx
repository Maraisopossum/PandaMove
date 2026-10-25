// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDb } from '../../test/sqliteDb'

const telecharger = vi.fn()
const base = createTestDb()
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: '11111111-1111-4111-8111-111111111111' } } }),
}))
vi.mock('../../core/export/fichier', async (original) => ({
  ...(await original<typeof import('../../core/export/fichier')>()),
  telechargerJson: (nom: string, contenu: string) => telecharger(nom, contenu),
}))

import ProfileScreen from './ProfileScreen'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  telecharger.mockReset()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const afficher = () =>
  render(
    <MemoryRouter>
      <ProfileScreen />
    </MemoryRouter>,
  )

describe('ProfileScreen — sauvegarde', () => {
  it("explique la sauvegarde locale et propose « Exporter mes données »", () => {
    afficher()
    expect(screen.getByRole('heading', { name: 'Sauvegarde' })).toBeTruthy()
    expect(screen.getByText(/hors des services tiers/)).toBeTruthy()
    const bouton = screen.getByRole('button', { name: 'Exporter mes données' })
    expect(bouton.className).toContain('bouton') // .bouton : cible tactile 44 px
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('exporter : télécharge le fichier du jour et annonce le résultat dans role=status', async () => {
    afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Exporter mes données' }))
    await waitFor(() => expect(telecharger).toHaveBeenCalledTimes(1))
    const [nom] = telecharger.mock.calls[0] as [string, string]
    expect(nom).toMatch(/^pandamove-export-\d{4}-\d{2}-\d{2}\.json$/)
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain(nom))
    expect((screen.getByRole('button', { name: 'Exporter mes données' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('erreur : message dans role=alert, bouton de nouveau actif', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    telecharger.mockImplementation(() => {
      throw new Error('bloqué')
    })
    afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Exporter mes données' }))
    const alerte = await screen.findByRole('alert')
    expect(alerte.textContent).toBe("L'export a échoué : aucun fichier n'a été créé. Réessayez.")
    expect((screen.getByRole('button', { name: 'Exporter mes données' }) as HTMLButtonElement).disabled).toBe(false)
    vi.restoreAllMocks()
  })

  it('pendant la génération : bouton désactivé et occupé', async () => {
    let liberer: () => void = () => {}
    telecharger.mockImplementation(() => {})
    const getAll = base.getAll
    const attente = new Promise<void>((r) => {
      liberer = r
    })
    base.getAll = async (sql, params) => {
      await attente
      return getAll(sql, params)
    }
    try {
      afficher()
      const bouton = screen.getByRole('button', { name: 'Exporter mes données' }) as HTMLButtonElement
      fireEvent.click(bouton)
      await waitFor(() => expect(bouton.disabled).toBe(true))
      expect(bouton.getAttribute('aria-busy')).toBe('true')
      expect(screen.getByRole('status').textContent).toMatch(/Préparation/)
    } finally {
      liberer()
      base.getAll = getAll
    }
    await waitFor(() => expect(telecharger).toHaveBeenCalled())
  })
})
