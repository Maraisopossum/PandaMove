// @vitest-environment jsdom
import type { Session } from '@supabase/auth-js'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { desinscrire, doitVerifier, inscrireTotp, listerFacteurs, niveauAssurance, niveauDuJeton, verifierCode } from '../../core/auth/mfa'
import type { ClientSupabase } from '../../core/db/clientSupabase'

const mfa = {
  listFactors: vi.fn(),
  enroll: vi.fn(),
  challengeAndVerify: vi.fn(),
  unenroll: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
}
let client: ClientSupabase
let session: Session | null = null
const deconnecter = vi.fn(async () => {})
vi.mock('../../core/db/client', () => ({ getSupabase: () => client }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session }), deconnecterSupabaseBrut: () => deconnecter() }))

import { GardeAdmin } from '../admin/GardeAdmin'
import { SecuriteSection } from '../profile/SecuriteSection'
import { GardeMfa } from './GardeMfa'

const jeton = (charge: object) => `x.${btoa(JSON.stringify(charge)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.y`
const sessionDe = (aal: string, role?: string) => ({ access_token: jeton({ aal }), user: { id: 'u1', app_metadata: role ? { role } : {} } }) as unknown as Session
const ok = (data: unknown) => ({ data, error: null })
const ko = (message: string) => ({ data: null, error: { message } })

beforeEach(() => {
  vi.clearAllMocks()
  client = { auth: { mfa }, from: vi.fn(), rpc: vi.fn(), appelerFonction: vi.fn() } as unknown as ClientSupabase
  session = sessionDe('aal1')
  mfa.listFactors.mockResolvedValue(ok({ totp: [] }))
  mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(ok({ currentLevel: 'aal1', nextLevel: 'aal1' }))
})
afterEach(cleanup)

describe('accès à l’authentification à deux facteurs', () => {
  it('liste les facteurs et signale ceux qui ne sont pas vérifiés', async () => {
    mfa.listFactors.mockResolvedValue(ok({ totp: [{ id: 'f1', friendly_name: 'Mon téléphone', status: 'verified' }, { id: 'f2', status: 'unverified' }] }))
    expect(await listerFacteurs(client)).toEqual([{ id: 'f1', nom: 'Mon téléphone', verifie: true }, { id: 'f2', nom: null, verifie: false }])
  })

  it('inscrit un facteur et renvoie le QR code et la clé', async () => {
    mfa.enroll.mockResolvedValue(ok({ id: 'f1', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'ABCD' } }))
    expect(await inscrireTotp(client, 'Test')).toEqual({ facteurId: 'f1', qrCode: 'data:image/svg+xml;utf-8,<svg/>', secret: 'ABCD' })
    expect(mfa.enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'Test' })
  })

  it('remonte les erreurs du serveur', async () => {
    mfa.challengeAndVerify.mockResolvedValue(ko('Invalid TOTP code'))
    await expect(verifierCode(client, 'f1', '123456')).rejects.toThrow('Invalid TOTP code')
    mfa.unenroll.mockResolvedValue(ko('AAL2 required'))
    await expect(desinscrire(client, 'f1')).rejects.toThrow('AAL2 required')
    mfa.listFactors.mockResolvedValue(ko('hors ligne'))
    await expect(listerFacteurs(client)).rejects.toThrow('hors ligne')
  })

  it('le code est nettoyé avant l’envoi', async () => {
    mfa.challengeAndVerify.mockResolvedValue(ok({}))
    await verifierCode(client, 'f1', ' 123456 ')
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f1', code: '123456' })
  })

  it('doitVerifier : seulement quand la session est aal1 et qu’un facteur demande aal2', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(ok({ currentLevel: 'aal1', nextLevel: 'aal2' }))
    expect(doitVerifier(await niveauAssurance(client))).toBe(true)
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(ok({ currentLevel: 'aal2', nextLevel: 'aal2' }))
    expect(doitVerifier(await niveauAssurance(client))).toBe(false)
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(ko('erreur'))
    expect(doitVerifier(await niveauAssurance(client))).toBe(false)
  })

  it('lit le niveau dans le jeton de la session', () => {
    expect(niveauDuJeton(sessionDe('aal2'))).toBe('aal2')
    expect(niveauDuJeton(sessionDe('aal1'))).toBe('aal1')
    expect(niveauDuJeton(null)).toBeNull()
    expect(niveauDuJeton({ access_token: 'illisible' } as Session)).toBeNull()
  })
})

