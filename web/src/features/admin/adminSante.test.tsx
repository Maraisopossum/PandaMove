// @vitest-environment jsdom
import type { Session } from '@supabase/auth-js'
import { cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { envoyerBattement, lireSante } from '../../core/admin/admin'
import type { ClientSupabase } from '../../core/db/clientSupabase'
import { rejetsEnvoi } from '../../core/sync/rejetsEnvoi'

let client: ClientSupabase & { appelerFonction: ReturnType<typeof vi.fn>; rpc: ReturnType<typeof vi.fn> }
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'moi', app_metadata: { role: 'admin' } } } as unknown as Session }) }))
vi.mock('../../core/db/client', () => ({ getSupabase: () => client }))
vi.mock('../../core/sync/useSyncStatus', () => ({ useSyncStatus: () => ({ state: 'offline' }) }))

import { useBattement } from '../../core/admin/useBattement'
import AdminComptesScreen from './AdminComptesScreen'
import AdminSanteScreen from './AdminSanteScreen'

const SANTE = [
  { user_id: 'a', email: 'alice@exemple.fr', derniere_synchro_at: new Date().toISOString(), jours_sans_synchro: 0, version_app: 'abc1234', rejets_total: 3, rejets: [{ table: 'seances', code: '23514', nb: 3, dernier_at: '2026-11-14T09:00:00Z' }] },
  { user_id: 'b', email: 'bob@exemple.fr', derniere_synchro_at: '2026-10-01T09:00:00Z', jours_sans_synchro: 45, version_app: null, rejets_total: 0, rejets: [] },
  { user_id: 'c', email: 'cleo@exemple.fr', derniere_synchro_at: null, jours_sans_synchro: null, version_app: null, rejets_total: 0, rejets: [] },
]

beforeEach(() => {
  rejetsEnvoi.prelever()
  client = {
    auth: {}, from: vi.fn(),
    rpc: vi.fn(async (fonction: string) => ({ data: fonction === 'admin_sante_synchro' ? SANTE : [{ user_id: 'bob', email: 'bob@exemple.fr', inscrit_at: '2026-10-05T10:00:00Z', derniere_connexion_at: null, derniere_synchro_at: null, version_app: null, statut: 'actif' }], error: null })),
    appelerFonction: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ message: 'Compte déconnecté : il devra se reconnecter.' }) }) as unknown as Response),
  } as never
})
afterEach(cleanup)

describe('santé de la synchro', () => {
  it('convertit les lignes du serveur', async () => {
    const s = await lireSante(client)
    expect(s[0]).toMatchObject({ userId: 'a', rejetsTotal: 3, rejets: [{ table: 'seances', code: '23514', nb: 3 }] })
    expect(s[2]).toMatchObject({ joursSansSynchro: null, derniereSynchroAt: null })
  })

  it('l’écran regroupe les rejets par table et code et liste les comptes hors ligne depuis longtemps', async () => {
    render(<MemoryRouter><AdminSanteScreen /></MemoryRouter>)
    expect(await screen.findByText('seances · 23514')).toBeTruthy()
    expect(screen.getByText('3 fois')).toBeTruthy()
    const anciens = screen.getByRole('list', { name: 'Comptes hors ligne depuis longtemps' })
    expect(within(anciens).getByText(/bob@exemple.fr/)).toBeTruthy()
    expect(within(anciens).getByText(/45 jours sans synchro/)).toBeTruthy()
    expect(within(anciens).getByText(/jamais synchronisé/)).toBeTruthy()
    expect(within(anciens).queryByText(/alice@exemple.fr/)).toBeNull()
  })

  it('dit quand tout va bien', async () => {
    client.rpc.mockResolvedValue({ data: [{ ...SANTE[0], rejets_total: 0, rejets: [] }], error: null })
    render(<MemoryRouter><AdminSanteScreen /></MemoryRouter>)
    expect(await screen.findByText('Aucun envoi rejeté signalé.')).toBeTruthy()
    expect(screen.getByText(/Tous les comptes ont synchronisé récemment/)).toBeTruthy()
  })
})

describe('déconnexion forcée', () => {
  it('le bouton appelle la fonction serveur', async () => {
    render(<MemoryRouter><AdminComptesScreen /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Déconnecter' }))
    await waitFor(() => expect(client.appelerFonction).toHaveBeenCalledWith('admin-comptes', { action: 'deconnecter', userId: 'bob' }))
    expect(await screen.findByText(/devra se reconnecter/)).toBeTruthy()
  })
})

describe('compteurs de rejets', () => {
  const rejet = (table: string, code: string) => ({ table, operation: 'PUT', code, dateMs: 0 })

  it('comptent par table et code, se prélèvent puis repartent de zéro, et se restituent', () => {
    rejetsEnvoi.signaler(rejet('seances', '23514'))
    rejetsEnvoi.signaler(rejet('seances', '23514'))
    rejetsEnvoi.signaler(rejet('sorties', '42501'))
    const p = rejetsEnvoi.prelever()
    expect(p).toEqual([{ table: 'seances', code: '23514', nb: 2 }, { table: 'sorties', code: '42501', nb: 1 }])
    expect(rejetsEnvoi.prelever()).toEqual([])
    rejetsEnvoi.restituer(p)
    rejetsEnvoi.signaler(rejet('seances', '23514'))
    expect(rejetsEnvoi.prelever()).toEqual([{ table: 'seances', code: '23514', nb: 3 }, { table: 'sorties', code: '42501', nb: 1 }])
  })

  it('le battement les envoie, et les garde pour plus tard s’il échoue', async () => {
    rejetsEnvoi.signaler(rejet('seances', '23514'))
    client.rpc.mockResolvedValueOnce({ data: null, error: { message: 'hors ligne' } })
    renderHook(() => useBattement({ userId: 'u1' }))
    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('enregistrer_battement', expect.objectContaining({ p_rejets: [{ table: 'seances', code: '23514', nb: 1 }] })))
    await waitFor(() => expect(rejetsEnvoi.prelever()).toEqual([{ table: 'seances', code: '23514', nb: 1 }]))
  })

  it('envoyerBattement renvoie vrai en cas de succès et faux sinon', async () => {
    client.rpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await envoyerBattement(client, 'v', true, [])).toBe(true)
    client.rpc.mockRejectedValueOnce(new Error('réseau'))
    expect(await envoyerBattement(client, 'v')).toBe(false)
  })
})
