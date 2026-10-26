// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'

let base: Db
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import CalendarScreen from './CalendarScreen'

const b = { user_id: 'u1', updated_at: 'u0', deleted_at: null }

beforeEach(async () => {
  // Seule l'horloge est simulée : les minuteries réelles servent toujours à waitFor
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 24, 15, 0)) // samedi 24 octobre 2026
  base = createTestDb()
  await inserer(base, 'seances', { ...b, id: 's1', nom: 'Pull', is_archived: 0, created_at: 'c' })
  await inserer(base, 'seances', { ...b, id: 's2', nom: 'Jambes', is_archived: 0, created_at: 'c' })
  await inserer(base, 'instances_seance', { ...b, id: 'plan', seance_id: 's1', date: '2026-10-24', is_completed: 0 })
  await inserer(base, 'instances_seance', { ...b, id: 'plan2', seance_id: 's2', date: '2026-10-24', is_completed: 0 })
  await inserer(base, 'instances_seance', {
    ...b, id: 'fait', seance_id: 's1', date: '2026-10-05', is_completed: 1, duration_seconds: 3000,
  })
  await inserer(base, 'instances_seance', { ...b, id: 'futur', seance_id: 's1', date: '2026-11-10', is_completed: 0 })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function monter() {
  return render(
    <MemoryRouter>
      <CalendarScreen />
    </MemoryRouter>,
  )
}

const prochaines = () => within(screen.getByRole('region', { name: 'Prochaines séances' }))

