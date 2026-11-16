// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDb } from '../../test/sqliteDb'

const telecharger = vi.fn()
const updatePassword = vi.fn()
const base = createTestDb()
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: '11111111-1111-4111-8111-111111111111' } }, updatePassword }),
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

describe('ProfileScreen — séance', () => {
  it('section « Séance » : réglages Son, Vibration, Voix mémorisés par appareil', () => {
    afficher()
    expect(screen.getByRole('heading', { name: 'Séance' })).toBeTruthy()
    fireEvent.click(screen.getByRole('switch', { name: 'Voix' }))
    expect(JSON.parse(localStorage.getItem('pandamove.circuit.reglages')!)).toMatchObject({ son: true, vibration: true, voix: true })
  })
})

describe('ProfileScreen — sauvegarde', () => {
  it('ne propose plus d’export ici : un renvoi vers Outils, Mes données (la sauvegarde y est unique)', () => {
    afficher()
    expect(screen.queryByRole('button', { name: 'Exporter mes données' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Sauvegarde et export' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ouvrir Mes données' }).getAttribute('href')).toBe('/outils/donnees')
  })
})

describe('ProfileScreen — mot de passe', () => {
  const saisir = (nouveau: string, confirmation: string) => {
    afficher()
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: nouveau } })
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: confirmation } })
    fireEvent.submit(screen.getByRole('button', { name: 'Modifier le mot de passe' }).closest('form')!)
  }
  it('refuse deux saisies différentes', async () => {
    updatePassword.mockReset()
    saisir('motdepasse1', 'motdepasse2')
    expect((await screen.findByRole('alert')).textContent).toContain('pas identiques')
    expect(updatePassword).not.toHaveBeenCalled()
  })
  it('change le mot de passe et confirme', async () => {
    updatePassword.mockReset().mockResolvedValue(undefined)
    saisir('motdepasse1', 'motdepasse1')
    expect(await screen.findByText('Mot de passe modifié.')).toBeTruthy()
    await waitFor(() => expect(updatePassword).toHaveBeenCalledWith('motdepasse1'))
  })
})
