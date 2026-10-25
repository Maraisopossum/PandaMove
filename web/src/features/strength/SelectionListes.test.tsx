// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'

let base: Db
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import ListeInstancesScreen from './ListeInstancesScreen'
import SeanceListScreen from './SeanceListScreen'

const b = { user_id: 'u1', updated_at: 'u0', deleted_at: null }
const LARGE = { timeout: 4000 }

beforeEach(async () => {
  base = createTestDb()
  const seance = (id: string, nom: string, extra: Record<string, unknown> = {}) =>
    inserer(base, 'seances', { ...b, id, nom, groupes_musculaires: '["DOS"]', duree_estimee_min: 45, notes: '', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c', ...extra })
  await seance('s-vide', 'Pull')
  await seance('s-jouee', 'Push')
  await seance('s-arch', 'Ancienne', { is_archived: 1 })
  await inserer(base, 'instances_seance', { ...b, id: 'i-jouee', seance_id: 's-jouee', date: '2026-10-05', is_completed: 1, duration_seconds: 2700 })
  await inserer(base, 'instances_seance', { ...b, id: 'i-plan', seance_id: 's-vide', date: '2026-10-26', is_completed: 0 })
  await inserer(base, 'instances_seance', { ...b, id: 'i-plan2', seance_id: 's-vide', date: '2026-10-27', is_completed: 0 })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const supprimee = async (table: string, id: string) =>
  (await base.get<{ d: string | null }>(`SELECT deleted_at AS d FROM ${table} WHERE id = ?`, [id])).d !== null
const archivee = async (id: string) => (await base.get<{ a: number }>('SELECT is_archived AS a FROM seances WHERE id = ?', [id])).a === 1

function monterTypes() {
  return render(
    <MemoryRouter initialEntries={['/strength']}>
      <Routes>
        <Route path="/strength" element={<SeanceListScreen />} />
        <Route path="/strength/:id" element={<p>Détail</p>} />
      </Routes>
    </MemoryRouter>,
  )
}
function monterInstances(type: 'programmees' | 'terminees') {
  return render(
    <MemoryRouter initialEntries={['/liste']}>
      <Routes>
        <Route path="/liste" element={<ListeInstancesScreen type={type} />} />
        <Route path="/strength/instance/:id" element={<p>Exécution</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('séances types : sélection multiple', () => {
  it('« Sélectionner » ouvre le mode : cases à cocher, boutons de carte masqués, création masquée', async () => {
    monterTypes()
    await screen.findByText('Pull', undefined, LARGE)
    expect(screen.queryByRole('region', { name: 'Sélection' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sélectionner' }))
    expect(screen.getByRole('region', { name: 'Sélection' })).toBeTruthy()
    expect(screen.getByText('Aucun élément sélectionné')).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Sélectionner Pull' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Sélectionner Ancienne (archivée)' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Lancer Pull/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /Nouvelle séance/ })).toBeNull()
    expect((screen.getByRole('button', { name: 'Supprimer' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('compte les éléments choisis ; « Annuler la sélection » quitte le mode', async () => {
    monterTypes()
    await screen.findByText('Pull', undefined, LARGE)
    fireEvent.click(screen.getByRole('button', { name: 'Sélectionner' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner Pull' }))
    expect(screen.getByText('1 sélectionné')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner Push' }))
    expect(screen.getByText('2 sélectionnés')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Annuler la sélection' }))
    expect(screen.queryByRole('region', { name: 'Sélection' })).toBeNull()
    expect(screen.getByRole('button', { name: /Lancer Pull/ })).toBeTruthy()
  })

  it('appui long sur une carte : ouvre le mode avec cette carte choisie', async () => {
    monterTypes()
    await screen.findByText('Pull', undefined, LARGE)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    fireEvent.pointerDown(screen.getByText('Pull'), { clientX: 3, clientY: 3 })
    act(() => void vi.advanceTimersByTime(600))
    vi.useRealTimers()
    expect(screen.getByText('1 sélectionné')).toBeTruthy()
    expect((screen.getByRole('checkbox', { name: 'Sélectionner Pull' }) as HTMLInputElement).checked).toBe(true)
  })

  it('suppression groupée : la règle de l’Android (archive si historique, supprime sinon, purge une archivée)', async () => {
    monterTypes()
    await screen.findByText('Pull', undefined, LARGE)
    fireEvent.click(screen.getByRole('button', { name: 'Sélectionner' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner Push' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner Ancienne (archivée)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    const dialogue = screen.getByRole('dialog', { name: 'Supprimer ces 2 éléments ?' })
    expect(within(dialogue).getByText('1 séance type et 1 séance archivée seront supprimées.')).toBeTruthy()
    expect(document.activeElement).toBe(within(dialogue).getByRole('button', { name: 'Annuler' }))
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), LARGE)
    // Push avait une séance jouée : archivée (historique gardé) ; Ancienne était archivée : purgée
    expect(await archivee('s-jouee')).toBe(true)
    expect(await supprimee('seances', 's-jouee')).toBe(false)
    expect(await supprimee('seances', 's-arch')).toBe(true)
    expect(await supprimee('seances', 's-vide')).toBe(false)
    expect(screen.queryByRole('region', { name: 'Sélection' })).toBeNull()
  })

  it('« Annuler » dans la confirmation ne supprime rien et garde la sélection', async () => {
    monterTypes()
    await screen.findByText('Pull', undefined, LARGE)
    fireEvent.click(screen.getByRole('button', { name: 'Sélectionner' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sélectionner Pull' }))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Supprimer cet élément ?' })).getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('1 sélectionné')).toBeTruthy()
    expect(await supprimee('seances', 's-vide')).toBe(false)
  })
})

describe('séances programmées et terminées : sélection multiple', () => {
  it('supprime logiquement les séances jouées choisies, le modèle reste', async () => {
    monterInstances('programmees')
    await screen.findByText('lun. 26 oct.', { exact: false }, LARGE)
    fireEvent.click(screen.getByRole('button', { name: 'Sélectionner' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Sélectionner Pull du lun\. 26 oct\./ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Sélectionner Pull du mar\. 27 oct\./ }))
    expect(screen.getByText('2 sélectionnés')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    const dialogue = screen.getByRole('dialog', { name: 'Supprimer ces 2 éléments ?' })
    expect(within(dialogue).getByText('2 séances programmées seront supprimées.')).toBeTruthy()
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Supprimer' }))
    await waitFor(async () => expect(await supprimee('instances_seance', 'i-plan')).toBe(true), LARGE)
    expect(await supprimee('instances_seance', 'i-plan2')).toBe(true)
    expect(await supprimee('seances', 's-vide')).toBe(false)
    expect(await screen.findByText('Aucune séance programmée.', undefined, LARGE)).toBeTruthy()
  })

  it('terminées : le texte parle de séances terminées', async () => {
    monterInstances('terminees')
    await screen.findByText('Push', undefined, LARGE)
    fireEvent.click(screen.getByRole('button', { name: 'Sélectionner' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Sélectionner Push/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(within(screen.getByRole('dialog')).getByText('1 séance terminée sera supprimée.')).toBeTruthy()
  })

  it('hors mode sélection la carte reste un lien', async () => {
    monterInstances('programmees')
    await screen.findByText('lun. 26 oct.', { exact: false }, LARGE)
    expect(screen.getAllByRole('link').length).toBeGreaterThan(0)
  })
})
