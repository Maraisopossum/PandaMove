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
await inserer(base, 'exercises', { ...commun, id: 'x1', name: 'Développé couché', muscle_groups: '["PECTORAUX","TRICEPS"]' })
await inserer(base, 'exercises', { ...commun, id: 'x2', name: 'Gainage planche' })
await inserer(base, 'exercises', { ...commun, id: 'x3', name: 'Tirage unilatéral', muscle_groups: '["DOS"]' })

interface Exo { id: string; exo: string; bloc: string; groupe?: string; series?: number; bilateral?: boolean }

async function monterSeance(id: string, blocs: [string, string][], exos: Exo[]) {
  await inserer(base, 'seances', { ...commun, id: `s-${id}`, nom: `Séance ${id}`, is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
  for (const [i, [bid, type]] of blocs.entries()) {
    await inserer(base, 'blocs_seance', { ...commun, id: `${id}-${bid}`, seance_id: `s-${id}`, nom: `Bloc ${bid}`, type, position: i, instance_seance_id: null })
  }
  for (const [i, e] of exos.entries()) {
    await inserer(base, 'exercices_seance', {
      ...commun, id: `${id}-${e.id}`, seance_id: `s-${id}`, exercise_id: e.exo, bloc_id: `${id}-${e.bloc}`, position: i,
      superset_groupe: e.groupe ?? null, nombre_series_prevues: e.series ?? 1, reps_type: 'REPS', temps_repos_sec: 30,
      is_bilateral: e.bilateral ? 1 : 0, instance_seance_id: null,
    })
  }
  await inserer(base, 'instances_seance', {
    ...commun, id: `i-${id}`, seance_id: `s-${id}`, date: '2026-10-24', notes: '', is_completed: 0, completed_at: null, duration_seconds: 0, created_at: 'c',
  })
  render(
    <MemoryRouter initialEntries={[`/strength/instance/i-${id}`]}>
      <Routes>
        <Route path="/strength/instance/:id" element={<ExecuteScreen />} />
      </Routes>
    </MemoryRouter>,
  )
  await screen.findByRole('navigation', { name: 'Exercices de la séance' })
}

const barre = () => screen.getByRole('navigation', { name: 'Exercices de la séance' })
const boutons = () => within(barre()).getAllByRole('button')
const actifs = () => boutons().map((b) => b.getAttribute('aria-current'))
const carte = (nom: string) => screen.getByRole('article', { name: nom })
const choisir = (nom: string) => fireEvent.click(within(barre()).getByRole('button', { name: new RegExp(`^${nom},`) }))
function valider(nom: string, reps: string) {
  const c = carte(nom)
  fireEvent.change(within(c).getByLabelText('Répétitions'), { target: { value: reps } })
  fireEvent.click(within(c).getByRole('button', { name: 'Valider la série' }))
}

describe('Barre d’exercices de l’exécution', () => {
  it('tous les exercices dans la barre, un seul affiché, le premier non terminé est actif', async () => {
    await monterSeance('b1', [['a', 'ECHAUFFEMENT'], ['b', 'AUTRE']], [
      { id: 'e1', exo: 'x1', bloc: 'a' }, { id: 'e2', exo: 'x2', bloc: 'b' },
    ])
    expect(boutons().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Développé couché, Bloc a, 0 série sur 1 faite', 'Gainage planche, Bloc b, 0 série sur 1 faite',
    ])
    expect(actifs()).toEqual(['true', null])
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 2, name: 'Bloc a' })).toBeTruthy()
    expect(screen.getByText('Échauffement')).toBeTruthy()
    // Choix manuel : l'autre exercice et son bloc remplacent le premier
    choisir('Gainage planche')
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(carte('Gainage planche')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Bloc b' })).toBeTruthy()
    expect(actifs()).toEqual([null, 'true'])
  })

  it('pastille : 4 lettres du premier muscle, 3 lettres du nom sans muscle, 🔄 si bilatéral ; groupes encadrés', async () => {
    await monterSeance('b2', [['a', 'ECHAUFFEMENT'], ['b', 'AUTRE']], [
      { id: 'e1', exo: 'x1', bloc: 'a' }, { id: 'e2', exo: 'x2', bloc: 'b' }, { id: 'e3', exo: 'x3', bloc: 'b', bilateral: true },
    ])
    expect(boutons().map((b) => b.querySelector('.navex__pastille')!.textContent)).toEqual(['PECT', 'GAI', '🔄'])
    const groupes = Array.from(barre().querySelectorAll('.navex__groupe'))
    expect(groupes.map((g) => g.getAttribute('data-groupe-encadre'))).toEqual(['true', 'false'])
    expect((groupes[0] as HTMLElement).style.getPropertyValue('--bloc-clair')).toBe('#9A5700')
  })

  it("après la dernière série d'un exercice simple, passe au suivant ; l'exercice terminé est marqué", async () => {
    await monterSeance('b3', [['a', 'AUTRE']], [{ id: 'e1', exo: 'x1', bloc: 'a' }, { id: 'e2', exo: 'x2', bloc: 'a' }])
    valider('Développé couché', '8')
    await waitFor(() => expect(actifs()).toEqual([null, 'true']))
    expect(carte('Gainage planche')).toBeTruthy()
    expect(boutons()[0].getAttribute('aria-label')).toBe('Développé couché, Bloc a, terminé')
    expect(boutons()[0].querySelector('.navex__coche')).not.toBeNull()
  })

  it("dans un superset, rien n'est forcé : l'utilisateur choisit A ou B", async () => {
    await monterSeance('b4', [['s', 'SUPERSET']], [
      { id: 'e1', exo: 'x1', bloc: 's', groupe: 'A' }, { id: 'e2', exo: 'x2', bloc: 's', groupe: 'A' },
    ])
    valider('Développé couché', '8')
    await waitFor(() => expect(boutons()[0].getAttribute('aria-label')).toMatch(/terminé$/))
    expect(actifs()).toEqual(['true', null])
    expect(carte('Développé couché')).toBeTruthy()
  })
})
