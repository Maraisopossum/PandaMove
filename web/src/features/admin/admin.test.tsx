// @vitest-environment jsdom
import type { Session } from '@supabase/auth-js'
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { envoyerBattement, estAdmin, listerComptes, lireJournal, lireResume } from '../../core/admin/admin'
import type { ClientSupabase } from '../../core/db/clientSupabase'

let session: Session | null = null
let client: ClientSupabase
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session }) }))
vi.mock('../../core/db/client', () => ({ getSupabase: () => client }))
let etatSynchro: 'online' | 'offline' | 'syncing' = 'offline'
vi.mock('../../core/sync/useSyncStatus', () => ({ useSyncStatus: () => ({ state: etatSynchro }) }))

import { useBattement, DELAI_BATTEMENT_MS } from '../../core/admin/useBattement'
import AdminComptesScreen from './AdminComptesScreen'
import AdminJournalScreen from './AdminJournalScreen'
import AdminTableauScreen from './AdminTableauScreen'
import { GardeAdmin } from './GardeAdmin'

const sessionDe = (role?: string) => ({ user: { id: 'u1', app_metadata: role ? { role } : {} } }) as unknown as Session
const faux = (reponses: Record<string, unknown>, erreurs: Record<string, string> = {}) => {
  const rpc = vi.fn(async (fonction: string) => (erreurs[fonction] ? { data: null, error: { message: erreurs[fonction] } } : { data: reponses[fonction] ?? [], error: null }))
  return { auth: {}, from: vi.fn(), rpc } as unknown as ClientSupabase & { rpc: typeof rpc }
}

const COMPTES = [
  { user_id: 'a', email: 'alice@exemple.fr', inscrit_at: '2026-10-01T10:00:00Z', derniere_connexion_at: '2026-11-14T08:00:00Z', derniere_synchro_at: null, version_app: 'abc1234', statut: 'actif' },
  { user_id: 'b', email: 'bob@exemple.fr', inscrit_at: '2026-10-05T10:00:00Z', derniere_connexion_at: null, derniere_synchro_at: null, version_app: null, statut: 'suspendu' },
]

beforeEach(() => {
  session = sessionDe('admin')
  etatSynchro = 'offline'
})
afterEach(cleanup)

describe('accès administrateur', () => {
  it('le rôle vient du JWT (app_metadata), jamais de la saisie', () => {
    expect(estAdmin(sessionDe('admin'))).toBe(true)
    expect(estAdmin(sessionDe('coach'))).toBe(false)
    expect(estAdmin(sessionDe())).toBe(false)
    expect(estAdmin(null)).toBe(false)
  })

  it('un compte ordinaire est renvoyé à l’accueil sans rien voir de l’administration', () => {
    session = sessionDe()
    render(<MemoryRouter initialEntries={['/admin']}><Routes><Route path="/" element={<p>Accueil</p>} /><Route path="/admin" element={<GardeAdmin><p>Secret</p></GardeAdmin>} /></Routes></MemoryRouter>)
    expect(screen.getByText('Accueil')).toBeTruthy()
    expect(screen.queryByText('Secret')).toBeNull()
  })

  it('l’administrateur accède à la page', () => {
    render(<MemoryRouter initialEntries={['/admin']}><Routes><Route path="/admin" element={<GardeAdmin><p>Secret</p></GardeAdmin>} /></Routes></MemoryRouter>)
    expect(screen.getByText('Secret')).toBeTruthy()
  })
})

describe('lecture des données d’administration', () => {
  it('convertit les comptes, le résumé et le journal', async () => {
    const c = faux({
      admin_lister_comptes: COMPTES,
      admin_resume: [{ inscrits: 2, actifs_7j: 1, actifs_30j: 2, suspendus: 1 }],
      admin_lire_journal: [{ id: 'j1', admin_id: 'x', action: 'suspension', cible_user_id: 'b', at: '2026-11-14T09:00:00Z', detail: null }],
    })
    expect((await listerComptes(c))[1]).toMatchObject({ userId: 'b', statut: 'suspendu', versionApp: null, derniereConnexionAt: null })
    expect(await lireResume(c)).toEqual({ inscrits: 2, actifs7j: 1, actifs30j: 2, suspendus: 1 })
    expect(await lireJournal(c, 20)).toEqual([{ id: 'j1', adminId: 'x', action: 'suspension', cibleUserId: 'b', at: '2026-11-14T09:00:00Z', detail: null }])
    expect(c.rpc).toHaveBeenCalledWith('admin_lire_journal', { p_limite: 20 })
  })

  it('remonte l’erreur du serveur', async () => {
    await expect(listerComptes(faux({}, { admin_lister_comptes: 'Accès refusé.' }))).rejects.toThrow('Accès refusé.')
  })
})

