// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'

const base = createTestDb()
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import SeanceListScreen from './SeanceListScreen'
import { aujourdhuiIso } from './saisie'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const assigner = (nom: string) => `Affecter ${nom} au calendrier`

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

const boutonMenu = (nom: string) => screen.getByRole('button', { name: `Plus d'actions pour ${nom}` })

// Ouvre le menu « ⋮ » d'une carte et choisit une action
async function action(nom: string, libelle: string) {
  fireEvent.click(await screen.findByRole('button', { name: `Plus d'actions pour ${nom}` }))
  fireEvent.click(await screen.findByRole('menuitem', { name: libelle }))
}

function monter(chemin: string) {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route path="/strength" element={<SeanceListScreen />} />
        <Route path="/strength/new" element={<p>Écran création</p>} />
        <Route path="/strength/:id" element={<p>Écran détail</p>} />
        <Route path="/strength/:id/edit" element={<p>Écran édition</p>} />
        <Route path="/strength/planned" element={<p>Écran programmées</p>} />
        <Route path="/strength/instance/:id" element={<p>Écran exécution</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SeanceListScreen', () => {
  it("affiche les cartes (nom, muscles, durée, nb d'exercices), un lien vers le détail, Lancer et 📅 sur chacune", async () => {
    monter('/strength')
    expect(await screen.findByText('Pull')).toBeTruthy()
    expect(screen.getByText('Dos, Biceps · 45 min · 1 exercice')).toBeTruthy()
    expect(screen.getByText('Pectoraux · 30 min · 0 exercice')).toBeTruthy()
    expect(screen.getByLabelText(assigner('Pull'))).toBeTruthy()
    expect(screen.getByLabelText(assigner('Push'))).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^Lancer .* maintenant$/ })).toHaveLength(2)
    expect(screen.getByRole('link', { name: /Pull/ }).getAttribute('href')).toBe('/strength/s1')
    expect(screen.getByRole('link', { name: /Nouvelle séance/ }).getAttribute('href')).toBe('/strength/new')
    expect(screen.getByRole('link', { name: /Catalogue/ }).getAttribute('href')).toBe('/strength/catalog')
    expect(screen.getByRole('button', { name: 'Séance directe' })).toBeTruthy()
  })

  it("dialogue d'affectation : rôle dialog, focus piégé, Échap ferme et rend le focus", async () => {
    monter('/strength')
    await screen.findByText('Pull')
    const declencheur = screen.getByLabelText(assigner('Pull'))
    declencheur.focus()
    fireEvent.click(declencheur)

    const dialogue = await screen.findByRole('dialog')
    expect(dialogue.getAttribute('aria-modal')).toBe('true')
    expect(dialogue.className).toBe('dialogue')
    // Focus initial sur le premier choix du dialogue (non destructif)
    const premier = screen.getByRole('radio', { name: 'Une date' })
    await waitFor(() => expect(document.activeElement).toBe(premier))

    // Tab depuis le dernier élément revient au premier ; Maj+Tab depuis le premier va au dernier
    const annuler = screen.getByRole('button', { name: 'Annuler' })
    annuler.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(premier)
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(annuler)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(declencheur)
  })

  it("affecte à une date ; une erreur (séance disparue) s'affiche dans le dialogue", async () => {
    monter('/strength')
    await screen.findByText('Push')
    fireEvent.click(screen.getByLabelText(assigner('Push')))
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
    const lignes = await base.getAll<{ id: string; seance_id: string; date: string }>('SELECT id, seance_id, date FROM instances_seance')
    expect(lignes).toEqual([{ id: expect.any(String), seance_id: 's2', date: '2026-11-03' }])
    // Lien utile après l'affectation à une seule date : ouvrir l'instance créée
    expect(screen.getByRole('link', { name: 'Ouvrir la séance' }).getAttribute('href')).toBe(`/strength/instance/${lignes[0].id}`)
  })

  it("archive (réversible) : la carte passe dans « Séances archivées », le message l'annonce", async () => {
    monter('/strength')
    await screen.findByText('Push')
    await action('Push', 'Archiver')
    expect((await screen.findByRole('status')).textContent).toContain('« Push » est archivée')
    const archivees = await screen.findByRole('region', { name: 'Séances archivées' })
    expect(within(archivees).getByText('Push')).toBeTruthy()
    expect(within(archivees).getByText('Archivée')).toBeTruthy()
    const l = await base.get<{ is_archived: number }>('SELECT is_archived FROM seances WHERE id = ?', ['s2'])
    expect(l.is_archived).toBe(1)
    // Pas de Lancer ni de 📅 sur une séance archivée
    expect(screen.queryByLabelText(assigner('Push'))).toBeNull()

    // Désarchiver la remet dans la liste
    fireEvent.click(screen.getByRole('button', { name: "Plus d'actions pour Push (archivée)" }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Désarchiver' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Séances archivées' })).toBeNull())
    expect(screen.getByLabelText(assigner('Push'))).toBeTruthy()
    expect((await base.get<{ is_archived: number }>('SELECT is_archived FROM seances WHERE id = ?', ['s2'])).is_archived).toBe(0)
  })

  it('dupliquer crée « … (copie) » avec ses exercices, jamais ses instances, et propose de la modifier', async () => {
    await inserer(base, 'instances_seance', { id: 'dup-i', user_id: 'u1', updated_at: 'u', deleted_at: null, seance_id: 's1', date: '2026-10-01', is_completed: 1 })
    await inserer(base, 'exercices_seance', {
      id: 'dup-ie', user_id: 'u1', updated_at: 'u', deleted_at: null, seance_id: 's1', exercise_id: 'x', position: 0, instance_seance_id: 'dup-i',
    })
    monter('/strength')
    await screen.findByText('Pull')
    await action('Pull', 'Dupliquer')
    expect((await screen.findByRole('status')).textContent).toContain('« Pull (copie) » a été créée.')
    expect(await screen.findByText('Pull (copie)')).toBeTruthy()
    const copie = await base.get<{ id: string }>("SELECT id FROM seances WHERE nom = 'Pull (copie)'")
    expect(screen.getByRole('link', { name: 'Modifier la copie' }).getAttribute('href')).toBe(`/strength/${copie.id}/edit`)
    const exos = await base.getAll<{ instance_seance_id: string | null }>('SELECT instance_seance_id FROM exercices_seance WHERE seance_id = ?', [copie.id])
    expect(exos).toEqual([{ instance_seance_id: null }])
    const insts = await base.get<{ n: number }>('SELECT COUNT(*) AS n FROM instances_seance WHERE seance_id = ?', [copie.id])
    expect(insts.n).toBe(0)
  })

  it("« Modifier » du menu ouvre l'édition", async () => {
    monter('/strength')
    await screen.findByText('Pull')
    await action('Pull', 'Modifier')
    expect(await screen.findByText('Écran édition')).toBeTruthy()
  })
})

