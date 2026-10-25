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

afterEach(cleanup)

const assigner = (nom: string) => `Affecter ${nom} au calendrier`

async function seance(id: string, nom: string) {
  await inserer(base, 'seances', {
    id, user_id: 'u1', updated_at: 'u', deleted_at: null, nom, groupes_musculaires: '["DOS"]',
    duree_estimee_min: 45, notes: '', seance_category: 'STRENGTH', created_at: 'c', is_archived: 0,
  })
}

await seance('m1', 'Multi')
await seance('r1', 'Répétée')
await seance('r2', 'Répétée 2')

function monter() {
  return render(
    <MemoryRouter initialEntries={['/strength']}>
      <Routes>
        <Route path="/strength" element={<SeanceListScreen />} />
        <Route path="/strength/:id/edit" element={<p>Écran édition</p>} />
        <Route path="/strength/instance/:id" element={<p>Écran exécution</p>} />
        <Route path="/strength/planned" element={<p>Écran programmées</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const datesDe = async (seanceId: string) =>
  (await base.getAll<{ date: string }>('SELECT date FROM instances_seance WHERE seance_id = ? AND deleted_at IS NULL ORDER BY date', [seanceId])).map(
    (l) => l.date,
  )

describe('Affectation : plusieurs dates et répétition', () => {
  it('plusieurs dates : liste de dates retirables, une instance par date, lien vers les séances programmées', async () => {
    monter()
    fireEvent.click(await screen.findByLabelText(assigner('Multi')))
    fireEvent.click(await screen.findByRole('radio', { name: 'Plusieurs dates' }))

    // Rien n'est choisi : message d'aide, et Confirmer refuse
    expect(screen.getByText(/Aucune date choisie/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Ajoutez au moins une date.')
    expect(screen.getByRole('dialog')).toBeTruthy()

    const champ = screen.getByLabelText('Date à ajouter')
    for (const d of ['2026-12-08', '2026-12-01', '2026-12-15']) {
      fireEvent.change(champ, { target: { value: d } })
      fireEvent.click(screen.getByRole('button', { name: 'Ajouter cette date' }))
    }
    // Triées ; on peut en retirer une
    const liste = screen.getByRole('list', { name: 'Dates choisies' })
    expect(within(liste).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['01/12/2026✕', '08/12/2026✕', '15/12/2026✕'])
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le 15/12/2026' }))
    expect(screen.getByRole('status').textContent).toBe('2 séances seront créées, du 01/12/2026 au 08/12/2026.')

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('status').textContent).toBe('« Multi » est affectée à 2 dates, du 01/12/2026 au 08/12/2026.')
    expect(screen.getByRole('link', { name: 'Voir les séances programmées' }).getAttribute('href')).toBe('/strength/planned')
    expect(await datesDe('m1')).toEqual(['2026-12-01', '2026-12-08'])
  })

  it('répétition : toutes les 2 semaines, 3 séances ; aperçu, puis instances créées', async () => {
    monter()
    fireEvent.click(await screen.findByLabelText(assigner('Répétée')))
    fireEvent.click(await screen.findByRole('radio', { name: 'Répéter' }))
    fireEvent.change(screen.getByLabelText('Première séance'), { target: { value: '2027-01-04' } })
    fireEvent.change(screen.getByLabelText('Tous les'), { target: { value: '2' } })
    expect((screen.getByLabelText('Unité') as HTMLSelectElement).value).toBe('semaine')
    // Valeur par défaut d'Android : 8 séances
    expect((screen.getByLabelText('Nombre de séances') as HTMLInputElement).value).toBe('8')
    fireEvent.change(screen.getByLabelText('Nombre de séances'), { target: { value: '3' } })
    expect(screen.getByRole('status').textContent).toBe('3 séances seront créées, du 04/01/2027 au 01/02/2027.')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await datesDe('r1')).toEqual(['2027-01-04', '2027-01-18', '2027-02-01'])
  })

  it('répétition : valeur invalide refusée avec un message, rien créé ; fin « à une date »', async () => {
    monter()
    fireEvent.click(await screen.findByLabelText(assigner('Répétée 2')))
    fireEvent.click(await screen.findByRole('radio', { name: 'Répéter' }))
    fireEvent.change(screen.getByLabelText('Tous les'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Répétition invalide')
    expect(await datesDe('r2')).toEqual([])

    fireEvent.change(screen.getByLabelText('Tous les'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Unité'), { target: { value: 'jour' } })
    fireEvent.change(screen.getByLabelText('Fin de la répétition'), { target: { value: 'date' } })
    fireEvent.change(screen.getByLabelText('Première séance'), { target: { value: '2027-03-01' } })
    fireEvent.change(screen.getByLabelText("Jusqu'au"), { target: { value: '2027-03-03' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await datesDe('r2')).toEqual(['2027-03-01', '2027-03-02', '2027-03-03'])
  })
})

describe('Séance directe', () => {
  it("crée une séance STRENGTH_ONESHOT planifiée aujourd'hui puis ouvre son EXÉCUTION (les exercices s'y ajoutent) ; absente de la liste des modèles", async () => {
    monter()
    const declencheur = await screen.findByRole('button', { name: 'Séance directe' })
    declencheur.focus()
    fireEvent.click(declencheur)
    const dialogue = await screen.findByRole('dialog', { name: 'Séance directe' })
    expect(dialogue.className).toBe('dialogue')
    const champ = screen.getByLabelText('Nom de la séance') as HTMLInputElement
    const [, m, j] = aujourdhuiIso().split('-').map(Number)
    expect(champ.placeholder).toBe(`Séance du ${j}/${m}`)
    await waitFor(() => expect(document.activeElement).toBe(champ))

    // Échap ferme sans rien créer et rend le focus
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(declencheur)
    expect((await base.get<{ n: number }>("SELECT COUNT(*) AS n FROM seances WHERE seance_category = 'STRENGTH_ONESHOT'")).n).toBe(0)

    fireEvent.click(declencheur)
    fireEvent.change(await screen.findByLabelText('Nom de la séance'), { target: { value: 'Express du soir' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer et commencer' }))
    expect(await screen.findByText('Écran exécution')).toBeTruthy()
    const s = await base.get<{ id: string; nom: string }>("SELECT id, nom FROM seances WHERE seance_category = 'STRENGTH_ONESHOT'")
    expect(s.nom).toBe('Express du soir')
    const i = await base.get<{ date: string; is_completed: number }>('SELECT date, is_completed FROM instances_seance WHERE seance_id = ?', [s.id])
    expect(i).toEqual({ date: aujourdhuiIso(), is_completed: 0 })
  })
})
