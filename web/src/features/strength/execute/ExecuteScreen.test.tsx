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
        <Route path="/strength/instance/:id/edit" element={<p>Écran édition des exercices</p>} />
        <Route path="/strength/planned" element={<p>Séances programmées</p>} />
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
    fireEvent.click(await screen.findByRole('button', { name: 'Terminer la séance' }))
    // Dialogue arrondi (texte de l'Android + précisions), « Annuler » ne termine rien
    const dialogue = screen.getByRole('dialog', { name: 'Terminer la séance ?' })
    expect(dialogue.textContent).toContain('Aucune série n’est validée : le rapport sera vide.')
    expect(dialogue.textContent).toContain('Les résultats seront sauvegardés et la séance marquée comme terminée.')
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    const ligne = () => base.get<{ is_completed: number }>("SELECT is_completed FROM instances_seance WHERE id = 'i-fin'")
    expect((await ligne()).is_completed).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Terminer la séance ?' })).getByRole('button', { name: 'Terminer' }))
    expect(await screen.findByText('Écran bilan')).toBeTruthy()
    expect((await ligne()).is_completed).toBe(1)
  })

  it('la confirmation rappelle les séries prévues non validées', async () => {
    await instance('i-fin-reste')
    monter('i-fin-reste')
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer' }))
    fireEvent.click(within(carte('Développé couché')).getByRole('button', { name: 'Valider la série 1' }))
    await waitFor(async () => expect(await series('i-fin-reste')).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }))
    // 3 + 2 séries prévues, 1 validée
    expect(screen.getByRole('dialog', { name: 'Terminer la séance ?' }).textContent).toContain('4 séries prévues ne sont pas validées : elles ne seront pas comptées.')
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