describe("Menu d'actions (clavier)", () => {
  it('ouvre au clic avec focus sur la première entrée, flèches circulaires, Début / Fin, Échap rend le focus au bouton', async () => {
    monter('/strength')
    await screen.findByText('Pull')
    const bouton = boutonMenu('Pull')
    expect(bouton.getAttribute('aria-haspopup')).toBe('menu')
    expect(bouton.getAttribute('aria-expanded')).toBe('false')
    bouton.focus()
    fireEvent.click(bouton)
    const menu = await screen.findByRole('menu', { name: "Plus d'actions pour Pull" })
    const entrees = within(menu).getAllByRole('menuitem')
    expect(entrees.map((e) => e.textContent)).toEqual(['Modifier', 'Dupliquer', 'Archiver', 'Supprimer…'])
    expect(bouton.getAttribute('aria-expanded')).toBe('true')
    await waitFor(() => expect(document.activeElement).toBe(entrees[0]))
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(entrees[1])
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(entrees[3])
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(entrees[0])
    fireEvent.keyDown(menu, { key: 'End' })
    expect(document.activeElement).toBe(entrees[3])
    fireEvent.keyDown(menu, { key: 'Home' })
    expect(document.activeElement).toBe(entrees[0])
    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(bouton)
    expect(bouton.getAttribute('aria-expanded')).toBe('false')
  })

  it('flèche haut sur le bouton ouvre le menu sur la dernière entrée ; Tab et clic ailleurs le ferment', async () => {
    monter('/strength')
    await screen.findByText('Pull')
    const bouton = boutonMenu('Pull')
    bouton.focus()
    fireEvent.keyDown(bouton, { key: 'ArrowUp' })
    const menu = await screen.findByRole('menu')
    await waitFor(() => expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'Supprimer…' })))
    fireEvent.keyDown(menu, { key: 'Tab' })
    expect(screen.queryByRole('menu')).toBeNull()

    fireEvent.keyDown(bouton, { key: 'ArrowDown' })
    await screen.findByRole('menu')
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it("choisir une action rend le focus au bouton avant d'ouvrir le dialogue (le focus y revient à la fermeture)", async () => {
    monter('/strength')
    await screen.findByText('Pull')
    const bouton = boutonMenu('Pull')
    bouton.focus()
    await action('Pull', 'Supprimer…')
    await screen.findByRole('dialog')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.activeElement).toBe(bouton)
  })
})

