// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compterCodesRestants, genererCodesSecours, texteDesCodes, utiliserCodeSecours } from '../../core/auth/codesSecours'
import type { ClientSupabase } from '../../core/db/clientSupabase'

let client: ClientSupabase
const refreshSession = vi.fn(async () => ({ data: {}, error: null }))
const appelerFonction = vi.fn()
const rpc = vi.fn()
vi.mock('../../core/db/client', () => ({ getSupabase: () => client }))

import { CodesSecours } from '../profile/CodesSecours'
import { MfaChallengeScreen } from './MfaChallengeScreen'

const reponse = (statut: number, corps: unknown) => new Response(JSON.stringify(corps), { status: statut })

beforeEach(() => {
  vi.clearAllMocks()
  client = { auth: { refreshSession }, from: vi.fn(), rpc, appelerFonction } as unknown as ClientSupabase
  rpc.mockResolvedValue({ data: 0, error: null })
})
afterEach(cleanup)

describe('accès aux codes de secours', () => {
  it('génère, utilise puis compte les codes', async () => {
    appelerFonction.mockResolvedValueOnce(reponse(200, { codes: ['AAAAA-BBBBB'] }))
    expect(await genererCodesSecours(client)).toEqual(['AAAAA-BBBBB'])
    expect(appelerFonction).toHaveBeenCalledWith('codes-secours', { action: 'generer' })

    appelerFonction.mockResolvedValueOnce(reponse(200, { message: 'Retiré.' }))
    expect(await utiliserCodeSecours(client, 'AAAAA-BBBBB')).toBe('Retiré.')
    expect(refreshSession).toHaveBeenCalledOnce()

    rpc.mockResolvedValueOnce({ data: 5, error: null })
    expect(await compterCodesRestants(client)).toBe(5)
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    expect(await compterCodesRestants(client)).toBeNull()
  })

  it('remonte le message du serveur, ou explique que la fonction n’est pas déployée', async () => {
    appelerFonction.mockResolvedValueOnce(reponse(403, { erreur: 'Code de secours incorrect ou déjà utilisé.' }))
    await expect(utiliserCodeSecours(client, 'AAAAA-BBBBB')).rejects.toThrow('Code de secours incorrect ou déjà utilisé.')
    expect(refreshSession).not.toHaveBeenCalled()
    appelerFonction.mockResolvedValueOnce(reponse(404, {}))
    await expect(genererCodesSecours(client)).rejects.toThrow(/pas déployée/)
    appelerFonction.mockRejectedValueOnce(new Error('réseau'))
    await expect(genererCodesSecours(client)).rejects.toThrow(/injoignable/)
  })

  it('le texte à copier contient chaque code', () => {
    expect(texteDesCodes(['AAAAA-BBBBB', 'CCCCC-DDDDD'])).toMatch(/AAAAA-BBBBB\nCCCCC-DDDDD/)
  })
})

describe('connexion avec un code de secours', () => {
  it('bascule vers la saisie du code de secours, l’envoie puis rafraîchit la session', async () => {
    appelerFonction.mockResolvedValue(reponse(200, { message: 'Retiré.' }))
    render(<MfaChallengeScreen facteur={{ id: 'f1', nom: null, verifie: true }} deconnecter={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /code de secours/i }))
    const bouton = screen.getByRole('button', { name: 'Utiliser ce code' })
    expect((bouton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Code de secours'), { target: { value: 'abcde-fgh23' } })
    expect((screen.getByLabelText('Code de secours') as HTMLInputElement).value).toBe('ABCDE-FGH23')
    fireEvent.click(bouton)
    await waitFor(() => expect(appelerFonction).toHaveBeenCalledWith('codes-secours', { action: 'utiliser', code: 'ABCDE-FGH23' }))
    await waitFor(() => expect(refreshSession).toHaveBeenCalled())
  })

  it('affiche le refus du serveur et permet de revenir au code à 6 chiffres', async () => {
    appelerFonction.mockResolvedValue(reponse(403, { erreur: 'Code de secours incorrect ou déjà utilisé.' }))
    render(<MfaChallengeScreen facteur={{ id: 'f1', nom: null, verifie: true }} deconnecter={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /code de secours/i }))
    fireEvent.change(screen.getByLabelText('Code de secours'), { target: { value: 'ABCDEFGH23' } })
    fireEvent.click(screen.getByRole('button', { name: 'Utiliser ce code' }))
    expect((await screen.findByRole('alert')).textContent).toContain('incorrect ou déjà utilisé')
    fireEvent.click(screen.getByRole('button', { name: /revenir au code à 6 chiffres/i }))
    expect(screen.getByLabelText('Code à 6 chiffres')).toBeTruthy()
  })
})

describe('section « Codes de secours » du profil', () => {
  it('propose d’en générer quand il n’y en a aucun, puis affiche les codes une seule fois', async () => {
    appelerFonction.mockResolvedValue(reponse(200, { codes: ['AAAAA-BBBBB', 'CCCCC-DDDDD'] }))
    render(<CodesSecours supabase={() => client} />)
    expect(await screen.findByText(/Aucun code de secours/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Générer mes codes de secours' }))
    expect(await screen.findByText('AAAAA-BBBBB')).toBeTruthy()
    expect(screen.getByText(/ne seront plus affichés/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /J’ai noté mes codes/ }))
    expect(screen.queryByText('AAAAA-BBBBB')).toBeNull()
  })

  it('demande confirmation avant de remplacer des codes existants', async () => {
    rpc.mockResolvedValue({ data: 3, error: null })
    appelerFonction.mockResolvedValue(reponse(200, { codes: ['EEEEE-FFFFF'] }))
    render(<CodesSecours supabase={() => client} />)
    expect(await screen.findByText(/3 codes de secours encore valables/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Générer de nouveaux codes/ }))
    expect(appelerFonction).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Remplacer mes codes' }))
    expect(await screen.findByText('EEEEE-FFFFF')).toBeTruthy()
  })

  it('signale l’erreur quand la génération échoue', async () => {
    appelerFonction.mockResolvedValue(reponse(403, { erreur: 'Double authentification requise : reconnectez-vous avec votre code.' }))
    render(<CodesSecours supabase={() => client} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Générer mes codes de secours' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Double authentification requise')
  })
})