describe('CalendarScreen', () => {
  it('affiche le mois courant, l\'en-tête des jours et un bouton par jour avec nom accessible', async () => {
    monter()
    expect(await screen.findByRole('heading', { name: 'octobre 2026' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'samedi 24 octobre 2026, 2 séances' }).getAttribute('aria-current')).toBe('date')
    expect(screen.getByRole('button', { name: 'lundi 5 octobre 2026, 1 séance' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'mardi 6 octobre 2026, aucune séance' })).toBeTruthy()
    expect(document.querySelectorAll('.calendrier__jour')).toHaveLength(35)
    expect(screen.getByRole('button', { name: /lundi 28 septembre 2026/ })).toBeTruthy()
    expect(document.body.textContent).toContain('lun.')
    expect(document.body.textContent).toContain('dim.')
  })

  it("sélectionne aujourd'hui par défaut et affiche ses séances avec les liens d'ouverture", async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    const panneau = screen.getByRole('region', { name: 'samedi 24 octobre 2026' })
    expect(within(panneau).getByText('Pull')).toBeTruthy()
    expect(within(panneau).getByText('Jambes')).toBeTruthy()
    const ouvrir = within(panneau).getByRole('link', { name: /Ouvrir Pull/ })
    expect(ouvrir.getAttribute('href')).toBe('/strength/instance/plan')
  })

  it('un jour choisi affiche ses séances ; une séance terminée ouvre le bilan et ne propose pas de changer la date', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    fireEvent.click(screen.getByRole('button', { name: 'lundi 5 octobre 2026, 1 séance' }))
    const panneau = screen.getByRole('region', { name: 'lundi 5 octobre 2026' })
    expect(within(panneau).getByRole('link', { name: /Ouvrir Pull/ }).getAttribute('href')).toBe('/strength/instance/fait/report')
    expect(within(panneau).queryByRole('button', { name: /Changer la date/ })).toBeNull()
    expect(within(panneau).getByRole('button', { name: /Supprimer Pull/ })).toBeTruthy()
    expect(within(panneau).getByText(/Terminée · 50 min/)).toBeTruthy()
  })

  it('un jour sans séance le dit', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    fireEvent.click(screen.getByRole('button', { name: 'mardi 6 octobre 2026, aucune séance' }))
    expect(screen.getByText('Aucune séance ce jour-là.')).toBeTruthy()
  })

  it('navigation : mois suivant, précédent et « Aujourd\'hui »', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    fireEvent.click(screen.getByRole('button', { name: 'Mois suivant' }))
    expect(await screen.findByRole('heading', { name: 'novembre 2026' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'mardi 10 novembre 2026, 1 séance' })).toBeTruthy()
    // pas de sélection par défaut hors du mois courant
    expect(screen.queryByRole('region', { name: /octobre|novembre/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Mois précédent' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mois précédent' }))
    expect(await screen.findByRole('heading', { name: 'septembre 2026' })).toBeTruthy()
    expect(await screen.findByText('Aucune séance ce mois-ci.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: "Aujourd'hui" }))
    expect(await screen.findByRole('heading', { name: 'octobre 2026' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'samedi 24 octobre 2026' })).toBeTruthy()
  })

  it('filtre terminées : la grille ne garde que les terminées, les prochaines ne changent pas', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    fireEvent.click(screen.getByRole('button', { name: 'Terminées' }))
    expect(screen.getByRole('button', { name: 'Terminées' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'samedi 24 octobre 2026, aucune séance' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'lundi 5 octobre 2026, 1 séance' })).toBeTruthy()
    expect(prochaines().getAllByRole('listitem')).toHaveLength(3)
  })

  it('« Prochaines séances » : date, nom, lien ; états vides', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    const lignes = prochaines().getAllByRole('listitem')
    expect(lignes).toHaveLength(3) // plan, plan2, futur (la terminée est exclue)
    expect(within(lignes[2]).getByRole('link', { name: /Ouvrir Pull/ }).getAttribute('href')).toBe('/strength/instance/futur')
    expect(lignes[2].textContent).toContain('10 nov.')
  })

  it('base vide : messages vides et aucune erreur', async () => {
    base = createTestDb()
    monter()
    expect(await screen.findByText('Aucune séance ce mois-ci.')).toBeTruthy()
    expect(screen.getByText('Aucune séance à venir.')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    // Panda au repos, décoratif (le texte porte le sens), dimensionné, chargé à la demande
    await waitFor(() => expect(document.querySelector('img.calendrier__panda')).not.toBeNull())
    const panda = document.querySelector('img.calendrier__panda')!
    expect(panda.getAttribute('alt')).toBe('')
    expect(panda.getAttribute('src')).toBe('/panda/pose-sitting-male-sm.webp')
    expect(panda.getAttribute('loading')).toBe('lazy')
    expect(panda.getAttribute('width')).toBe('320')
  })

  it('aucune icône 📅 dans le calendrier (réservée à la liste des séances)', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    fireEvent.click(screen.getAllByRole('button', { name: /Changer la date de Pull, samedi 24 octobre 2026/ })[0])
    expect(document.body.textContent).not.toContain('📅')
    expect(document.body.innerHTML).not.toContain('📅')
    expect(screen.queryByLabelText('Affecter à une date')).toBeNull()
  })

  describe('dialogue « Changer la date »', () => {
    it('rôle dialog arrondi, focus initial sur le champ date, Échap ferme et rend le focus', async () => {
      monter()
      await screen.findByRole('heading', { name: 'octobre 2026' })
      const declencheur = within(screen.getByRole('region', { name: 'samedi 24 octobre 2026' })).getByRole('button', {
        name: /Changer la date de Pull/,
      })
      declencheur.focus()
      fireEvent.click(declencheur)
      const dialogue = await screen.findByRole('dialog')
      expect(dialogue.getAttribute('aria-modal')).toBe('true')
      const champ = within(dialogue).getByLabelText('Nouvelle date') as HTMLInputElement
      expect(champ.type).toBe('date')
      expect(champ.value).toBe('2026-10-24')
      expect(document.activeElement).toBe(champ)
      fireEvent.keyDown(document, { key: 'Escape' })
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(document.activeElement).toBe(declencheur)
    })

    it('Confirmer déplace la séance et la grille se met à jour', async () => {
      monter()
      await screen.findByRole('heading', { name: 'octobre 2026' })
      fireEvent.click(
        within(screen.getByRole('region', { name: 'samedi 24 octobre 2026' })).getByRole('button', { name: /Changer la date de Pull/ }),
      )
      const dialogue = await screen.findByRole('dialog')
      fireEvent.change(within(dialogue).getByLabelText('Nouvelle date'), { target: { value: '2026-10-27' } })
      fireEvent.click(within(dialogue).getByRole('button', { name: 'Confirmer' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(await screen.findByRole('button', { name: 'mardi 27 octobre 2026, 1 séance' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'samedi 24 octobre 2026, 1 séance' })).toBeTruthy()
    })

    it('Annuler ne change rien', async () => {
      monter()
      await screen.findByRole('heading', { name: 'octobre 2026' })
      fireEvent.click(
        within(screen.getByRole('region', { name: 'samedi 24 octobre 2026' })).getByRole('button', { name: /Changer la date de Pull/ }),
      )
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Annuler' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.getByRole('button', { name: 'samedi 24 octobre 2026, 2 séances' })).toBeTruthy()
    })
  })

  describe('dialogue de suppression', () => {
    async function ouvrir() {
      monter()
      await screen.findByRole('heading', { name: 'octobre 2026' })
      const declencheur = within(screen.getByRole('region', { name: 'samedi 24 octobre 2026' })).getByRole('button', {
        name: /Supprimer Pull/,
      })
      declencheur.focus()
      fireEvent.click(declencheur)
      return { declencheur, dialogue: await screen.findByRole('dialog') }
    }

    it('texte de confirmation, arrondi 28 px, focus initial sur « Annuler », boutons ≥ 44 px', async () => {
      const { dialogue } = await ouvrir()
      expect(within(dialogue).getByText('Supprimer cette séance du calendrier ?')).toBeTruthy()
      expect(within(dialogue).getByText('Cette action est définitive.')).toBeTruthy()
      expect(document.activeElement).toBe(within(dialogue).getByRole('button', { name: 'Annuler' }))
      expect(dialogue.getAttribute('aria-labelledby')).toBeTruthy()
      expect(dialogue.classList.contains('dialogue')).toBe(true)
    })

    it('Échap ferme sans rien supprimer et rend le focus au déclencheur', async () => {
      const { declencheur } = await ouvrir()
      fireEvent.keyDown(document, { key: 'Escape' })
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(document.activeElement).toBe(declencheur)
      expect(screen.getByRole('button', { name: 'samedi 24 octobre 2026, 2 séances' })).toBeTruthy()
    })

    it('Supprimer retire la séance du calendrier', async () => {
      const { dialogue } = await ouvrir()
      fireEvent.click(within(dialogue).getByRole('button', { name: 'Supprimer' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(await screen.findByRole('button', { name: 'samedi 24 octobre 2026, 1 séance' })).toBeTruthy()
      const row = await base.getOptional<{ deleted_at: string | null }>("SELECT deleted_at FROM instances_seance WHERE id = 'plan'")
      expect(row?.deleted_at).not.toBeNull()
    })
  })

  it('une erreur de déplacement s\'affiche en français', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    fireEvent.click(
      within(screen.getByRole('region', { name: 'samedi 24 octobre 2026' })).getByRole('button', { name: /Changer la date de Pull/ }),
    )
    const dialogue = await screen.findByRole('dialog')
    await base.execute("UPDATE instances_seance SET deleted_at = 'x' WHERE id = 'plan'")
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Confirmer' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/introuvable/i)
  })
})
