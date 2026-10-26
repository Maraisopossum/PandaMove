// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'

let base: Db
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import SeanceListScreen from './SeanceListScreen'

const b = { user_id: 'u1', updated_at: 'u0', deleted_at: null }
const LARGE = { timeout: 4000 }

async function seance(id: string, nom: string, extra: Record<string, unknown> = {}) {
  await inserer(base, 'seances', {
    ...b, id, nom, groupes_musculaires: '["DOS"]', duree_estimee_min: 45, notes: '', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c', ...extra,
  })
}
async function instance(id: string, seanceId: string, date: string, terminee = false) {
  await inserer(base, 'instances_seance', {
    ...b, id, seance_id: seanceId, date, is_completed: terminee ? 1 : 0, duration_seconds: terminee ? 2700 : 0, completed_at: terminee ? `${date}T10:00:00.000Z` : null,
  })
}
const supprimee = async (table: string, id: string) =>
  (await base.get<{ d: string | null }>(`SELECT deleted_at AS d FROM ${table} WHERE id = ?`, [id])).d !== null
const archivee = async (id: string) => (await base.get<{ a: number }>('SELECT is_archived AS a FROM seances WHERE id = ?', [id])).a === 1

function monter() {
  return render(
    <MemoryRouter initialEntries={['/strength']}>
      <Routes>
        <Route path="/strength" element={<SeanceListScreen />} />
        <Route path="/strength/new" element={<p>Écran création</p>} />
        <Route path="/strength/instance/:id" element={<p>Exécution</p>} />
        <Route path="/strength/instance/:id/report" element={<p>Bilan</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  base = createTestDb()
  await seance('s-pull', 'Pull')
  await seance('s-push', 'Push')
  await instance('i-plan', 's-pull', '2026-10-26')
  // Sept séances terminées, de la plus ancienne (01) à la plus récente (07)
  for (let j = 1; j <= 7; j++) await instance(`i-fin-${j}`, 's-push', `2026-10-0${j}`, true)
})
afterEach(cleanup)

const section = (nom: string) => screen.getByRole('region', { name: nom })

describe('écran Séances : une liste à sections comme l’Android', () => {
  it('séances types, programmées et terminées sur le même écran, chaque section avec son titre', async () => {
    monter()
    await screen.findByRole('region', { name: 'Séances types' }, LARGE)
    expect(within(section('Séances types')).getByText('Pull')).toBeTruthy()
    await waitFor(() => expect(within(section('Séances programmées')).getByText(/lun\. 26 oct\./)).toBeTruthy(), LARGE)
    expect(within(section('Séances terminées')).getAllByRole('listitem').length).toBe(5)
  })

  it('terminées : 5 plus récentes puis « Voir les 2 autres » / « Réduire »', async () => {
    monter()
    const terminees = await waitFor(() => {
      const s = section('Séances terminées')
      expect(within(s).getAllByRole('listitem').length).toBe(5)
      return s
    }, LARGE)
    // Les plus récentes d'abord : 07 … 03 ; pas 02 ni 01
    expect(within(terminees).getByText(/mer\. 7 oct\./)).toBeTruthy()
    expect(within(terminees).queryByText(/jeu\. 1 oct\./)).toBeNull()
    fireEvent.click(within(terminees).getByRole('button', { name: 'Voir les 2 autres' }))
    expect(within(terminees).getAllByRole('listitem').length).toBe(7)
    fireEvent.click(within(terminees).getByRole('button', { name: 'Réduire' }))
    expect(within(terminees).getAllByRole('listitem').length).toBe(5)
  })

  it('une section vide n’est pas affichée', async () => {
    await base.execute('UPDATE instances_seance SET deleted_at = ? WHERE is_completed = 0', ['x'])
    monter()
    await screen.findByRole('region', { name: 'Séances types' }, LARGE)
    await waitFor(() => expect(within(section('Séances terminées')).getAllByRole('listitem').length).toBe(5), LARGE)
    expect(screen.queryByRole('region', { name: 'Séances programmées' })).toBeNull()
  })

  it('une programmée s’ouvre sur l’exécution, une terminée sur son bilan ; changer la date et supprimer y sont aussi', async () => {
    monter()
    const programmees = await screen.findByRole('region', { name: 'Séances programmées' }, LARGE)
    await within(programmees).findByText(/lun\. 26 oct\./, undefined, LARGE)
    expect(within(programmees).getByRole('link', { name: /Pull/ }).getAttribute('href')).toBe('/strength/instance/i-plan')
    expect(within(section('Séances terminées')).getAllByRole('link')[0].getAttribute('href')).toBe('/strength/instance/i-fin-7/report')

    fireEvent.click(within(programmees).getByRole('button', { name: /Changer la date de Pull/ }))
    const dialogue = screen.getByRole('dialog')
    fireEvent.change(within(dialogue).getByLabelText("Nouvelle date"), { target: { value: '2026-10-28' } })
    fireEvent.click(within(dialogue).getByRole('button', { name: "Confirmer" }))
    await waitFor(() => expect(within(section('Séances programmées')).getByText(/mer\. 28 oct\./)).toBeTruthy(), LARGE)

    fireEvent.click(within(section('Séances programmées')).getByRole('button', { name: /Supprimer Pull/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Supprimer/ }))
    await waitFor(async () => expect(await supprimee('instances_seance', 'i-plan')).toBe(true), LARGE)
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Séances programmées' })).toBeNull(), LARGE)
  })
})

describe('écran Séances : sélection multiple sur toutes les sections', () => {
  it('une même sélection porte sur un type, une programmée et une terminée ; textes et règles de l’Android', async () => {
    monter()
    await screen.findByRole('region', { name: 'Séances programmées' }, LARGE)
    fireEvent.click(screen.getByRole('button', { name: 'Sélectionner' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner Pull' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Sélectionner Pull du lun\. 26 oct\./ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Sélectionner Push du mer\. 7 oct\./ }))
    expect(screen.getByText('3 sélectionnés')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    const dialogue = screen.getByRole('dialog', { name: 'Supprimer ces 3 éléments ?' })
    expect(within(dialogue).getByText('1 séance type, 1 séance programmée et 1 séance terminée seront supprimées.')).toBeTruthy()
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), LARGE)
    expect(await supprimee('instances_seance', 'i-plan')).toBe(true)
    expect(await supprimee('instances_seance', 'i-fin-7')).toBe(true)
    // Pull n'a plus de séance jouée au moment du traitement : supprimé (les instances d'abord) ; jamais d'effet sur Push
    expect(await supprimee('seances', 's-pull')).toBe(true)
    expect(await supprimee('seances', 's-push')).toBe(false)
    expect(await archivee('s-push')).toBe(false)
  })

  it('un type qui a un historique est archivé, pas supprimé', async () => {
    monter()
    await screen.findByRole('region', { name: 'Séances types' }, LARGE)
    fireEvent.click(screen.getByRole('button', { name: 'Sélectionner' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner Push' }))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), LARGE)
    expect(await archivee('s-push')).toBe(true)
    expect(await supprimee('seances', 's-push')).toBe(false)
  })
})

describe('écran Séances : un seul appel à l’action principale à vide', () => {
  it('état vide : « Créer ma première séance » est le seul bouton principal, pas de carte « Pour commencer » ni de « Nouvelle séance »', async () => {
    base = createTestDb()
    monter()
    expect(await screen.findByText("Aucune séance type pour l'instant.", undefined, LARGE)).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /Créer|Nouvelle séance/ }).map((l) => l.textContent?.replace('＋ ', ''))).toEqual(['Créer ma première séance'])
    expect(screen.queryByRole('heading', { name: 'Pour commencer' })).toBeNull()
  })

  it('avec des séances, « Nouvelle séance » reste le bouton principal', async () => {
    monter()
    await screen.findByRole('region', { name: 'Séances types' }, LARGE)
    expect(screen.getByRole('link', { name: /Nouvelle séance/ })).toBeTruthy()
  })
})
