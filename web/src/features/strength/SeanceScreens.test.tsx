// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'

const base = createTestDb()
vi.mock('../../core/db/client', () => ({ getDb: () => base }))

import SeanceEditScreen from './SeanceEditScreen'
import SeanceListScreen from './SeanceListScreen'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const LIBELLE_ASSIGNER = 'Affecter à une date'

async function seance(id: string, nom: string, extra: Record<string, unknown> = {}) {
  await inserer(base, 'seances', {
    id, user_id: 'u1', updated_at: 'u', deleted_at: null, nom, groupes_musculaires: '["DOS","BICEPS"]',
    duree_estimee_min: 45, notes: '', seance_category: 'STRENGTH', created_at: 'c', is_archived: 0, ...extra,
  })
}

await seance('s1', 'Pull')
await seance('s2', 'Push', { groupes_musculaires: '["PECTORAUX"]', duree_estimee_min: 30 })
await inserer(base, 'exercices_seance', {
  id: 'e1', user_id: 'u1', updated_at: 'u', deleted_at: null, seance_id: 's1', exercise_id: 'x', position: 0, instance_seance_id: null,
})
await inserer(base, 'exercises', {
  id: 'dc', user_id: 'u1', updated_at: 'u', deleted_at: null, name: 'Développé couché', category: 'OTHER',
  muscle_groups: '["PECTORAUX"]', description: '', is_favorite: 0, is_custom: 0, image_url: null, exercise_type: '',
  equipment: '[]', muscle_primary: 'PECTORAUX', is_bodyweight: 0,
})

function monter(chemin: string) {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route path="/strength" element={<SeanceListScreen />} />
        <Route path="/strength/new" element={<SeanceEditScreen />} />
        <Route path="/strength/:id/edit" element={<SeanceEditScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SeanceListScreen', () => {
  it('affiche les cartes (nom, muscles, durée, nb d\'exercices) et le bouton 📅 sur chacune', async () => {
    monter('/strength')
    expect(await screen.findByText('Pull')).toBeTruthy()
    expect(screen.getByText('Dos, Biceps · 45 min · 1 exercice')).toBeTruthy()
    expect(screen.getByText('Pectoraux · 30 min · 0 exercice')).toBeTruthy()
    expect(screen.getAllByLabelText(LIBELLE_ASSIGNER)).toHaveLength(2)
    expect(screen.getByRole('link', { name: /Nouvelle séance/ }).getAttribute('href')).toBe('/strength/new')
    expect(screen.getByRole('link', { name: /Catalogue/ }).getAttribute('href')).toBe('/strength/catalog')
    expect(screen.getByRole('link', { name: 'Modifier Pull' }).getAttribute('href')).toBe('/strength/s1/edit')
  })

  it("dialogue d'affectation : rôle dialog, focus piégé, Échap ferme et rend le focus", async () => {
    monter('/strength')
    await screen.findByText('Pull')
    const declencheur = screen.getAllByLabelText(LIBELLE_ASSIGNER)[0]
    declencheur.focus()
    fireEvent.click(declencheur)

    const dialogue = await screen.findByRole('dialog')
    expect(dialogue.getAttribute('aria-modal')).toBe('true')
    expect(dialogue.className).toBe('dialogue')
    const date = screen.getByLabelText('Date de la séance')
    await waitFor(() => expect(document.activeElement).toBe(date))

    // Tab depuis le dernier élément revient au premier ; Maj+Tab depuis le premier va au dernier
    const annuler = screen.getByRole('button', { name: 'Annuler' })
    annuler.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(date)
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(annuler)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(declencheur)
  })

  it("affecte à une date ; une erreur (séance disparue) s'affiche dans le dialogue", async () => {
    monter('/strength')
    await screen.findByText('Push')
    fireEvent.click(screen.getAllByLabelText(LIBELLE_ASSIGNER)[1])
    const date = await screen.findByLabelText('Date de la séance')
    fireEvent.change(date, { target: { value: '2026-11-03' } })

    // La séance disparaît (ex. supprimée depuis un autre appareil) avant la confirmation
    await base.execute("UPDATE seances SET deleted_at = 'x' WHERE id = 's2'")
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Séance introuvable.')
    expect(screen.getByRole('dialog')).toBeTruthy()

    await base.execute("UPDATE seances SET deleted_at = NULL WHERE id = 's2'")
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    expect((await screen.findByRole('status')).textContent).toBe('« Push » est affectée au 03/11/2026.')
    expect(screen.queryByRole('dialog')).toBeNull()
    const lignes = await base.getAll<{ seance_id: string; date: string }>('SELECT seance_id, date FROM instances_seance')
    expect(lignes).toEqual([{ seance_id: 's2', date: '2026-11-03' }])
  })

  it("archive après confirmation, et pas sans", async () => {
    monter('/strength')
    await screen.findByText('Push')
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    fireEvent.click(screen.getByRole('button', { name: 'Archiver Push' }))
    expect(screen.getByText('Push')).toBeTruthy()

    vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
    fireEvent.click(screen.getByRole('button', { name: 'Archiver Push' }))
    await waitFor(() => expect(screen.queryByText('Push')).toBeNull())
    const l = await base.get<{ is_archived: number }>('SELECT is_archived FROM seances WHERE id = ?', ['s2'])
    expect(l.is_archived).toBe(1)
  })
})

describe('SeanceEditScreen', () => {
  it("ne contient aucun bouton d'affectation (création comme modification)", async () => {
    const creation = monter('/strength/new')
    expect(await screen.findByRole('heading', { name: 'Nouvelle séance' })).toBeTruthy()
    expect(screen.queryAllByLabelText(LIBELLE_ASSIGNER)).toHaveLength(0)
    expect(creation.container.querySelector('[aria-label="Affecter à une date"]')).toBeNull()
    expect(creation.container.textContent).not.toContain('📅')
    creation.unmount()

    const edition = monter('/strength/s1/edit')
    expect(await screen.findByRole('heading', { name: 'Modifier la séance' })).toBeTruthy()
    expect(await screen.findByDisplayValue('Pull')).toBeTruthy()
    expect(screen.queryAllByLabelText(LIBELLE_ASSIGNER)).toHaveLength(0)
    expect(edition.container.textContent).not.toContain('📅')
  })

  it("crée une séance : nom, bloc, exercice choisi dans le catalogue, enregistrement puis retour à la liste", async () => {
    monter('/strength/new')
    fireEvent.change(await screen.findByLabelText('Nom de la séance'), { target: { value: 'Pectoraux du jeudi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un bloc' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un exercice' }))
    fireEvent.change(screen.getByLabelText('Rechercher un exercice'), { target: { value: 'DEVELOPPE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Développé couché' }))
    expect(screen.getByText('Développé couché')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Retour à la liste, où la séance apparaît avec ses muscles et son exercice
    expect(await screen.findByRole('heading', { name: 'Renforcement' })).toBeTruthy()
    expect(await screen.findByText('Pectoraux du jeudi')).toBeTruthy()
    expect(screen.getByText('Pectoraux · 60 min · 1 exercice')).toBeTruthy()
  })

  it('affiche les erreurs de validation en français sans quitter la page', async () => {
    monter('/strength/new')
    fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer' }))
    const alerte = await screen.findByRole('alert')
    expect(alerte.textContent).toBe('Le nom de la séance est obligatoire.')
    expect(screen.getByRole('heading', { name: 'Nouvelle séance' })).toBeTruthy()
  })
})
