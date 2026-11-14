// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { creerMethode, enregistrerSeance, lireMethodes, lireSeances } from '../../core/db/repos/respiration'
import { createTestDb } from '../../test/sqliteDb'

let base: Db
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))
vi.mock('./audio', async (original) => ({ ...(await original<typeof import('./audio')>()), preparerAudio: vi.fn() }))

import MethodeFormScreen from './MethodeFormScreen'
import RespirationScreen from './RespirationScreen'
import SessionScreen from './SessionScreen'

const METHODE = { nom: 'Mon calme', emoji: '🌙', inspireSec: 4, retentionPleineSec: 0, expireSec: 6, retentionVideSec: 0, cyclesDefaut: 5 }

beforeEach(() => {
  base = createTestDb()
})
afterEach(cleanup)

function monter(chemin = '/breathing') {
  const routeur = createMemoryRouter(
    [
      { path: 'breathing', element: <RespirationScreen /> },
      { path: 'breathing/new', element: <MethodeFormScreen /> },
      { path: 'breathing/:id/edit', element: <MethodeFormScreen /> },
      { path: 'breathing/session/:id/:cycles', element: <SessionScreen /> },
    ],
    { initialEntries: [chemin] },
  )
  render(<RouterProvider router={routeur} />)
  return routeur
}

describe('écran Respiration', () => {
  it('liste les quatre méthodes intégrées puis les personnalisées', async () => {
    await creerMethode(base, METHODE)
    monter()
    await screen.findByText('Mon calme')
    const noms = within(screen.getByRole('list', { name: 'Méthodes de respiration' }))
      .getAllByRole('listitem')
      .map((li) => li.querySelector('.respiration__nom')?.textContent)
    expect(noms).toEqual(['Cohérence cardiaque', '4-7-8', 'Respiration en boîte', 'Wim Hof', 'Mon calme'])
  })

  it('ne propose modifier / supprimer que pour les méthodes personnalisées', async () => {
    await creerMethode(base, METHODE)
    monter()
    await screen.findByRole('link', { name: 'Modifier Mon calme' })
    expect(screen.queryByRole('link', { name: 'Modifier 4-7-8' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Supprimer 4-7-8' })).toBeNull()
  })

  it('règle la durée en cycles puis en minutes et lance la séance', async () => {
    const routeur = monter()
    fireEvent.click(await screen.findByRole('button', { name: /^4-7-8/ }))
    expect(screen.getByRole('status', { name: '4 cycles' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Augmenter' }))
    expect(screen.getByRole('status', { name: '5 cycles' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Minutes' }))
    expect(screen.getByRole('status', { name: '1 min' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Augmenter' }))
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer' }))
    // 2 min = 120 s, cycle de 19 s -> 6 cycles
    await waitFor(() => expect(routeur.state.location.pathname).toBe('/breathing/session/4_7_8/6'))
    expect(await screen.findByText('Prépare-toi…')).toBeTruthy()
  })

  it('supprime une méthode personnalisée après confirmation, en gardant son historique', async () => {
    const id = await creerMethode(base, METHODE)
    await enregistrerSeance(base, { methodeId: id, methodeNom: 'Mon calme', cycles: 5, dureeSec: 50, date: '2026-11-04' })
    monter()
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer Mon calme' }))
    const dialogue = screen.getByRole('dialog')
    expect(within(dialogue).getByText('« Mon calme »')).toBeTruthy()
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Supprimer Mon calme' })).toBeNull())
    expect(await lireMethodes(base)).toEqual([])
    expect(await lireSeances(base, 5)).toHaveLength(1)
  })

  it('annule une suppression sans rien écrire', async () => {
    await creerMethode(base, METHODE)
    monter()
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer Mon calme' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await lireMethodes(base)).toHaveLength(1)
  })

  it('affiche l’historique replié, le déplie et supprime une séance', async () => {
    await enregistrerSeance(base, { methodeId: '4_7_8', methodeNom: '4-7-8', cycles: 4, dureeSec: 76, date: '2026-11-04' })
    monter()
    const bascule = await screen.findByRole('button', { name: /Historique \(1\)/ })
    expect(bascule.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(bascule)
    expect(screen.getByText(/1 min 16 · 4 cycles/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Supprimer la séance 4-7-8/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Historique/ })).toBeNull())
    expect(await lireSeances(base, 5)).toEqual([])
  })
})

describe('formulaire de méthode', () => {
  it('crée une méthode avec aperçu de la description et retour à la liste', async () => {
    const routeur = monter('/breathing/new')
    const creer = await screen.findByRole('button', { name: 'Créer la méthode' })
    expect((creer as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Nom de la méthode'), { target: { value: '  Détente  ' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Rétention (poumons pleins)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Augmenter : Inspiration' }))
    expect(screen.getByText('5s · 4s · 4s — 6 cycles')).toBeTruthy()
    fireEvent.click(creer)
    await waitFor(() => expect(routeur.state.location.pathname).toBe('/breathing'))
    expect(await lireMethodes(base)).toEqual([
      expect.objectContaining({ nom: 'Détente', emoji: '🌬️', inspireSec: 5, retentionPleineSec: 4, expireSec: 4, retentionVideSec: 0, cyclesDefaut: 6 }),
    ])
  })

  it('modifie une méthode existante', async () => {
    const id = await creerMethode(base, METHODE)
    const routeur = monter(`/breathing/${id}/edit`)
    const champ = (await screen.findByLabelText('Nom de la méthode')) as HTMLInputElement
    expect(champ.value).toBe('Mon calme')
    fireEvent.change(champ, { target: { value: 'Renommée' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))
    await waitFor(() => expect(routeur.state.location.pathname).toBe('/breathing'))
    expect((await lireMethodes(base))[0]).toMatchObject({ id, nom: 'Renommée' })
  })

  it('signale une méthode introuvable', async () => {
    monter('/breathing/absente/edit')
    expect(await screen.findByRole('heading', { name: 'Méthode introuvable' })).toBeTruthy()
  })
})

describe('écran de séance', () => {
  it('signale une méthode inconnue ou une durée invalide', async () => {
    monter('/breathing/session/inconnue/6')
    expect(await screen.findByRole('heading', { name: 'Séance introuvable' })).toBeTruthy()
    cleanup()
    monter('/breathing/session/4_7_8/0')
    expect(await screen.findByRole('heading', { name: 'Séance introuvable' })).toBeTruthy()
  })

  it('affiche le décompte avant la première phase', async () => {
    monter('/breathing/session/4_7_8/2')
    expect(await screen.findByText('Prépare-toi…')).toBeTruthy()
    expect(screen.getByText('La séance commence dans 5 s')).toBeTruthy()
  })
})