describe('ExecuteScreen : outils de l’exercice', () => {
  it('le calculateur de disques part de la charge de la prochaine série et donne les disques de chaque côté', async () => {
    await instance('i-disques')
    monter('i-disques')
    const dc = await screen.findByRole('article', { name: 'Développé couché' })
    fireEvent.click(within(dc).getByRole('button', { name: /Disques/ }))
    const feuille = screen.getByRole('dialog', { name: 'Calculateur de disques' })
    expect((within(feuille).getByLabelText('Poids total (kg)') as HTMLInputElement).value).toBe('60')
    expect((within(feuille).getByLabelText('Barre (kg)') as HTMLInputElement).value).toBe('20')
    // 60 kg, barre 20 kg : 20 kg par côté
    expect(within(feuille).getByText('20 kg', { selector: '.disques__disques' })).toBeTruthy()
    fireEvent.change(within(feuille).getByLabelText('Poids total (kg)'), { target: { value: '62,5' } })
    expect(within(feuille).getByText('20 kg + 1,25 kg')).toBeTruthy()
    fireEvent.click(within(feuille).getByRole('button', { name: 'Haltère' }))
    expect((within(feuille).getByLabelText('Haltère vide (kg)') as HTMLInputElement).value).toBe('2')
    fireEvent.click(within(feuille).getByRole('button', { name: 'Fermer' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('la montée en charge propose des paliers à cocher dans l’ordre, avec un chrono de repos', async () => {
    await instance('i-montee')
    monter('i-montee')
    const dc = await screen.findByRole('article', { name: 'Développé couché' })
    fireEvent.click(within(dc).getByRole('button', { name: /Montée en charge/ }))
    const feuille = screen.getByRole('dialog', { name: /Montée en charge/ })
    // 60 kg, protocole standard (type d'exercice inconnu) : 40 % = 24, 60 % = 36, 80 % = 48
    expect(within(feuille).getByText('24 kg × 10 reps')).toBeTruthy()
    expect(within(feuille).getByText('48 kg × 3 reps')).toBeTruthy()
    expect((within(feuille).getByRole('button', { name: 'Palier 2 fait' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(within(feuille).getByRole('button', { name: 'Palier 1 fait' }))
    expect(within(feuille).getByRole('timer').textContent).toMatch(/^Repos : 01:0\d$|^Repos : 01:00$/)
    expect((within(feuille).getByRole('button', { name: 'Palier 2 fait' }) as HTMLButtonElement).disabled).toBe(false)
    // Changer de protocole recalcule
    fireEvent.click(within(feuille).getByRole('button', { name: 'Débutant' }))
    expect(within(feuille).getByText('30 kg × 8 reps')).toBeTruthy()
    // Aucune série réalisée n'est créée
    expect(await series('i-montee')).toEqual([])
    fireEvent.click(within(feuille).getByRole('button', { name: 'Je suis déjà chaud' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('pas de montée en charge pour un exercice sans charge cible (poids de corps)', async () => {
    await instance('i-sans-montee')
    monter('i-sans-montee')
    await screen.findByRole('article', { name: 'Développé couché' })
    choisir('Gainage planche')
    expect(within(carte('Gainage planche')).queryByRole('button', { name: /Montée en charge/ })).toBeNull()
  })

  it('une note par exercice, gardée au rechargement', async () => {
    await instance('i-note')
    const rendu = monter('i-note')
    const champ = async () => (await within(await screen.findByRole('article', { name: 'Développé couché' })).findByLabelText('Note sur Développé couché')) as HTMLTextAreaElement
    fireEvent.change(await champ(), { target: { value: 'Épaule gauche sensible' } })
    expect((await champ()).value).toBe('Épaule gauche sensible')
    // Enregistrée à la sortie du champ, sur la ligne de l'instance seulement (jamais le modèle)
    fireEvent.blur(await champ())
    await waitFor(async () =>
      expect((await base.get<{ notes: string | null }>("SELECT notes FROM exercices_seance WHERE instance_seance_id = 'i-note' AND exercice_source_id = 'e1'")).notes).toBe('Épaule gauche sensible'),
    )
    expect((await base.get<{ notes: string | null }>("SELECT notes FROM exercices_seance WHERE id = 'e1'")).notes).toBeNull()
    choisir('Gainage planche')
    expect((within(carte('Gainage planche')).getByLabelText('Note sur Gainage planche') as HTMLTextAreaElement).value).toBe('')
    rendu.unmount()
    monter('i-note')
    expect((await champ()).value).toBe('Épaule gauche sensible')
  })

  it('bandeau de progression live pour un exercice en progression, mis à jour à chaque série validée', async () => {
    await inserer(base, 'seances', { ...commun, id: 's-prog', nom: 'Progression', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
    await inserer(base, 'exercices_seance', {
      ...commun, id: 'e-prog', seance_id: 's-prog', exercise_id: 'x1', bloc_id: null, position: 0, nombre_series_prevues: 3,
      reps_cibles: '8', charge_cible: '60 kg', reps_type: 'REPS', temps_repos_sec: 90, instance_seance_id: null,
      progression_activee: 1, systeme_progression: 'DOUBLE', reps_min: 8, reps_max: 12, type_exercice: 'COMPOSE_HAUT',
    })
    await inserer(base, 'instances_seance', {
      ...commun, id: 'i-bandeau', seance_id: 's-prog', date: '2026-10-24', notes: '', is_completed: 0, completed_at: null, duration_seconds: 0, created_at: 'c',
    })
    monter('i-bandeau')
    const carteProg = await screen.findByRole('article', { name: 'Développé couché' })
    const bandeau = within(carteProg).getByRole('region', { name: 'Progression de Développé couché' })
    expect(within(bandeau).getByText('Fais 8 reps sur les 3 séries → 9 reps la prochaine fois')).toBeTruthy()
    expect(bandeau.textContent).toContain('0/3')
    fireEvent.click(within(carteProg).getByRole('button', { name: 'Valider la série 1' }))
    await waitFor(() => expect(within(carteProg).getByRole('region', { name: 'Progression de Développé couché' }).textContent).toContain('1/3'))
  })

  it('pas de bandeau pour un exercice sans progression', async () => {
    await instance('i-sans-bandeau')
    monter('i-sans-bandeau')
    const dc = await screen.findByRole('article', { name: 'Développé couché' })
    expect(within(dc).queryByRole('region', { name: /Progression de/ })).toBeNull()
  })
})

describe('ExecuteScreen : titre de l’onglet', () => {
  it('nom de la séance, puis chrono et repos une fois démarrée ; titre d’origine rétabli à la sortie', async () => {
    document.title = 'PandaMove'
    await instance('i-titre')
    const rendu = monter('i-titre')
    await screen.findByRole('heading', { level: 1, name: 'Haut du corps' })
    await waitFor(() => expect(document.title).toBe('Haut du corps · PandaMove'))
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer' }))
    await waitFor(() => expect(document.title).toMatch(/^00:0\d · Haut du corps · PandaMove$/))
    fireEvent.click(within(carte('Développé couché')).getByRole('button', { name: 'Valider la série 1' }))
    await waitFor(() => expect(document.title).toMatch(/^Repos 01:\d\d · 00:0\d · Haut du corps · PandaMove$/))
    rendu.unmount()
    expect(document.title).toBe('PandaMove')
  })
})

describe('ExecuteScreen : menu de la séance', () => {
  const ouvrirMenu = async () => fireEvent.click(await screen.findByRole('button', { name: 'Actions de la séance' }))

  it('« Modifier les exercices » ouvre l’édition de CETTE séance', async () => {
    await instance('i-menu-edit')
    monter('i-menu-edit')
    await ouvrirMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Modifier les exercices' }))
    expect(await screen.findByText('Écran édition des exercices')).toBeTruthy()
  })

  it('« Supprimer la séance » demande confirmation, supprime logiquement la séance jouée (pas le modèle) puis revient aux programmées', async () => {
    await instance('i-menu-suppr')
    monter('i-menu-suppr')
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer' }))
    fireEvent.click(within(carte('Développé couché')).getByRole('button', { name: 'Valider la série 1' }))
    await waitFor(async () => expect(await series('i-menu-suppr')).toHaveLength(1))
    await ouvrirMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Supprimer la séance' }))
    const dialogue = screen.getByRole('dialog', { name: 'Supprimer la séance ?' })
    // « Annuler » ne supprime rien
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('dialog', { name: 'Supprimer la séance ?' })).toBeNull()
    expect((await base.get<{ deleted_at: string | null }>("SELECT deleted_at FROM instances_seance WHERE id = 'i-menu-suppr'")).deleted_at).toBeNull()

    await ouvrirMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Supprimer la séance' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Supprimer la séance ?' })).getByRole('button', { name: 'Supprimer' }))
    expect(await screen.findByText('Séances programmées')).toBeTruthy()
    expect((await base.get<{ deleted_at: string | null }>("SELECT deleted_at FROM instances_seance WHERE id = 'i-menu-suppr'")).deleted_at).not.toBeNull()
    expect(await series('i-menu-suppr')).toEqual([])
    // Le modèle et ses lignes restent intacts
    expect((await base.get<{ deleted_at: string | null }>("SELECT deleted_at FROM seances WHERE id = 's1'")).deleted_at).toBeNull()
    expect((await base.get<{ n: number }>("SELECT COUNT(*) AS n FROM exercices_seance WHERE seance_id = 's1' AND instance_seance_id IS NULL AND deleted_at IS NULL")).n).toBe(2)
  })

  it('séance sans exercice (séance directe) : invitation à en ajouter, qui ouvre l’édition', async () => {
    await inserer(base, 'seances', { ...commun, id: 's-vide', nom: 'Séance du 24/10', is_archived: 0, seance_category: 'STRENGTH_ONESHOT', created_at: 'c' })
    await inserer(base, 'instances_seance', {
      ...commun, id: 'i-vide', seance_id: 's-vide', date: '2026-10-24', notes: '', is_completed: 0, completed_at: null, duration_seconds: 0, created_at: 'c',
    })
    monter('i-vide')
    expect(await screen.findByText('Aucun exercice enregistré pour cette séance.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter des exercices' }))
    expect(await screen.findByText('Écran édition des exercices')).toBeTruthy()
  })

  it('séance terminée : ni menu ni outils', async () => {
    await instance('i-menu-terminee', true)
    monter('i-menu-terminee')
    await screen.findByText('Séance terminée')
    expect(screen.queryByRole('button', { name: 'Actions de la séance' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Minuteur/ })).toBeNull()
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
