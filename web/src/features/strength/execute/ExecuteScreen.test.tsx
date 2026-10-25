// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'

const base = createTestDb()
vi.mock('../../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import ExecuteScreen from './ExecuteScreen'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const commun = { user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null }
await inserer(base, 'seances', { ...commun, id: 's1', nom: 'Haut du corps', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
await inserer(base, 'exercises', { ...commun, id: 'x1', name: 'Développé couché' })
await inserer(base, 'exercises', { ...commun, id: 'x2', name: 'Gainage planche' })
await inserer(base, 'blocs_seance', { ...commun, id: 'b1', seance_id: 's1', nom: 'Bloc principal', type: 'AUTRE', position: 0, instance_seance_id: null })
await inserer(base, 'exercices_seance', {
  ...commun, id: 'e1', seance_id: 's1', exercise_id: 'x1', bloc_id: 'b1', position: 0, nombre_series_prevues: 3,
  reps_cibles: '8-10', charge_cible: '60 kg', reps_type: 'REPS', temps_repos_sec: 90, instance_seance_id: null,
})
await inserer(base, 'exercices_seance', {
  ...commun, id: 'e2', seance_id: 's1', exercise_id: 'x2', bloc_id: 'b1', position: 1, nombre_series_prevues: 2,
  reps_cibles: '45s', charge_cible: 'PDC', reps_type: 'DURATION', temps_repos_sec: 60, instance_seance_id: null,
})

async function instance(id: string, terminee = false) {
  await inserer(base, 'instances_seance', {
    ...commun, id, seance_id: 's1', date: '2026-10-24', notes: '', is_completed: terminee ? 1 : 0,
    completed_at: terminee ? '2026-10-24T11:00:00.000Z' : null, duration_seconds: terminee ? 2700 : 0, created_at: 'c',
  })
}

function monter(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/strength/instance/${id}`]}>
      <Routes>
        <Route path="/strength/instance/:id" element={<ExecuteScreen />} />
        <Route path="/strength/instance/:id/report" element={<p>Écran bilan</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

// Barre d'exercices : un bouton par exercice (nom accessible « exercice, bloc, état »)
const choisir = (nom: string) =>
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Exercices de la séance' })).getByRole('button', { name: new RegExp(`^${nom},`) }))
const carte = (nom: string) => screen.getByRole('article', { name: nom })
const series = (instanceId: string) =>
  base.getAll<{ id: string; numero_serie: number; reps_realisees: number; charge_kg: number | null; rpe: number | null }>(
    'SELECT id, numero_serie, reps_realisees, charge_kg, rpe FROM series_realisees WHERE instance_seance_id = ? AND deleted_at IS NULL ORDER BY numero_serie',
    [instanceId],
  )

describe('ExecuteScreen', () => {
  it('affiche la séance, les cibles, le chrono et le bouton Démarrer', async () => {
    await instance('i-affiche')
    monter('i-affiche')
    expect(await screen.findByRole('heading', { level: 1, name: 'Haut du corps' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Bloc principal' })).toBeTruthy()
    const chrono = screen.getByRole('timer')
    expect(chrono.textContent).toBe('00:00')
    expect(chrono.getAttribute('aria-live')).toBe('off')
    expect(chrono.getAttribute('aria-label')).toBe('Temps écoulé : moins d’une minute')
    expect(screen.getByRole('button', { name: 'Démarrer' })).toBeTruthy()
    expect(within(carte('Développé couché')).getByText('3 séries × 8-10 · 60 kg · repos 90 s')).toBeTruthy()
    // Une ligne par série prévue, pré-remplie avec le prévu (grisée), repos de l'exercice, en-tête façon Android
    const dc = carte('Développé couché')
    expect(within(dc).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['#', 'Reps', 'kg', 'Repos', 'RPE', 'Validation'])
    expect(within(dc).getAllByRole('row')).toHaveLength(1 + 3 + 1) // en-tête, 3 séries, puces RPE de la série courante
    expect((within(dc).getByLabelText('Série 1, répétitions') as HTMLInputElement).value).toBe('8')
    expect((within(dc).getByLabelText('Série 3, charge en kilogrammes') as HTMLInputElement).value).toBe('60')
    // Repos éditable (Android : reposOverrideSec), prévu grisé
    expect((within(dc).getByLabelText('Série 2, repos en secondes') as HTMLInputElement).value).toBe('90')
    expect(within(dc).getByLabelText('Série 1, répétitions').closest('.tableau-series__cellule--grisee')).not.toBeNull()
    expect(within(dc).getByRole('row', { current: true })).toBeTruthy()
    // DURATION : colonne « Temps » en secondes, pas de RPE (on choisit l'exercice dans la barre)
    choisir('Gainage planche')
    const gp = carte('Gainage planche')
    expect(within(gp).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['#', 'Temps', 'kg', 'Repos', 'Validation'])
    expect((within(gp).getByLabelText('Série 1, durée en secondes') as HTMLInputElement).value).toBe('45')
    expect(within(gp).queryByRole('group', { name: 'RPE' })).toBeNull()
    // Panda de motivation avant le démarrage, décoratif
    await waitFor(() => expect(document.querySelector('img.execution__panda')).not.toBeNull())
    expect(document.querySelector('img.execution__panda')!.getAttribute('alt')).toBe('')
    expect(document.querySelector('img.execution__panda')!.getAttribute('src')).toMatch(/^\/panda\/motivation-male-sm\.webp$/)
  })

  it('démarre, valide la ligne 1 (charge « 17,5 », RPE par puce), la dé-valide, la corrige puis la revalide', async () => {
    await instance('i-saisie')
    monter('i-saisie')
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer' }))
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeTruthy()
    // Séance démarrée : le panda de motivation laisse la place à la saisie
    expect(document.querySelector('.execution__panda')).toBeNull()

    const dc = carte('Développé couché')
    fireEvent.change(within(dc).getByLabelText('Série 1, charge en kilogrammes'), { target: { value: '17,5' } })
    expect(within(dc).getByLabelText('Série 1, charge en kilogrammes').closest('.tableau-series__cellule--grisee')).toBeNull()
    fireEvent.click(within(dc).getByRole('button', { name: 'RPE 8, série 1' }))
    expect(within(dc).getByRole('button', { name: 'RPE 8, série 1' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(dc).getByRole('button', { name: 'Valider la série 1' }))

    await waitFor(async () => expect(await series('i-saisie')).toMatchObject([{ numero_serie: 1, reps_realisees: 8, charge_kg: 17.5, rpe: 8 }]))
    // Ligne validée : bouton ✓ qui annule, champs figés, la série courante passe à la ligne 2 (charge propagée)
    const annuler = await within(dc).findByRole('button', { name: 'Annuler la validation de la série 1' })
    expect((within(dc).getByLabelText('Série 1, répétitions') as HTMLInputElement).readOnly).toBe(true)
    expect((within(dc).getByLabelText('Série 2, charge en kilogrammes') as HTMLInputElement).value).toBe('17,5')
    expect(await screen.findByText(/^Repos : /)).toBeTruthy()

    fireEvent.click(annuler)
    fireEvent.change(await within(dc).findByLabelText('Série 1, répétitions'), { target: { value: '7' } })
    expect((within(dc).getByLabelText('Série 1, charge en kilogrammes') as HTMLInputElement).value).toBe('17,5')
    fireEvent.click(within(dc).getByRole('button', { name: 'Valider la série 1' }))
    await waitFor(async () => expect(await series('i-saisie')).toMatchObject([{ numero_serie: 1, reps_realisees: 7, charge_kg: 17.5 }]))
    expect(await series('i-saisie')).toHaveLength(1)
  })

  it('« Ajouter » et « Supprimer » changent le nombre de lignes', async () => {
    await instance('i-lignes')
    monter('i-lignes')
    const dc = await screen.findByRole('article', { name: 'Développé couché' })
    const lignes = () => within(carte('Développé couché')).getAllByLabelText(/^Série \d, répétitions$/)
    expect(lignes()).toHaveLength(3)
    fireEvent.click(within(dc).getByRole('button', { name: /Ajouter/ }))
    await waitFor(() => expect(lignes()).toHaveLength(4))
    fireEvent.click(within(carte('Développé couché')).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(lignes()).toHaveLength(3))
  })

  it('affiche une erreur de saisie en français', async () => {
    await instance('i-erreur')
    monter('i-erreur')
    const dc = await screen.findByRole('article', { name: 'Développé couché' })
    fireEvent.change(within(dc).getByLabelText('Série 1, répétitions'), { target: { value: '' } })
    fireEvent.click(within(dc).getByRole('button', { name: 'Valider la série 1' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Saisissez un nombre de répétitions entier.')
  })

  it('pause puis reprise', async () => {
    await instance('i-pause')
    monter('i-pause')
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Pause' }))
    expect(await screen.findByRole('button', { name: 'Reprendre' })).toBeTruthy()
    expect(screen.getByText('En pause')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre' }))
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeTruthy()
  })

  it('« Terminer la séance » demande confirmation puis ouvre le bilan', async () => {
    await instance('i-fin')
    monter('i-fin')
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer' }))
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    fireEvent.click(await screen.findByRole('button', { name: 'Terminer la séance' }))
    expect(confirmer).toHaveBeenCalledTimes(1)
    const ligne = () => base.get<{ is_completed: number }>("SELECT is_completed FROM instances_seance WHERE id = 'i-fin'")
    expect((await ligne()).is_completed).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }))
    expect(await screen.findByText('Écran bilan')).toBeTruthy()
    expect((await ligne()).is_completed).toBe(1)
  })

  it('une séance terminée est affichée en lecture seule', async () => {
    await instance('i-terminee', true)
    monter('i-terminee')
    expect(await screen.findByText('Séance terminée')).toBeTruthy()
    expect(screen.getByRole('timer').textContent).toBe('45:00')
    expect(screen.queryByRole('button', { name: 'Démarrer' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Valider la série' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Voir le bilan' }).getAttribute('href')).toBe('/strength/instance/i-terminee/report')
  })
})

describe('ExecuteScreen : repos, minuteur et saisie', () => {
  const repos = () => screen.queryByRole('button', { name: /^Repos : / })

  it('le badge de repos ouvre un menu : +30 s, -30 s, arrêt', async () => {
    await instance('i-menu-repos')
    monter('i-menu-repos')
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer' }))
    const dc = carte('Développé couché')
    fireEvent.click(within(dc).getByRole('button', { name: 'Valider la série 1' }))
    const badge = await screen.findByRole('button', { name: /^Repos : 01:[23]\d$/ })
    expect(badge.getAttribute('aria-haspopup')).toBe('menu')
    fireEvent.click(badge)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Allonger de 30 s' }))
    // 90 s + 30 s, moins le temps écoulé depuis la validation
    expect(repos()!.textContent).toMatch(/^Repos : (01:5\d|02:00)$/)
    fireEvent.click(repos()!)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Arrêter le repos' }))
    expect(repos()).toBeNull()
    expect(screen.queryByText('Repos terminé')).toBeNull()
  })

  it('un repos saisi sur la ligne remplace celui de l’exercice', async () => {
    await instance('i-repos-saisi')
    monter('i-repos-saisi')
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer' }))
    const dc = carte('Développé couché')
    fireEvent.change(within(dc).getByLabelText('Série 1, repos en secondes'), { target: { value: '20' } })
    fireEvent.click(within(dc).getByRole('button', { name: 'Valider la série 1' }))
    expect((await screen.findByRole('button', { name: /^Repos : 00:[12]\d$/ })).textContent).toMatch(/00:(19|20)$/)
  })

  it('le minuteur manuel démarre une durée choisie, puis -30 s / +30 s / Arrêter', async () => {
    await instance('i-manuel')
    monter('i-manuel')
    await screen.findByRole('heading', { level: 1, name: 'Haut du corps' })
    fireEvent.click(screen.getByRole('button', { name: /Minuteur/ }))
    const feuille = screen.getByRole('dialog', { name: 'Minuteur' })
    fireEvent.click(within(feuille).getByRole('button', { name: '2 min' }))
    expect(within(feuille).getByRole('button', { name: '2 min' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(feuille).getByRole('button', { name: 'Ajouter 5 secondes' }))
    fireEvent.click(within(feuille).getByRole('button', { name: 'Démarrer 2 min 5' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(repos()!.textContent).toMatch(/^Repos : 02:0[45]$/)
    fireEvent.click(screen.getByRole('button', { name: /Minuteur/ }))
    expect(within(screen.getByRole('dialog', { name: 'Minuteur' })).getByRole('button', { name: '−30 s' })).toBeTruthy()
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Minuteur' })).getByRole('button', { name: 'Arrêter' }))
    expect(repos()).toBeNull()
  })

  it('la charge saisie sur une ligne se répercute sur les lignes suivantes non validées', async () => {
    await instance('i-propage')
    monter('i-propage')
    const dc = await screen.findByRole('article', { name: 'Développé couché' })
    fireEvent.change(within(dc).getByLabelText('Série 1, charge en kilogrammes'), { target: { value: '70' } })
    expect((within(dc).getByLabelText('Série 3, charge en kilogrammes') as HTMLInputElement).value).toBe('70')
  })
})

describe('ExecuteScreen : superset', () => {
  it("libellé « Superset A » sur chaque exercice, consigne d'enchaînement sur le non final uniquement", async () => {
    await inserer(base, 'seances', { ...commun, id: 's-ss', nom: 'Superset', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
    await inserer(base, 'blocs_seance', { ...commun, id: 'b-ss', seance_id: 's-ss', nom: 'Bloc superset', position: 0, instance_seance_id: null })
    for (const [id, exo, position] of [['ss1', 'x1', 0], ['ss2', 'x2', 1]] as const) {
      await inserer(base, 'exercices_seance', {
        ...commun, id, seance_id: 's-ss', exercise_id: exo, bloc_id: 'b-ss', position, superset_groupe: 'A',
        nombre_series_prevues: 3, reps_type: 'REPS', temps_repos_sec: 60, instance_seance_id: null,
      })
    }
    await inserer(base, 'instances_seance', {
      ...commun, id: 'i-ss', seance_id: 's-ss', date: '2026-10-24', notes: '', is_completed: 0, completed_at: null, duration_seconds: 0, created_at: 'c',
    })
    monter('i-ss')
    await screen.findByRole('heading', { level: 1, name: 'Superset' })
    expect(within(carte('Développé couché')).getByText('Superset A')).toBeTruthy()
    expect(within(carte('Développé couché')).getByText('Enchaîne sans repos avec Gainage planche')).toBeTruthy()
    choisir('Gainage planche')
    expect(within(carte('Gainage planche')).getByText('Superset A')).toBeTruthy()
    expect(within(carte('Gainage planche')).queryByText(/Enchaîne sans repos/)).toBeNull()
  })
})