describe('écrans', () => {
  it('le tableau montre les compteurs et la répartition des versions', async () => {
    client = faux({ admin_lister_comptes: COMPTES, admin_resume: [{ inscrits: 2, actifs_7j: 1, actifs_30j: 2, suspendus: 1 }] })
    render(<MemoryRouter><AdminTableauScreen /></MemoryRouter>)
    expect(await screen.findByText('Actifs sur 7 jours')).toBeTruthy()
    expect(await screen.findByText('abc1234')).toBeTruthy()
    expect(screen.getByText('inconnue')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Liste des comptes' }).getAttribute('href')).toBe('/admin/comptes')
  })

  it('la liste des comptes se filtre par e-mail et signale les comptes suspendus', async () => {
    client = faux({ admin_lister_comptes: COMPTES })
    render(<MemoryRouter><AdminComptesScreen /></MemoryRouter>)
    expect(await screen.findByText(/alice@exemple.fr/)).toBeTruthy()
    expect(screen.getByText(/bob@exemple.fr · suspendu/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Rechercher un e-mail'), { target: { value: 'ALI' } })
    expect(screen.queryByText(/bob@exemple.fr/)).toBeNull()
    expect(screen.getByText('1 compte sur 2.')).toBeTruthy()
  })

  it('explique un refus du serveur (rôle absent du jeton)', async () => {
    client = faux({}, { admin_lister_comptes: 'Accès refusé.' })
    render(<MemoryRouter><AdminComptesScreen /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('reconnectez-vous'))
  })

  it('le journal affiche les actions ou dit qu’il est vide', async () => {
    client = faux({ admin_lire_journal: [] })
    render(<MemoryRouter><AdminJournalScreen /></MemoryRouter>)
    expect(await screen.findByText(/Aucune action administrateur/)).toBeTruthy()
    cleanup()
    client = faux({ admin_lire_journal: [{ id: 'j1', admin_id: 'x', action: 'suspension', cible_user_id: 'b', at: '2026-11-14T09:00:00Z', detail: 'essai' }] })
    render(<MemoryRouter><AdminJournalScreen /></MemoryRouter>)
    expect(await screen.findByText('suspension')).toBeTruthy()
  })
})

describe('battement', () => {
  it('envoie la version et le drapeau de synchro, et ignore les échecs', async () => {
    const c = faux({})
    await envoyerBattement(c, 'abc1234', true)
    expect(c.rpc).toHaveBeenCalledWith('enregistrer_battement', { p_version: 'abc1234', p_synchro: true })
    const casse = { auth: {}, from: vi.fn(), rpc: vi.fn(() => { throw new Error('hors ligne') }) } as unknown as ClientSupabase
    await expect(envoyerBattement(casse, 'x')).resolves.toBeUndefined()
  })

  describe('hook', () => {
    beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }))
    afterEach(() => vi.useRealTimers())

    it('un battement à l’ouverture, un autre après une synchro réussie au plus tous les quinze minutes', () => {
      const envoyer = vi.fn(async () => {})
      const { rerender } = renderHook(() => useBattement({ userId: 'u1', envoyer }))
      expect(envoyer).toHaveBeenCalledTimes(1)
      expect(envoyer).toHaveBeenLastCalledWith(false)
      etatSynchro = 'online'
      rerender()
      expect(envoyer).toHaveBeenCalledTimes(1)
      vi.setSystemTime(Date.now() + DELAI_BATTEMENT_MS + 1000)
      etatSynchro = 'syncing'
      rerender()
      etatSynchro = 'online'
      rerender()
      expect(envoyer).toHaveBeenCalledTimes(2)
      expect(envoyer).toHaveBeenLastCalledWith(true)
    })

    it('rien sans compte connecté', () => {
      const envoyer = vi.fn(async () => {})
      etatSynchro = 'online'
      renderHook(() => useBattement({ userId: undefined, envoyer }))
      expect(envoyer).not.toHaveBeenCalled()
    })
  })
})
