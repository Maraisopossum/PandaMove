// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDb } from '../../../test/sqliteDb'
import { inserer } from '../../../test/fixtures'
import type { Db } from '../../../core/db/Db'

let db: Db
vi.mock('../../../core/db/client', () => ({ getDb: () => db }))
vi.mock('../../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import CatalogScreen from './CatalogScreen'

beforeEach(async () => {
  db = createTestDb()
  await inserer(db, 'exercises', {
    id: 'x', user_id: 'u1', updated_at: 'u', deleted_at: null, name: 'Mon tirage', category: 'BACK',
    muscle_groups: '["Grand dorsal","Biceps brachial"]', description: '', is_favorite: 0, is_custom: 1, image_url: null,
    exercise_type: '', equipment: '[]', muscle_primary: '', is_bodyweight: 0,
  })
})
afterEach(cleanup)

describe('CatalogScreen — catalogue de base', () => {
  it("affiche le muscle principal et les groupes en français", async () => {
    render(<CatalogScreen />)
    expect(await screen.findByText('Mon tirage')).toBeTruthy()
    expect(screen.getByText(/Principal :/).textContent).toContain('Dos')
    expect(screen.getByText(/Aussi : Biceps/)).toBeTruthy()
  })

  it('ajoute le catalogue de base, annonce le résultat et masque le bouton', async () => {
    render(<CatalogScreen />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter le catalogue de base' }))
    const statut = screen.getByRole('status', { name: "Résultat de l'opération" })
    await waitFor(() => expect(within(statut).getByText('166 exercices ajoutés, 0 corrigé.')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Ajouter le catalogue de base' })).toBeNull()
    expect(screen.getByText('167 exercice(s)')).toBeTruthy()
  })

  it('corrige les groupes musculaires', async () => {
    render(<CatalogScreen />)
    fireEvent.click(await screen.findByRole('button', { name: 'Corriger les groupes musculaires' }))
    await waitFor(() => expect(screen.getByText('1 exercice corrigé.')).toBeTruthy())
    const ligne = await db.get<{ muscle_primary: string }>("SELECT muscle_primary FROM exercises WHERE id = 'x'")
    expect(ligne.muscle_primary).toBe('DOS')
  })
})
