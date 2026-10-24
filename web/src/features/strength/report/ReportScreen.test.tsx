// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'

const base = createTestDb()
vi.mock('../../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import ReportScreen from './ReportScreen'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const commun = { user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null }
await inserer(base, 'seances', { ...commun, id: 's1', nom: 'Haut du corps', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
await inserer(base, 'exercises', { ...commun, id: 'x1', name: 'Développé couché', equipment: '["Barre"]' })
await inserer(base, 'exercises', { ...commun, id: 'x2', name: 'Gainage planche', equipment: '["Poids de corps"]' })

let compteur = 0

// Une séance terminée par test (seance distincte pour isoler les objectifs).
async function seanceTerminee(id: string, { objectif = true, terminee = true } = {}) {
  const seanceId = `s-${id}`
  await inserer(base, 'seances', { ...commun, id: seanceId, nom: 'Haut du corps', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
  await inserer(base, 'instances_seance', {
    ...commun, id, seance_id: seanceId, date: '2026-10-24', notes: '', is_completed: terminee ? 1 : 0,
    completed_at: terminee ? '2026-10-24T11:00:00.000Z' : null, duration_seconds: terminee ? 2730 : 0, created_at: 'c',
    started_at: '2026-10-24T10:14:30.000Z', progression_json: terminee ? '{"evaluee":true,"decisions":{}}' : null,
  })
  const ex = (exId: string, champs: Record<string, unknown>) =>
    inserer(base, 'exercices_seance', {
      ...commun, id: `${id}-${exId}`, seance_id: seanceId, instance_seance_id: id, bloc_id: null, nombre_series_prevues: 3,
      reps_cibles: '8', charge_cible: '50 kg', reps_type: 'REPS', temps_repos_sec: 90, systeme_progression: 'LINEAIRE',
      increment_kg: 2.5, increment_duree_sec: 5, seuil_deload: 3, is_bodyweight: 0, is_bilateral: 0, ...champs,
    })
  await ex('e1', { exercise_id: 'x1', position: 0, progression_activee: 1 })
  await ex('e2', { exercise_id: 'x2', position: 1, progression_activee: 0, reps_type: 'DURATION', reps_cibles: '45', nombre_series_prevues: 2 })
  const serie = (exId: string, reps: number, charge: number | null) =>
    inserer(base, 'series_realisees', {
      ...commun, id: `serie-${++compteur}`, instance_seance_id: id, exercice_seance_id: `${id}-${exId}`, numero_serie: compteur,
      reps_realisees: reps, charge_kg: charge, rpe: null, notes: '', is_completed: 1,
    })
  // 3 × 7 reps à 50 kg (cible 8) : 3e échec consécutif -> deload proposé
  for (let i = 0; i < 3; i++) await serie('e1', 7, 50)
  await serie('e2', 60, 10)
  if (objectif) {
    await inserer(base, 'objectifs_progression', {
      ...commun, id: `obj-${id}`, seance_id: seanceId, exercise_id: 'x1', charge_cible: 50, reps_cible: 8, duree_cible_sec: null,
      compteur_echec: 2, derniere_maj: '2026-10-01', nombre_series_cible: null,
    })
  }
  return seanceId
}

function monter(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/strength/instance/${id}/report`]}>
      <Routes>
        <Route path="/strength/instance/:id/report" element={<ReportScreen />} />
        <Route path="/strength/instance/:id" element={<p>Écran séance</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const objectif = (seanceId: string) =>
  base.getOptional<{ charge_cible: number; reps_cible: number; compteur_echec: number }>(
    'SELECT charge_cible, reps_cible, compteur_echec FROM objectifs_progression WHERE seance_id = ? AND deleted_at IS NULL',
    [seanceId],
  )

describe('ReportScreen', () => {
  it('affiche le résumé et le bilan par exercice, sans icône 📅', async () => {
    await seanceTerminee('r-resume')
    const { container } = monter('r-resume')
    expect(await screen.findByRole('heading', { level: 1, name: 'Bilan — Haut du corps' })).toBeTruthy()
    const resume = screen.getByRole('region', { name: 'Résumé' })
    // 3 × 7 × 50 = 1050 kg ; la série DURATION lestée n'y compte pas
    expect(within(resume).getByText('1,1 t')).toBeTruthy()
    expect(within(resume).getByText('4')).toBeTruthy()
    expect(within(resume).getByText('45:30')).toBeTruthy()
    const bilan = screen.getByRole('region', { name: 'Exercices' })
    expect(within(bilan).getByText('Développé couché')).toBeTruthy()
    expect(within(bilan).getByText('3 / 3 séries')).toBeTruthy()
    expect(within(bilan).getByText('1 / 2 séries')).toBeTruthy()
    expect(container.textContent).not.toContain('📅')
    expect(document.body.textContent).not.toContain('📅')
    // Panda de victoire (variante par défaut : aucun réglage enregistré)
    const panda = await screen.findByRole('img', { name: 'Panda qui célèbre sa victoire' })
    expect(panda.getAttribute('src')).toBe('/panda/victory-male-sm.webp')
    expect(panda.getAttribute('loading')).toBe('lazy')
  })

  it('ouvre le récap (dialogue accessible) avec le deload proposé ; « Oui » l’écrit', async () => {
    const seanceId = await seanceTerminee('r-oui')
    monter('r-oui')
    const dialogue = await screen.findByRole('dialog', { name: 'Progression' })
    expect(dialogue.getAttribute('aria-modal')).toBe('true')
    expect(dialogue.contains(document.activeElement)).toBe(true)
    expect(within(dialogue).getByText('Réduction proposée de 10 % après échecs répétés.')).toBeTruthy()
    expect(within(dialogue).getByText('Proposer 8 reps à 45 kg')).toBeTruthy()
    // Rien n'est écrit avant la décision
    expect(await objectif(seanceId)).toEqual({ charge_cible: 50, reps_cible: 8, compteur_echec: 2 })

    fireEvent.click(within(dialogue).getByRole('button', { name: 'Oui' }))
    expect(await within(dialogue).findByText('Acceptée')).toBeTruthy()
    expect(await objectif(seanceId)).toEqual({ charge_cible: 45, reps_cible: 8, compteur_echec: 0 })
    expect(within(dialogue).queryByRole('button', { name: 'Oui' })).toBeNull()
  })

  it('« Non, garder » conserve la cible', async () => {
    const seanceId = await seanceTerminee('r-non')
    monter('r-non')
    const dialogue = await screen.findByRole('dialog', { name: 'Progression' })
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Non, garder' }))
    expect(await within(dialogue).findByText('Refusée')).toBeTruthy()
    expect(await objectif(seanceId)).toEqual({ charge_cible: 50, reps_cible: 8, compteur_echec: 0 })
  })

  it('« Ajuster » écrit la charge saisie (virgule décimale)', async () => {
    const seanceId = await seanceTerminee('r-ajuster')
    monter('r-ajuster')
    const dialogue = await screen.findByRole('dialog', { name: 'Progression' })
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Ajuster' }))
    const champ = within(dialogue).getByLabelText('Nouvelle charge (kg)')
    expect((champ as HTMLInputElement).value).toBe('45')
    fireEvent.change(champ, { target: { value: '47,5' } })
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Valider la charge' }))
    expect(await within(dialogue).findByText('Ajustée')).toBeTruthy()
    expect(await objectif(seanceId)).toEqual({ charge_cible: 47.5, reps_cible: 8, compteur_echec: 0 })
  })

  it('à la réouverture, la décision enregistrée est affichée (ni en attente, ni disparue)', async () => {
    await seanceTerminee('r-reouverture')
    const premier = monter('r-reouverture')
    const dialogue = await screen.findByRole('dialog', { name: 'Progression' })
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Oui' }))
    await within(dialogue).findByText('Acceptée')
    premier.unmount()

    monter('r-reouverture')
    const progression = await screen.findByRole('region', { name: 'Progression' })
    expect(within(progression).getByText('Développé couché')).toBeTruthy()
    expect(within(progression).getByText('Acceptée')).toBeTruthy()
    // Rien en attente : le récap ne s'ouvre pas de lui-même
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('« Déjà décidé » quand une décision a été enregistrée ailleurs entre-temps', async () => {
    const seanceId = await seanceTerminee('r-deja')
    monter('r-deja')
    const dialogue = await screen.findByRole('dialog', { name: 'Progression' })
    await base.execute('UPDATE instances_seance SET progression_json = ? WHERE id = ?', [
      '{"evaluee":true,"decisions":{"r-deja-e1":"refusee"}}',
      'r-deja',
    ])
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Oui' }))
    expect(await within(dialogue).findByText('Déjà décidé : Refusée')).toBeTruthy()
    expect(await objectif(seanceId)).toEqual({ charge_cible: 50, reps_cible: 8, compteur_echec: 2 })
  })

  it('Échap ferme le récap ; rouvert depuis le bouton, le focus y revient à la fermeture', async () => {
    await seanceTerminee('r-focus')
    monter('r-focus')
    await screen.findByRole('dialog', { name: 'Progression' })
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    const bouton = screen.getByRole('button', { name: 'Voir le récap de progression' })
    bouton.focus()
    fireEvent.click(bouton)
    const dialogue = await screen.findByRole('dialog', { name: 'Progression' })
    expect(dialogue.contains(document.activeElement)).toBe(true)
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Fermer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Voir le récap de progression' }))
  })

  it('le focus reste piégé dans le récap (Tab sur le dernier élément revient au premier)', async () => {
    await seanceTerminee('r-piege')
    monter('r-piege')
    const dialogue = await screen.findByRole('dialog', { name: 'Progression' })
    const boutons = within(dialogue).getAllByRole('button')
    boutons[boutons.length - 1].focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(boutons[0])
  })

  it("séance non terminée : message et lien vers la séance", async () => {
    await seanceTerminee('r-encours', { terminee: false })
    monter('r-encours')
    expect(await screen.findByText("Cette séance n'est pas encore terminée : le bilan sera disponible à la fin.")).toBeTruthy()
    const lien = screen.getByRole('link', { name: 'Reprendre la séance' })
    expect(lien.getAttribute('href')).toBe('/strength/instance/r-encours')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
