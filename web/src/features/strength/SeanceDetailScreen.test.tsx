// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'

let base: Db
vi.mock('../../core/db/client', () => ({ getDb: () => base }))

import SeanceDetailScreen from './SeanceDetailScreen'

const b = { user_id: 'u1', updated_at: 'u0', deleted_at: null }

beforeEach(async () => {
  base = createTestDb()
  await inserer(base, 'seances', {
    ...b, id: 's1', nom: 'Pull', groupes_musculaires: '["DOS","BICEPS"]', duree_estimee_min: 55, notes: 'Tempo lent',
    seance_category: 'STRENGTH', created_at: 'c', is_archived: 0,
  })
  for (const [id, name] of [['x1', 'Tractions'], ['x2', 'Curl']]) {
    await inserer(base, 'exercises', {
      ...b, id, name, category: 'OTHER', muscle_groups: '[]', description: '', is_favorite: 0, is_custom: 0, image_url: null,
      exercise_type: '', equipment: '[]', muscle_primary: '', is_bodyweight: 0,
    })
  }
  await inserer(base, 'blocs_seance', {
    ...b, id: 'b1', seance_id: 's1', instance_seance_id: null, nom: 'Superset bras', type: 'SUPERSET', position: 1,
    temps_repos_inter_sec: 20, temps_repos_fin_round_sec: 90,
  })
  await inserer(base, 'exercices_seance', {
    ...b, id: 'e0', seance_id: 's1', instance_seance_id: null, exercise_id: 'x1', position: 0, nombre_series_prevues: 4, reps_cibles: '8',
    progression_activee: 1, systeme_progression: 'DOUBLE', reps_min: 6, reps_max: 10, increment_kg: 2.5, avertissement: 'Coudes serrés',
  })
  await inserer(base, 'exercices_seance', {
    ...b, id: 'e1', seance_id: 's1', instance_seance_id: null, bloc_id: 'b1', exercise_id: 'x2', position: 0, reps_cibles: '12',
    charge_cible: '10 kg', is_bilateral: 1,
  })
  await inserer(base, 'instances_seance', { ...b, id: 'iplan', seance_id: 's1', date: '2026-11-05', is_completed: 0 })
  await inserer(base, 'instances_seance', { ...b, id: 'ifait', seance_id: 's1', date: '2026-10-01', is_completed: 1 })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function monter(chemin = '/strength/s1') {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route path="/strength" element={<p>Écran liste</p>} />
        <Route path="/strength/:id" element={<SeanceDetailScreen />} />
        <Route path="/strength/:id/edit" element={<p>Écran édition</p>} />
        <Route path="/strength/instance/:id" element={<p>Écran exécution</p>} />
        <Route path="/strength/instance/:id/report" element={<p>Écran bilan</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SeanceDetailScreen', () => {
  it('résumé, composition (exercice libre puis bloc), badges en texte, historique ; jamais de 📅', async () => {
    monter()
    expect(await screen.findByRole('heading', { level: 1, name: 'Pull' })).toBeTruthy()
    const resume = screen.getByRole('list', { name: 'Résumé de la séance' })
    expect(resume.textContent).toContain('2')
    expect(resume.textContent).toContain('~55')
    expect(screen.getByText('Dos · Biceps')).toBeTruthy()
    expect(screen.getByText('Tempo lent')).toBeTruthy()

    const compo = screen.getByRole('region', { name: 'Composition' })
    expect(within(compo).getByText('Tractions')).toBeTruthy()
    expect(within(compo).getByText('4 × 6–10')).toBeTruthy()
    expect(within(compo).getByText('↗ Progression')).toBeTruthy()
    expect(within(compo).getByText('Double progression')).toBeTruthy()
    expect(within(compo).getByText('+2,5 kg')).toBeTruthy()
    expect(compo.textContent).toContain('Coudes serrés')
    const bloc = within(compo).getByRole('region', { name: 'Superset bras' })
    expect(bloc.textContent).toContain('inter 20 s · fin de round 1 min 30 s')
    expect(bloc.textContent).toContain('Curl')
    expect(bloc.textContent).toContain('G+D')
    expect(bloc.textContent).toContain('@ 10 kg')

    const histo = screen.getByRole('region', { name: 'Historique' })
    const liens = within(histo).getAllByRole('link')
    expect(liens.map((l) => l.getAttribute('href'))).toEqual(['/strength/instance/iplan', '/strength/instance/ifait/report'])
    expect(liens[0].textContent).toContain('Planifiée')
    expect(liens[1].textContent).toContain('Terminée')
    expect(document.body.textContent).not.toContain('📅')
    expect(screen.getByRole('link', { name: 'Modifier' }).getAttribute('href')).toBe('/strength/s1/edit')
  })

  it('Lancer : dialogue de confirmation, puis instance du jour démarrée et ouverture de l\'exécution', async () => {
    monter()
    fireEvent.click(await screen.findByRole('button', { name: 'Lancer la séance' }))
    const dialogue = await screen.findByRole('dialog', { name: 'Lancer « Pull » maintenant ?' })
    expect(dialogue).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }))
    expect(await screen.findByText('Écran exécution')).toBeTruthy()
    const n = await base.get<{ n: number }>("SELECT COUNT(*) AS n FROM instances_seance WHERE seance_id = 's1' AND started_at IS NOT NULL")
    expect(n.n).toBe(1)
  })

  it('supprimer une séance de l\'historique : focus initial sur Annuler, puis suppression logique de l\'instance seule', async () => {
    monter()
    const histo = await screen.findByRole('region', { name: 'Historique' })
    const declencheur = within(histo).getAllByRole('button', { name: /^Supprimer la séance du/ })[0]
    fireEvent.click(declencheur)
    const dialogue = await screen.findByRole('dialog')
    await waitFor(() => expect(document.activeElement).toBe(within(dialogue).getByRole('button', { name: 'Annuler' })))
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Annuler' }))
    expect((await base.get<{ deleted_at: string | null }>('SELECT deleted_at FROM instances_seance WHERE id = ?', ['iplan'])).deleted_at).toBeNull()

    fireEvent.click(declencheur)
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Historique' })).getAllByRole('link')).toHaveLength(1))
    expect((await base.get<{ deleted_at: string | null }>('SELECT deleted_at FROM instances_seance WHERE id = ?', ['iplan'])).deleted_at).not.toBeNull()
    expect((await base.get<{ deleted_at: string | null }>('SELECT deleted_at FROM seances WHERE id = ?', ['s1'])).deleted_at).toBeNull()
    expect((await base.get<{ deleted_at: string | null }>('SELECT deleted_at FROM instances_seance WHERE id = ?', ['ifait'])).deleted_at).toBeNull()
  })

  it('séance introuvable : alerte et retour à la liste', async () => {
    monter('/strength/nope')
    expect((await screen.findByRole('alert')).textContent).toBe('Séance introuvable.')
    expect(screen.getByRole('link', { name: 'Retour aux séances types' }).getAttribute('href')).toBe('/strength')
  })

  it('séance sans exercice : aide avec lien vers la modification', async () => {
    await inserer(base, 'seances', { ...b, id: 'v', nom: 'Vide', seance_category: 'STRENGTH', created_at: 'c', is_archived: 0 })
    monter('/strength/v')
    expect(await screen.findByText(/ne contient aucun exercice/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Modifiez-la' }).getAttribute('href')).toBe('/strength/v/edit')
    expect(screen.getByText(/Aucune séance jouée ou planifiée/)).toBeTruthy()
  })
})
