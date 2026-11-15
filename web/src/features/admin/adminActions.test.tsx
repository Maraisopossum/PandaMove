// @vitest-environment jsdom
import type { Session } from '@supabase/auth-js'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { executerAction } from '../../core/admin/admin'
import type { ClientSupabase } from '../../core/db/clientSupabase'

let client: ClientSupabase & { appelerFonction: ReturnType<typeof vi.fn>; rpc: ReturnType<typeof vi.fn> }
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'moi', app_metadata: { role: 'admin' } } } as unknown as Session }) }))
vi.mock('../../core/db/client', () => ({ getSupabase: () => client }))

import AdminComptesScreen from './AdminComptesScreen'

const COMPTES = [
  { user_id: 'moi', email: 'moi@exemple.fr', inscrit_at: '2026-10-01T10:00:00Z', derniere_connexion_at: null, derniere_synchro_at: null, version_app: 'abc1234', statut: 'actif' },
  { user_id: 'bob', email: 'bob@exemple.fr', inscrit_at: '2026-10-05T10:00:00Z', derniere_connexion_at: null, derniere_synchro_at: null, version_app: null, statut: 'actif' },
  { user_id: 'eve', email: 'eve@exemple.fr', inscrit_at: '2026-10-06T10:00:00Z', derniere_connexion_at: null, derniere_synchro_at: null, version_app: null, statut: 'suspendu' },
]

const reponse = (statut: number, corps: unknown) => ({ ok: statut < 400, status: statut, json: async () => corps }) as unknown as Response

beforeEach(() => {
  client = {
    auth: {}, from: vi.fn(),
    rpc: vi.fn(async () => ({ data: COMPTES, error: null })),
    appelerFonction: vi.fn(async () => reponse(200, { message: 'Fait.' })),
  } as never
})
afterEach(cleanup)

describe('executerAction', () => {
  it('renvoie le message du serveur', async () => {
    client.appelerFonction.mockResolvedValueOnce(reponse(200, { message: 'Compte suspendu.' }))
    expect(await executerAction(client, { action: 'suspendre', userId: 'bob' })).toBe('Compte suspendu.')
    expect(client.appelerFonction).toHaveBeenCalledWith('admin-comptes', { action: 'suspendre', userId: 'bob' })
  })

  it('traduit un refus, une fonction non déployée et une panne réseau', async () => {
    client.appelerFonction.mockResolvedValueOnce(reponse(403, { erreur: 'Accès refusé.' }))
    await expect(executerAction(client, { action: 'supprimer', userId: 'bob' })).rejects.toThrow('Accès refusé.')
    client.appelerFonction.mockResolvedValueOnce(reponse(404, {}))
    await expect(executerAction(client, { action: 'suspendre', userId: 'bob' })).rejects.toThrow(/pas déployée/)
    client.appelerFonction.mockRejectedValueOnce(new Error('réseau'))
    await expect(executerAction(client, { action: 'suspendre', userId: 'bob' })).rejects.toThrow(/injoignable/)
  })
})

describe('écran des comptes : actions', () => {
  const monter = () => render(<MemoryRouter><AdminComptesScreen /></MemoryRouter>)
  const carte = async (email: string) => (await screen.findByText(new RegExp(email))).closest('li') as HTMLElement

  it('ne propose aucune action sur son propre compte', async () => {
    monter()
    const moi = await carte('moi@exemple.fr')
    expect(within(moi).queryByRole('button')).toBeNull()
  })

  it('suspend un compte, ou rétablit un compte suspendu, puis recharge la liste', async () => {
    monter()
    fireEvent.click(within(await carte('bob@exemple.fr')).getByRole('button', { name: 'Suspendre' }))
    await waitFor(() => expect(client.appelerFonction).toHaveBeenCalledWith('admin-comptes', { action: 'suspendre', userId: 'bob' }))
    expect(await screen.findByText('Fait.')).toBeTruthy()
    fireEvent.click(within(await carte('eve@exemple.fr')).getByRole('button', { name: 'Rétablir' }))
    await waitFor(() => expect(client.appelerFonction).toHaveBeenCalledWith('admin-comptes', { action: 'retablir', userId: 'eve' }))
    expect(client.rpc.mock.calls.filter((c) => c[0] === 'admin_lister_comptes').length).toBeGreaterThan(1)
  })

  it('envoie un lien de réinitialisation', async () => {
    monter()
    fireEvent.click(within(await carte('bob@exemple.fr')).getByRole('button', { name: 'Lien de réinitialisation' }))
    await waitFor(() => expect(client.appelerFonction).toHaveBeenCalledWith('admin-comptes', { action: 'reinitialiser', userId: 'bob' }))
  })

  it('la suppression exige de retaper l’adresse, et s’annule', async () => {
    monter()
    fireEvent.click(within(await carte('bob@exemple.fr')).getByRole('button', { name: 'Supprimer…' }))
    const groupe = await screen.findByRole('group', { name: /Supprimer bob@exemple.fr/ })
    const bouton = within(groupe).getByRole('button', { name: 'Supprimer définitivement' }) as HTMLButtonElement
    expect(bouton.disabled).toBe(true)
    fireEvent.change(within(groupe).getByLabelText('Adresse e-mail du compte'), { target: { value: 'autre@exemple.fr' } })
    expect(bouton.disabled).toBe(true)
    fireEvent.change(within(groupe).getByLabelText('Adresse e-mail du compte'), { target: { value: 'BOB@exemple.fr' } })
    expect(bouton.disabled).toBe(false)
    fireEvent.click(bouton)
    await waitFor(() => expect(client.appelerFonction).toHaveBeenCalledWith('admin-comptes', { action: 'supprimer', userId: 'bob', confirmation: 'BOB@exemple.fr' }))
    cleanup()
    monter()
    fireEvent.click(within(await carte('bob@exemple.fr')).getByRole('button', { name: 'Supprimer…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('group', { name: /Supprimer/ })).toBeNull()
  })

  it('invite une adresse et affiche l’erreur du serveur', async () => {
    monter()
    fireEvent.change(await screen.findByLabelText('Adresse e-mail à inviter'), { target: { value: 'nouveau@exemple.fr' } })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer l’invitation' }))
    await waitFor(() => expect(client.appelerFonction).toHaveBeenCalledWith('admin-comptes', { action: 'inviter', email: 'nouveau@exemple.fr' }))
    client.appelerFonction.mockResolvedValueOnce(reponse(400, { erreur: 'Invitation impossible : déjà inscrit.' }))
    fireEvent.change(screen.getByLabelText('Adresse e-mail à inviter'), { target: { value: 'bob@exemple.fr' } })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer l’invitation' }))
    expect(await screen.findByText(/déjà inscrit/)).toBeTruthy()
  })
})
