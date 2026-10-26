// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, Link, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../../core/db/Db'
import { deterministicId } from '../../../core/db/ids'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'

let base: Db
vi.mock('../../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import ExecuteScreen from './ExecuteScreen'

afterEach(cleanup)

const commun = { user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null }

beforeEach(async () => {
  base = createTestDb()
  await inserer(base, 'seances', { ...commun, id: 's1', nom: 'Haut du corps', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
  await inserer(base, 'exercises', { ...commun, id: 'x1', name: 'Développé couché' })
  await inserer(base, 'exercices_seance', {
    ...commun, id: 'e1', seance_id: 's1', exercise_id: 'x1', position: 0, nombre_series_prevues: 2,
    reps_cibles: '8', charge_cible: '60 kg', reps_type: 'REPS', temps_repos_sec: 90, instance_seance_id: null,
  })
  await inserer(base, 'instances_seance', {
    ...commun, id: 'i1', seance_id: 's1', date: '2026-10-24', notes: '', is_completed: 0, completed_at: null, duration_seconds: 0, created_at: 'c',
  })
})

function monter() {
  const routeur = createMemoryRouter(
    [
      {
        path: '/strength/instance/:id',
        element: (
          <>
            <ExecuteScreen />
            <Link to="/calendar">Aller au calendrier</Link>
          </>
        ),
      },
      { path: '/strength/instance/:id/report', element: <p>Écran bilan</p> },
      { path: '/strength/planned', element: <p>Séances programmées</p> },
      { path: '/calendar', element: <p>Calendrier</p> },
    ],
    { initialEntries: ['/strength/instance/i1'] },
  )
  render(<RouterProvider router={routeur} />)
  return routeur
}

// Délai large : sous charge (suite complète en parallèle) l'ouverture de l'écran peut dépasser la seconde par défaut
const LARGE = { timeout: 5000 }
const pret = () => screen.findByRole('heading', { level: 1, name: /Haut du corps|Pull/ }, LARGE)
const serieValidee = (numero: number) =>
  inserer(base, 'series_realisees', {
    ...commun, id: `r${numero}`, instance_seance_id: 'i1', exercice_seance_id: deterministicId('i1', 'e1'), numero_serie: numero,
    reps_realisees: 8, charge_kg: 60, is_completed: 1, notes: '', validated_at: '2026-10-24T10:05:00.000Z',
  })
const demarreA = async () =>
  (await base.get<{ s: string | null }>("SELECT started_at AS s FROM instances_seance WHERE id = 'i1'")).s
const supprimeeA = async (table: string, id: string) =>
  (await base.get<{ d: string | null }>(`SELECT deleted_at AS d FROM ${table} WHERE id = ?`, [id])).d

describe('renommer la séance en cours', () => {
  it('« Modifier le nom » renomme la séance jouée sans toucher au modèle', async () => {
    monter()
    await pret()
    fireEvent.click(screen.getByRole('button', { name: 'Actions de la séance' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Modifier le nom' }))
    const dialogue = screen.getByRole('dialog', { name: 'Modifier le nom' })
    const champ = within(dialogue).getByLabelText('Nom de la séance') as HTMLInputElement
    expect(champ.value).toBe('Haut du corps')
    fireEvent.change(champ, { target: { value: 'Haut du corps — lourd' } })
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Valider' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Haut du corps — lourd' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Modifier le nom' })).toBeNull()
    expect((await base.get<{ nom: string }>("SELECT nom FROM seances WHERE id = 's1'")).nom).toBe('Haut du corps')
    expect((await base.get<{ nom: string }>("SELECT nom FROM instances_seance WHERE id = 'i1'")).nom).toBe('Haut du corps — lourd')
  })

  it('refuse un nom de plus de 100 caractères avec un message', async () => {
    monter()
    await pret()
    fireEvent.click(screen.getByRole('button', { name: 'Actions de la séance' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Modifier le nom' }))
    const dialogue = screen.getByRole('dialog', { name: 'Modifier le nom' })
    fireEvent.change(within(dialogue).getByLabelText('Nom de la séance'), { target: { value: 'x'.repeat(101) } })
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Valider' }))
    expect((await within(dialogue).findByRole('alert')).textContent).toMatch(/100 caractères/)
    expect((await base.get<{ nom: string | null }>("SELECT nom FROM instances_seance WHERE id = 'i1'")).nom).toBeNull()
  })

  it('Annuler ferme le dialogue sans rien écrire', async () => {
    monter()
    await pret()
    fireEvent.click(screen.getByRole('button', { name: 'Actions de la séance' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Modifier le nom' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Modifier le nom' })).getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('dialog', { name: 'Modifier le nom' })).toBeNull()
  })
})

describe('sortie de l’exécution (Android : Rester / Aller au menu / Annuler la séance)', () => {
  it('sans série validée : « Quitter sans enregistrer » ; « Rester ici » ne perd rien', async () => {
    const routeur = monter()
    await pret()
    fireEvent.click(screen.getByRole('link', { name: 'Aller au calendrier' }))
    const dialogue = await screen.findByRole('dialog', { name: 'Quitter la séance ?' }, LARGE)
    expect(within(dialogue).getByRole('button', { name: 'Quitter sans enregistrer' })).toBeTruthy()
    expect(document.activeElement).toBe(within(dialogue).getByRole('button', { name: 'Rester ici' }))
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Rester ici' }))
    expect(screen.queryByRole('dialog', { name: 'Quitter la séance ?' })).toBeNull()
    expect(routeur.state.location.pathname).toBe('/strength/instance/i1')
  })

  it('« Quitter sans enregistrer » remet la séance démarrée à l’état planifié et part', async () => {
    const routeur = monter()
    await pret()
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer' }))
    await waitFor(async () => expect(await demarreA()).not.toBeNull())
    fireEvent.click(screen.getByRole('link', { name: 'Aller au calendrier' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Quitter la séance ?' }, LARGE)).getByRole('button', { name: 'Quitter sans enregistrer' }))
    await waitFor(() => expect(routeur.state.location.pathname).toBe('/calendar'))
    expect(await demarreA()).toBeNull()
  })

  it('avec une série validée : « Aller dans le menu » part et garde la séance en cours', async () => {
    await serieValidee(1)
    await base.execute("UPDATE instances_seance SET started_at = '2026-10-24T10:00:00.000Z' WHERE id = 'i1'")
    const routeur = monter()
    await pret()
    fireEvent.click(screen.getByRole('link', { name: 'Aller au calendrier' }))
    const dialogue = await screen.findByRole('dialog', { name: 'Quitter la séance ?' }, LARGE)
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Aller dans le menu' }))
    await waitFor(() => expect(routeur.state.location.pathname).toBe('/calendar'))
    expect(await demarreA()).toBe('2026-10-24T10:00:00.000Z')
    expect(await supprimeeA('instances_seance', 'i1')).toBeNull()
  })

  it('« Annuler la séance » demande confirmation puis supprime logiquement la séance jouée (même vide), jamais le modèle', async () => {
    const routeur = monter()
    await pret()
    fireEvent.click(screen.getByRole('link', { name: 'Aller au calendrier' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Quitter la séance ?' }, LARGE)).getByRole('button', { name: 'Annuler la séance' }))
    expect(screen.queryByRole('dialog', { name: 'Quitter la séance ?' })).toBeNull()
    const confirmation = screen.getByRole('dialog', { name: 'Annuler la séance ?' })
    expect(document.activeElement).toBe(within(confirmation).getByRole('button', { name: 'Revenir à la séance' }))
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Annuler la séance' }))
    await waitFor(() => expect(routeur.state.location.pathname).toBe('/strength/planned'))
    expect(await supprimeeA('instances_seance', 'i1')).not.toBeNull()
    expect(await supprimeeA('seances', 's1')).toBeNull()
  })

  it('« Revenir à la séance » garde la séance et reste sur l’écran', async () => {
    const routeur = monter()
    await pret()
    fireEvent.click(screen.getByRole('link', { name: 'Aller au calendrier' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Quitter la séance ?' }, LARGE)).getByRole('button', { name: 'Annuler la séance' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Annuler la séance ?' })).getByRole('button', { name: 'Revenir à la séance' }))
    expect(screen.queryByRole('dialog', { name: 'Annuler la séance ?' })).toBeNull()
    expect(routeur.state.location.pathname).toBe('/strength/instance/i1')
    expect(await supprimeeA('instances_seance', 'i1')).toBeNull()
  })

  it('toutes les séries validées : on part sans dialogue (Android : isCompleted)', async () => {
    await serieValidee(1)
    await serieValidee(2)
    const routeur = monter()
    await pret()
    fireEvent.click(screen.getByRole('link', { name: 'Aller au calendrier' }))
    await waitFor(() => expect(routeur.state.location.pathname).toBe('/calendar'))
    expect(screen.queryByRole('dialog', { name: 'Quitter la séance ?' })).toBeNull()
  })

  it('séance terminée : aucun dialogue', async () => {
    await base.execute("UPDATE instances_seance SET is_completed = 1, completed_at = '2026-10-24T11:00:00.000Z' WHERE id = 'i1'")
    const routeur = monter()
    await pret()
    fireEvent.click(screen.getByRole('link', { name: 'Aller au calendrier' }))
    await waitFor(() => expect(routeur.state.location.pathname).toBe('/calendar'))
  })

  it('« Terminer la séance » ouvre le bilan sans passer par le dialogue de sortie', async () => {
    await serieValidee(1)
    await base.execute("UPDATE instances_seance SET started_at = '2026-10-24T10:00:00.000Z' WHERE id = 'i1'")
    const routeur = monter()
    await pret()
    fireEvent.click(await screen.findByRole('button', { name: 'Terminer la séance' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Terminer la séance ?' })).getByRole('button', { name: 'Terminer' }))
    await waitFor(() => expect(routeur.state.location.pathname).toBe('/strength/instance/i1/report'))
    expect(screen.queryByRole('dialog', { name: 'Quitter la séance ?' })).toBeNull()
  })

  it('« Supprimer la séance » du menu garde son propre texte et part sans dialogue de sortie', async () => {
    const routeur = monter()
    await pret()
    fireEvent.click(screen.getByRole('button', { name: 'Actions de la séance' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Supprimer la séance' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Supprimer la séance ?' })).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(routeur.state.location.pathname).toBe('/strength/planned'))
  })
})
