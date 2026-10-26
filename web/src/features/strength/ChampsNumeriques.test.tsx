// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import { ChampNombre, ChampNombreFacultatif } from './champs'

const base = createTestDb()
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import SeanceEditScreen from './SeanceEditScreen'

afterEach(cleanup)

// Frappe caractère par caractère (comme un clavier) et renvoie les valeurs affichées successives.
function taper(champ: HTMLElement, texte: string): string[] {
  const vus: string[] = []
  let courant = ''
  for (const c of texte) {
    courant += c
    fireEvent.change(champ, { target: { value: courant } })
    vus.push((champ as HTMLInputElement).value)
  }
  return vus
}

describe('ChampNombreFacultatif', () => {
  function monter(valeur: number | null = null) {
    const commits: (number | null)[] = []
    const rendu = render(<ChampNombreFacultatif libelle="Incrément (kg)" valeur={valeur} onChange={(v) => commits.push(v)} />)
    return { commits, ...rendu }
  }

  it('2.5 : le texte affiché est exactement la frappe, la valeur validée est 2.5', () => {
    const { commits } = monter()
    expect(taper(screen.getByLabelText('Incrément (kg)'), '2.5')).toEqual(['2', '2.', '2.5'])
    expect(commits.at(-1)).toBe(2.5)
  })

  it('2,5 (virgule française) : affichage conservé, valeur 2.5', () => {
    const { commits } = monter()
    expect(taper(screen.getByLabelText('Incrément (kg)'), '2,5')).toEqual(['2', '2,', '2,5'])
    expect(commits.at(-1)).toBe(2.5)
  })

  it('1.25, 0,5 et .5', () => {
    const a = monter()
    expect(taper(screen.getByLabelText('Incrément (kg)'), '1.25')).toEqual(['1', '1.', '1.2', '1.25'])
    expect(a.commits.at(-1)).toBe(1.25)
    cleanup()
    const b = monter()
    taper(screen.getByLabelText('Incrément (kg)'), '0,5')
    expect(b.commits.at(-1)).toBe(0.5)
    cleanup()
    const c = monter()
    expect(taper(screen.getByLabelText('Incrément (kg)'), '.5')).toEqual(['.', '.5'])
    expect(c.commits.at(-1)).toBe(0.5)
  })

  it('vider le champ valide null', () => {
    const { commits } = monter(2.5)
    const champ = screen.getByLabelText('Incrément (kg)') as HTMLInputElement
    expect(champ.value).toBe('2,5')
    fireEvent.change(champ, { target: { value: '' } })
    expect(champ.value).toBe('')
    expect(commits.at(-1)).toBeNull()
  })

  it('texte invalide : ignoré, sans plantage', () => {
    const { commits } = monter()
    const champ = screen.getByLabelText('Incrément (kg)') as HTMLInputElement
    fireEvent.change(champ, { target: { value: '2' } })
    fireEvent.change(champ, { target: { value: '2a' } })
    fireEvent.change(champ, { target: { value: '1e3' } })
    expect(champ.value).toBe('2')
    expect(commits).toEqual([2])
  })

  it('un changement externe de valeur remet à jour le texte, mais pas en cours de frappe', () => {
    const { rerender } = monter(null)
    const champ = screen.getByLabelText('Incrément (kg)') as HTMLInputElement
    taper(champ, '2.')
    // Le parent répercute la valeur validée (2) : "2." doit rester affiché
    rerender(<ChampNombreFacultatif libelle="Incrément (kg)" valeur={2} onChange={() => undefined} />)
    expect(champ.value).toBe('2.')
    // Valeur différente venue de l'extérieur (chargement, réinitialisation)
    rerender(<ChampNombreFacultatif libelle="Incrément (kg)" valeur={7.5} onChange={() => undefined} />)
    expect(champ.value).toBe('7,5')
    rerender(<ChampNombreFacultatif libelle="Incrément (kg)" valeur={null} onChange={() => undefined} />)
    expect(champ.value).toBe('')
  })
})

describe('ChampNombre (obligatoire)', () => {
  it('vide donne NaN, décimal accepté', () => {
    const commits: number[] = []
    render(<ChampNombre libelle="Repos" valeur={90} onChange={(v) => commits.push(v)} />)
    const champ = screen.getByLabelText('Repos')
    fireEvent.change(champ, { target: { value: '' } })
    expect(commits.at(-1)).toBeNaN()
    taper(champ, '1,5')
    expect(commits.at(-1)).toBe(1.5)
  })
})

describe('édition de séance : champs décimaux', () => {
  async function preparer() {
    await inserer(base, 'seances', {
      id: 's1', user_id: 'u1', updated_at: 'u', deleted_at: null, nom: 'Pull', groupes_musculaires: '[]',
      duree_estimee_min: 45, notes: '', seance_category: 'STRENGTH', created_at: 'c', is_archived: 0,
    })
    await inserer(base, 'blocs_seance', {
      id: 'b1', user_id: 'u1', updated_at: 'u', deleted_at: null, seance_id: 's1', nom: 'B', type: 'RECUPERATION',
      position: 0, duree_min: null, description: '', temps_repos_inter_sec: 20, temps_repos_fin_round_sec: 120,
      instance_seance_id: null, bloc_source_id: null,
    })
    await inserer(base, 'exercices_seance', {
      id: 'e1', user_id: 'u1', updated_at: 'u', deleted_at: null, seance_id: 's1', exercise_id: 'x', bloc_id: 'b1',
      position: 0, nombre_series_prevues: 3, reps_cibles: '', charge_cible: '', tempo: '', reps_type: 'REPS',
      temps_repos_sec: 90, consigne_cle: '', equipement: '', avertissement: '', instance_seance_id: null,
      is_bilateral: 0, progression_activee: 0, increment_duree_sec: 5, seuil_deload: 3, is_bodyweight: 0,
    })
  }

  it('Enregistrer juste après la frappe (sans blur) persiste 2.5 et 1.25', async () => {
    await preparer()
    render(
      <MemoryRouter initialEntries={['/strength/s1/edit']}>
        <Routes>
          <Route path="/strength" element={<p>liste</p>} />
          <Route path="/strength/:id/edit" element={<SeanceEditScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    // Carte repliée au départ : on la déplie puis on active la surcharge progressive
    fireEvent.click(await screen.findByRole('button', { name: /Exercice introuvable/ }))
    fireEvent.click(screen.getByRole('switch', { name: 'Surcharge progressive' }))
    const kg = await screen.findByLabelText('Incrément (kg)')
    const pct = screen.getByLabelText('Incrément (%)')
    expect(taper(kg, '2,5')).toEqual(['2', '2,', '2,5'])
    expect(taper(pct, '1.25')).toEqual(['1', '1.', '1.2', '1.25'])
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByText('liste')
    await waitFor(async () => {
      const l = await base.get<{ increment_kg: number; increment_pct: number }>(
        'SELECT increment_kg, increment_pct FROM exercices_seance WHERE id = ?', ['e1'],
      )
      expect(l).toEqual({ increment_kg: 2.5, increment_pct: 1.25 })
    })
  })
})