describe('Suppression depuis la liste', () => {
  const instance = (id: string, seanceId: string, fait: number) =>
    inserer(base, 'instances_seance', {
      id, user_id: 'u1', updated_at: 'u', deleted_at: null, seance_id: seanceId, date: '2026-10-01', is_completed: fait,
    })

  it('chaque carte propose Lancer, 📅 et un menu (Modifier, Dupliquer, Archiver, Supprimer)', async () => {
    monter('/strength')
    const carte = (await screen.findByText('Pull')).closest('li') as HTMLElement
    expect(carte.querySelector('[aria-label="Lancer Pull maintenant"]')).not.toBeNull()
    expect(carte.querySelector('[aria-label="Affecter Pull au calendrier"]')).not.toBeNull()
    expect(carte.querySelector('[aria-label="Plus d\'actions pour Pull"]')).not.toBeNull()
    expect(carte.textContent).toContain('📅')
  })

  it("dialogue : effectifs, avertissement, deux choix expliqués, a11y ; Échap rend le focus ; rien n'est supprimé", async () => {
    await seance('s3', 'Squat')
    await instance('s3-ip', 's3', 0)
    await instance('s3-ic1', 's3', 1)
    await instance('s3-ic2', 's3', 1)
    monter('/strength')
    await screen.findByText('Squat')
    const declencheur = boutonMenu('Squat')
    declencheur.focus()
    await action('Squat', 'Supprimer…')

    const dialogue = await screen.findByRole('dialog', { name: 'Supprimer cette séance ?' })
    expect(dialogue.getAttribute('aria-modal')).toBe('true')
    expect(dialogue.className).toBe('dialogue')
    expect(dialogue.textContent).toContain('1 séance planifiée et 2 séances réalisées liées à ce modèle')
    expect(dialogue.textContent).toContain('Cette action est définitive')
    expect(dialogue.textContent).toContain(
      "Supprime le modèle et les séances planifiées, conserve les séances déjà réalisées (calendrier, statistiques)",
    )
    expect(dialogue.textContent).toContain('Supprime aussi les séances réalisées et leurs séries')
    for (const nom of ["Garder l'historique", 'Tout supprimer', 'Annuler']) {
      expect(screen.getByRole('button', { name: nom })).toBeTruthy()
    }
    await waitFor(() => expect(dialogue.contains(document.activeElement)).toBe(true))

    // focus piégé
    screen.getByRole('button', { name: 'Annuler' }).focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(dialogue.contains(document.activeElement)).toBe(true)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(declencheur)
    const l = await base.get<{ deleted_at: string | null }>('SELECT deleted_at FROM seances WHERE id = ?', ['s3'])
    expect(l.deleted_at).toBeNull()
  })

  it("focus initial sur « Annuler » (variante avec historique) : activer le bouton focalisé ne supprime rien", async () => {
    await seance('s7', 'Fente')
    await instance('s7-ic', 's7', 1)
    monter('/strength')
    await action('Fente', 'Supprimer…')
    await screen.findByRole('dialog')
    const annuler = screen.getByRole('button', { name: 'Annuler' })
    await waitFor(() => expect(document.activeElement).toBe(annuler))
    // Entrée / Espace sur un bouton déclenchent son clic : on simule cette activation (pas de user-event installé)
    ;(document.activeElement as HTMLElement).click()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const l = await base.get<{ deleted_at: string | null }>('SELECT deleted_at FROM seances WHERE id = ?', ['s7'])
    expect(l.deleted_at).toBeNull()
  })

  it("focus initial sur « Annuler » (variante sans historique) : activer le bouton focalisé ne supprime rien", async () => {
    await seance('s8', 'Gainage')
    monter('/strength')
    await action('Gainage', 'Supprimer…')
    await screen.findByRole('dialog')
    const annuler = screen.getByRole('button', { name: 'Annuler' })
    await waitFor(() => expect(document.activeElement).toBe(annuler))
    ;(document.activeElement as HTMLElement).click()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const l = await base.get<{ deleted_at: string | null }>('SELECT deleted_at FROM seances WHERE id = ?', ['s8'])
    expect(l.deleted_at).toBeNull()
  })

  it("« Garder l'historique » supprime le modèle et conserve les séances réalisées", async () => {
    monter('/strength')
    await action('Squat', 'Supprimer…')
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: "Garder l'historique" }))
    await waitFor(() => expect(screen.queryByText('Squat')).toBeNull())
    expect(screen.queryByRole('dialog')).toBeNull()
    const rows = await base.getAll<{ id: string; deleted_at: string | null }>(
      "SELECT id, deleted_at FROM instances_seance WHERE seance_id = 's3' ORDER BY id",
    )
    expect(rows.map((r) => [r.id, r.deleted_at !== null])).toEqual([['s3-ic1', false], ['s3-ic2', false], ['s3-ip', true]])
  })

  it('« Tout supprimer » supprime aussi les séances réalisées', async () => {
    await seance('s5', 'Tractions')
    await instance('s5-ic', 's5', 1)
    monter('/strength')
    await action('Tractions', 'Supprimer…')
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Tout supprimer' }))
    await waitFor(() => expect(screen.queryByText('Tractions')).toBeNull())
    const r = await base.get<{ deleted_at: string | null }>('SELECT deleted_at FROM instances_seance WHERE id = ?', ['s5-ic'])
    expect(r.deleted_at).not.toBeNull()
  })

  it("sans historique : une seule confirmation « Supprimer », pas de choix", async () => {
    await seance('s4', 'Vierge')
    monter('/strength')
    await action('Vierge', 'Supprimer…')
    const dialogue = await screen.findByRole('dialog', { name: 'Supprimer cette séance ?' })
    expect(dialogue.textContent).toContain('Cette action est définitive')
    expect(screen.queryByRole('button', { name: "Garder l'historique" })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tout supprimer' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(screen.queryByText('Vierge')).toBeNull())
    const l = await base.get<{ deleted_at: string | null }>('SELECT deleted_at FROM seances WHERE id = ?', ['s4'])
    expect(l.deleted_at).not.toBeNull()
  })

  it("erreur (séance disparue entre-temps) : message français dans la liste, dialogue fermé", async () => {
    await seance('s6', 'Fantôme')
    monter('/strength')
    await action('Fantôme', 'Supprimer…')
    await screen.findByRole('dialog')
    await base.execute("UPDATE seances SET deleted_at = 'x' WHERE id = 's6'")
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Séance introuvable.')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('Lancer une séance type maintenant', () => {
  const instancesDe = (seanceId: string) =>
    base.getAll<{ id: string; date: string; started_at: string | null; is_completed: number }>(
      'SELECT id, date, started_at, is_completed FROM instances_seance WHERE seance_id = ? AND deleted_at IS NULL ORDER BY id',
      [seanceId],
    )

  it('« Lancer » est un vrai bouton visible ; le nom de la séance est un lien distinct vers son détail', async () => {
    await seance('l1', 'Dos express')
    monter('/strength')
    const lancer = await screen.findByRole('button', { name: 'Lancer Dos express maintenant' })
    expect(lancer.tagName).toBe('BUTTON')
    expect(lancer.textContent).toBe('Lancer')
    const carte = lancer.closest('li') as HTMLElement
    expect(carte.querySelector('a[href="/strength/l1"]')).not.toBeNull()
  })

  it("« Lancer » démarre tout de suite, sans dialogue : crée l'instance du jour, la démarre et ouvre l'exécution", async () => {
    await seance('l2', 'Bras')
    monter('/strength')
    fireEvent.click(await screen.findByRole('button', { name: 'Lancer Bras maintenant' }))
    expect(await screen.findByText('Écran exécution')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    const lignes = await instancesDe('l2')
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({ date: aujourdhuiIso(), is_completed: 0 })
    expect(lignes[0].started_at).not.toBeNull()
  })

  it('un double clic sur « Lancer » ne crée qu’une seule instance', async () => {
    await seance('l2b', 'Épaules')
    monter('/strength')
    const bouton = await screen.findByRole('button', { name: 'Lancer Épaules maintenant' })
    fireEvent.click(bouton)
    fireEvent.click(bouton)
    expect(await screen.findByText('Écran exécution')).toBeTruthy()
    expect(await instancesDe('l2b')).toHaveLength(1)
  })

  it("une instance non terminée du même modèle prévue aujourd'hui est reprise (pas de seconde instance)", async () => {
    await seance('l3', 'Jambes')
    await inserer(base, 'instances_seance', {
      id: 'l3-prevue', user_id: 'u1', updated_at: 'u', deleted_at: null, seance_id: 'l3', date: aujourdhuiIso(), is_completed: 0,
    })
    monter('/strength')
    fireEvent.click(await screen.findByRole('button', { name: 'Lancer Jambes maintenant' }))
    expect(await screen.findByText('Écran exécution')).toBeTruthy()
    const lignes = await instancesDe('l3')
    expect(lignes.map((l) => l.id)).toEqual(['l3-prevue'])
    expect(lignes[0].started_at).not.toBeNull()
  })

  it('erreur (séance disparue) : message français sur la page, rien n’est créé', async () => {
    await seance('l4', 'Disparue')
    monter('/strength')
    const bouton = await screen.findByRole('button', { name: 'Lancer Disparue maintenant' })
    await base.execute("UPDATE seances SET deleted_at = 'x' WHERE id = 'l4'")
    fireEvent.click(bouton)
    expect((await screen.findByRole('alert')).textContent).toBe('Séance introuvable.')
    expect(await instancesDe('l4')).toEqual([])
  })
})
