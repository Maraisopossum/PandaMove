// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import { CarteDemarrage } from './CarteDemarrage'
import { CLE_DEMARRAGE_MASQUE } from './useDemarrage'

const b = { user_id: 'u1', updated_at: 'u0', deleted_at: null }
let db: Db

beforeEach(() => {
  db = createTestDb()
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const monter = (base: Db = db) =>
  render(
    <MemoryRouter>
      <CarteDemarrage db={base} />
    </MemoryRouter>,
  )
const attendreLecture = () => new Promise((r) => setTimeout(r, 30))

describe('CarteDemarrage', () => {
  it('base vide : trois étapes numérotées avec leurs liens', async () => {
    monter()
    expect(await screen.findByRole('heading', { level: 2, name: 'Pour commencer' })).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'Importer un fichier' }).getAttribute('href')).toBe('/import')
    expect(screen.getByRole('link', { name: 'Aller au catalogue' }).getAttribute('href')).toBe('/strength/catalog')
    expect(screen.getByRole('link', { name: 'Créer une séance' }).getAttribute('href')).toBe('/strength/new')
  })

  it('catalogue de base présent : l’étape 2 est marquée « Fait » (texte, pas seulement la couleur) et n’a plus de lien', async () => {
    await inserer(db, 'exercises', { ...b, id: 'x1', name: 'Squat', is_custom: 0 })
    monter()
    await screen.findByRole('heading', { name: 'Pour commencer' })
    expect(screen.getByText('Fait')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Aller au catalogue' })).toBeNull()
  })

  it('un exercice personnalisé ne compte pas pour le catalogue de base', async () => {
    await inserer(db, 'exercises', { ...b, id: 'x1', name: 'Mon exercice', is_custom: 1 })
    monter()
    await screen.findByRole('heading', { name: 'Pour commencer' })
    expect(screen.queryByText('Fait')).toBeNull()
  })

  it('dès qu’une séance type existe, la carte ne s’affiche pas', async () => {
    await inserer(db, 'seances', { ...b, id: 's1', nom: 'Pull', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
    monter()
    await attendreLecture()
    expect(screen.queryByRole('heading', { name: 'Pour commencer' })).toBeNull()
  })

  it('une séance programmée suffit aussi', async () => {
    await inserer(db, 'instances_seance', { ...b, id: 'i1', seance_id: 's1', date: '2026-10-26', is_completed: 0 })
    monter()
    await attendreLecture()
    expect(screen.queryByRole('heading', { name: 'Pour commencer' })).toBeNull()
  })

  it('une séance supprimée logiquement ne compte pas', async () => {
    await inserer(db, 'seances', { ...b, deleted_at: 'x', id: 's1', nom: 'Pull', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
    monter()
    expect(await screen.findByRole('heading', { name: 'Pour commencer' })).toBeTruthy()
  })

  it('une séance d’une autre catégorie (course) ne compte pas', async () => {
    await inserer(db, 'seances', { ...b, id: 's1', nom: 'Footing', is_archived: 0, seance_category: 'RUNNING', created_at: 'c' })
    monter()
    expect(await screen.findByRole('heading', { name: 'Pour commencer' })).toBeTruthy()
  })

  it('« Masquer ces conseils » retire la carte et se souvient du choix', async () => {
    monter()
    fireEvent.click(await screen.findByRole('button', { name: 'Masquer ces conseils' }))
    expect(screen.queryByRole('heading', { name: 'Pour commencer' })).toBeNull()
    expect(window.localStorage.getItem(CLE_DEMARRAGE_MASQUE)).toBe('1')
    cleanup()
    monter()
    await attendreLecture()
    expect(screen.queryByRole('heading', { name: 'Pour commencer' })).toBeNull()
  })

  it('stockage local inaccessible : la carte s’affiche et se masque quand même, sans erreur', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqué')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqué')
    })
    monter()
    fireEvent.click(await screen.findByRole('button', { name: 'Masquer ces conseils' }))
    expect(screen.queryByRole('heading', { name: 'Pour commencer' })).toBeNull()
  })

  it('erreur de lecture de la base : rien n’est affiché', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const casse = { ...db, get: () => Promise.reject(new Error('base fermée')) } as unknown as Db
    monter(casse)
    await attendreLecture()
    expect(screen.queryByRole('heading', { name: 'Pour commencer' })).toBeNull()
  })

  it('attend la lecture avant de décider (rien d’affiché pendant le chargement)', async () => {
    monter()
    expect(screen.queryByRole('heading', { name: 'Pour commencer' })).toBeNull()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Pour commencer' })).toBeTruthy())
  })
})