describe('barrière de connexion', () => {
  it('sans facteur, l’application s’affiche directement', async () => {
    render(<GardeMfa><p>Application</p></GardeMfa>)
    expect(await screen.findByText('Application')).toBeTruthy()
  })

  it('avec un facteur et une session aal1, demande le code, puis laisse entrer une fois la session aal2', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(ok({ currentLevel: 'aal1', nextLevel: 'aal2' }))
    mfa.listFactors.mockResolvedValue(ok({ totp: [{ id: 'f1', status: 'verified' }] }))
    mfa.challengeAndVerify.mockResolvedValue(ok({}))
    const { rerender } = render(<GardeMfa><p>Application</p></GardeMfa>)
    expect(await screen.findByRole('heading', { name: 'Vérification en deux étapes' })).toBeTruthy()
    expect(screen.queryByText('Application')).toBeNull()
    const valider = screen.getByRole('button', { name: 'Valider' }) as HTMLButtonElement
    expect(valider.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Code à 6 chiffres'), { target: { value: '12ab3456789' } })
    expect((screen.getByLabelText('Code à 6 chiffres') as HTMLInputElement).value).toBe('123456')
    fireEvent.click(valider)
    await waitFor(() => expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f1', code: '123456' }))
    // Le fournisseur d'authentification renvoie alors une session aal2
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(ok({ currentLevel: 'aal2', nextLevel: 'aal2' }))
    session = sessionDe('aal2')
    rerender(<GardeMfa><p>Application</p></GardeMfa>)
    expect(await screen.findByText('Application')).toBeTruthy()
  })

  it('un code refusé affiche une erreur, et on peut se déconnecter', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(ok({ currentLevel: 'aal1', nextLevel: 'aal2' }))
    mfa.listFactors.mockResolvedValue(ok({ totp: [{ id: 'f1', status: 'verified' }] }))
    mfa.challengeAndVerify.mockResolvedValue(ko('Invalid TOTP code'))
    render(<GardeMfa><p>Application</p></GardeMfa>)
    fireEvent.change(await screen.findByLabelText('Code à 6 chiffres'), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))
    expect(deconnecter).toHaveBeenCalled()
  })

  it('hors ligne (lecture des facteurs impossible), on laisse entrer', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(ok({ currentLevel: 'aal1', nextLevel: 'aal2' }))
    mfa.listFactors.mockResolvedValue(ko('Failed to fetch'))
    render(<GardeMfa><p>Application</p></GardeMfa>)
    expect(await screen.findByText('Application')).toBeTruthy()
  })
})

describe('section du profil', () => {
  it('active la double authentification : QR code, code, confirmation', async () => {
    mfa.enroll.mockResolvedValue(ok({ id: 'f9', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'SECRETXYZ' } }))
    mfa.challengeAndVerify.mockResolvedValue(ok({}))
    render(<SecuriteSection client={client} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Activer la double authentification' }))
    expect(await screen.findByAltText(/QR code/)).toBeTruthy()
    expect(screen.getByText('SECRETXYZ')).toBeTruthy()
    mfa.listFactors.mockResolvedValue(ok({ totp: [{ id: 'f9', status: 'verified' }] }))
    fireEvent.change(screen.getByLabelText(/Code à 6 chiffres/), { target: { value: '654321' } })
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }))
    await waitFor(() => expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f9', code: '654321' }))
    expect(await screen.findByText(/Double authentification activée/)).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Désactiver…' }, { timeout: 5000 })).toBeTruthy()
  })

  it('retire un facteur commencé puis abandonné avant d’en inscrire un nouveau', async () => {
    mfa.listFactors.mockResolvedValue(ok({ totp: [{ id: 'vieux', status: 'unverified' }] }))
    mfa.unenroll.mockResolvedValue(ok({}))
    mfa.enroll.mockResolvedValue(ok({ id: 'f9', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'S' } }))
    render(<SecuriteSection client={client} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Activer la double authentification' }))
    await screen.findByAltText(/QR code/)
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'vieux' })
  })

  it('désactive après confirmation', async () => {
    mfa.listFactors.mockResolvedValue(ok({ totp: [{ id: 'f1', status: 'verified' }] }))
    mfa.unenroll.mockResolvedValue(ok({}))
    render(<SecuriteSection client={client} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Désactiver…' }))
    expect(screen.getByText(/ne sera plus accessible/)).toBeTruthy()
    mfa.listFactors.mockResolvedValue(ok({ totp: [] }))
    fireEvent.click(screen.getByRole('button', { name: 'Désactiver définitivement' }))
    await waitFor(() => expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'f1' }))
    expect(await screen.findByText('Double authentification désactivée.')).toBeTruthy()
  })
})

describe('accès à l’administration', () => {
  const monter = () => render(<MemoryRouter initialEntries={['/admin']}><Routes><Route path="/" element={<p>Accueil</p>} /><Route path="/profile" element={<p>Profil</p>} /><Route path="/admin" element={<GardeAdmin><p>Secret</p></GardeAdmin>} /></Routes></MemoryRouter>)

  it('exige le second facteur : un administrateur aal1 est invité à l’activer', () => {
    session = sessionDe('aal1', 'admin')
    monter()
    expect(screen.getByRole('alert').textContent).toContain('double authentification')
    expect(screen.queryByText('Secret')).toBeNull()
    expect(screen.getByRole('link', { name: 'Ouvrir mon profil' }).getAttribute('href')).toBe('/profile')
  })

  it('un administrateur aal2 entre, un compte ordinaire est renvoyé à l’accueil', () => {
    session = sessionDe('aal2', 'admin')
    monter()
    expect(screen.getByText('Secret')).toBeTruthy()
    cleanup()
    session = sessionDe('aal2')
    monter()
    expect(screen.getByText('Accueil')).toBeTruthy()
  })
})
