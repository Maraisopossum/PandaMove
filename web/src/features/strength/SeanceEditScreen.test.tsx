// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, Link, MemoryRouter, Route, RouterProvider, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { saveSettingsTx } from '../../core/db/repos/settings'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'

let base: Db
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import SeanceEditScreen from './SeanceEditScreen'

afterEach(cleanup)

const exercice = (id: string, name: string, muscle: string, equipment: string[]) =>
  inserer(base, 'exercises', {
    id, user_id: 'u1', updated_at: 'u', deleted_at: null, name, category: 'OTHER', muscle_groups: JSON.stringify([muscle]),
    description: '', is_favorite: 0, is_custom: 0, image_url: null, exercise_type: '', equipment: JSON.stringify(equipment),
    muscle_primary: muscle, is_bodyweight: 0,
  })

beforeEach(async () => {
  base = createTestDb()
  await exercice('dc', 'Développé couché', 'PECTORAUX', ['Barre', 'Banc plat'])
  await exercice('tr', 'Tractions', 'DOS', ['Barre de traction'])
  await exercice('curl', 'Curl haltères', 'BICEPS', ['Haltères'])
  await exercice('face', 'Face pull', 'EPAULES', ['Câble'])
  await exercice('elev', 'Élévations latérales', 'EPAULES', ['Haltères'])
  await inserer(base, 'seances', {
    id: 's1', user_id: 'u1', updated_at: 'u', deleted_at: null, nom: 'Pull', groupes_musculaires: '["DOS"]',
    duree_estimee_min: 45, notes: 'n', seance_category: 'STRENGTH', created_at: 'c', is_archived: 0,
  })
})

const ajouterBlocSeed = (id: string, position: number, type = 'ECHAUFFEMENT', nom = 'Mobilité') =>
  inserer(base, 'blocs_seance', {
    id, user_id: 'u1', updated_at: 'u', deleted_at: null, seance_id: 's1', nom, type, position, duree_min: null, description: '',
    temps_repos_inter_sec: 20, temps_repos_fin_round_sec: 120, instance_seance_id: null, bloc_source_id: null,
  })
const ajouterExoSeed = (id: string, exoId: string, blocId: string | null, position: number, extra: Record<string, unknown> = {}) =>
  inserer(base, 'exercices_seance', {
    id, user_id: 'u1', updated_at: 'u', deleted_at: null, seance_id: 's1', exercise_id: exoId, bloc_id: blocId, position,
    nombre_series_prevues: 3, reps_cibles: '8', charge_cible: '20 kg', tempo: '', reps_type: 'REPS', temps_repos_sec: 90,
    consigne_cle: '', equipement: '', avertissement: '', instance_seance_id: null, is_bilateral: 0, progression_activee: 0,
    increment_duree_sec: 5, seuil_deload: 3, is_bodyweight: 0, ...extra,
  })

function monter(chemin: string) {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route path="/strength" element={<p>Liste des séances</p>} />
        <Route path="/strength/new" element={<SeanceEditScreen />} />
        <Route path="/strength/:id/edit" element={<SeanceEditScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

const cliquer = (nom: string | RegExp, role: 'button' | 'checkbox' | 'switch' | 'radio' = 'button') => fireEvent.click(screen.getByRole(role, { name: nom }))
const pret = () => screen.findByRole('form', { name: 'Séance' })
const saisir = (libelle: string, valeur: string) => fireEvent.change(screen.getByLabelText(libelle), { target: { value: valeur } })

async function choisirExercices(...noms: string[]) {
  const dialogue = await screen.findByRole('dialog', { name: 'Ajouter des exercices' })
  for (const nom of noms) fireEvent.click(within(dialogue).getByRole('checkbox', { name: new RegExp(nom) }))
  fireEvent.click(within(dialogue).getByRole('button', { name: /^Ajouter \(/ }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ajouter des exercices' })).toBeNull())
}

describe('SeanceEditScreen : parcours rapide', () => {
  it('nom -> ajouter des exercices -> enregistrer : retour à la liste, exercices libres dans l’ordre choisi', async () => {
    monter('/strength/new')
    await pret()
    saisir('Nom de la séance', 'Pectoraux du jeudi')
    cliquer(/Rechercher ou ajouter un exercice/)
    // Cochés dans l'ordre Tractions, Curl, Développé : pas l'ordre alphabétique
    await choisirExercices('Tractions', 'Curl haltères', 'Développé couché')
    expect(screen.getAllByRole('button', { name: /^(Tractions|Curl haltères|Développé couché)/ }).map((b) => b.textContent)).toEqual([
      expect.stringContaining('Tractions'), expect.stringContaining('Curl haltères'), expect.stringContaining('Développé couché'),
    ])
    cliquer('Enregistrer')
    expect(await screen.findByText('Liste des séances')).toBeTruthy()

    const lignes = await base.getAll<{ nom: string; bloc_id: string | null; position: number }>(
      `SELECT x.name AS nom, e.bloc_id, e.position FROM exercices_seance e JOIN exercises x ON x.id = e.exercise_id
       WHERE e.seance_id = (SELECT id FROM seances WHERE nom = 'Pectoraux du jeudi') ORDER BY e.position`,
    )
    expect(lignes).toEqual([
      { nom: 'Tractions', bloc_id: null, position: 0 },
      { nom: 'Curl haltères', bloc_id: null, position: 1 },
      { nom: 'Développé couché', bloc_id: null, position: 2 },
    ])
    expect((await base.get<{ n: number }>('SELECT COUNT(*) AS n FROM blocs_seance')).n).toBe(0)
    const s = await base.get<{ groupes_musculaires: string; duree_estimee_min: number }>("SELECT * FROM seances WHERE nom = 'Pectoraux du jeudi'")
    expect(s).toMatchObject({ groupes_musculaires: '["DOS","BICEPS","PECTORAUX"]', duree_estimee_min: 60 })
  })

  it('affiche les erreurs de validation en français sans quitter la page', async () => {
    monter('/strength/new')
    fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer' }))
    const alerte = await screen.findByRole('alert')
    expect(alerte.textContent).toBe('Le nom de la séance est obligatoire.')
    expect(screen.getByRole('heading', { name: 'Nouvelle séance' })).toBeTruthy()
  })

  it("ne contient aucun bouton d'affectation (création comme modification)", async () => {
    const creation = monter('/strength/new')
    expect(await screen.findByRole('heading', { name: 'Nouvelle séance' })).toBeTruthy()
    expect(creation.container.querySelector('[aria-label="Affecter à une date"]')).toBeNull()
    expect(creation.container.textContent).not.toContain('📅')
    creation.unmount()

    const edition = monter('/strength/s1/edit')
    expect(await screen.findByRole('heading', { name: 'Modifier la séance' })).toBeTruthy()
    expect(await screen.findByDisplayValue('Pull')).toBeTruthy()
    expect(edition.container.textContent).not.toContain('📅')
  })
})

describe('SeanceEditScreen : sélecteur d’exercices', () => {
  it('les puces de groupe portent la couleur de l’Android en repère, le nom reste écrit', async () => {
    monter('/strength/new')
    fireEvent.click(await screen.findByRole('button', { name: /Rechercher ou ajouter un exercice/ }))
    const dialogue = await screen.findByRole('dialog', { name: 'Ajouter des exercices' })
    const dos = within(dialogue).getByRole('button', { name: 'Dos' })
    expect(dos.style.getPropertyValue('--groupe')).toBe('#4db6ac')
    expect(dos.className).toContain('puce--groupe')
    expect(within(dialogue).getByRole('button', { name: 'Quadriceps' }).style.getPropertyValue('--groupe')).toBe('#ffd54f')
    // les filtres qui ne sont pas des groupes n'en portent pas
    expect(within(dialogue).getByRole('button', { name: 'Tous' }).className).not.toContain('puce--groupe')
  })

  it('recherche sans accents, filtre par groupe, « Mon matériel », rang de sélection', async () => {
    await base.writeTransaction((tx) =>
      saveSettingsTx(tx, 'u1', { equipmentJson: JSON.stringify({ selectedCategories: ['HALTERES'], halteres: { poidsFixes: [10], chargeable: null } }) }),
    )
    monter('/strength/new')
    fireEvent.click(await screen.findByRole('button', { name: /Rechercher ou ajouter un exercice/ }))
    const dialogue = await screen.findByRole('dialog', { name: 'Ajouter des exercices' })
    const noms = () => within(dialogue).getAllByRole('checkbox').map((c) => c.closest('label')!.textContent!.replace(/\d+$/, ''))
    expect(noms()).toHaveLength(5)

    fireEvent.change(within(dialogue).getByLabelText('Rechercher un exercice'), { target: { value: 'ELEVATIONS' } })
    expect(noms()).toEqual([expect.stringContaining('Élévations latérales')])
    fireEvent.change(within(dialogue).getByLabelText('Rechercher un exercice'), { target: { value: '' } })

    fireEvent.click(within(dialogue).getByRole('button', { name: 'Épaules' }))
    expect(noms().map((n) => n.slice(0, 4))).toEqual(['Élév', 'Face'])
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Mon matériel' }))
    expect(noms().map((n) => n.slice(0, 4))).toEqual(['Élév'])

    fireEvent.click(within(dialogue).getByRole('button', { name: 'Tous' }))
    fireEvent.click(within(dialogue).getByRole('checkbox', { name: /Élévations/ }))
    fireEvent.click(within(dialogue).getByRole('checkbox', { name: /Curl/ }))
    expect(within(dialogue).getByLabelText('numéro 1').closest('label')!.textContent).toContain('Élévations')
    expect(within(dialogue).getByLabelText('numéro 2').closest('label')!.textContent).toContain('Curl')
    expect(within(dialogue).getByRole('button', { name: 'Ajouter (2)' })).toBeTruthy()
  })

  it('Échap ferme le sélecteur sans rien ajouter', async () => {
    monter('/strength/new')
    fireEvent.click(await screen.findByRole('button', { name: /Rechercher ou ajouter un exercice/ }))
    await screen.findByRole('dialog', { name: 'Ajouter des exercices' })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: /Tractions/ })).toBeNull()
  })
})

describe('SeanceEditScreen : blocs', () => {
  it('le menu propose les 5 types ; chaque type montre ses réglages propres', async () => {
    monter('/strength/new')
    for (const type of ['Échauffement', 'Activation', 'Superset', 'Circuit', 'Récupération']) {
      fireEvent.click(await screen.findByRole('button', { name: 'Ajouter un bloc' }))
      cliquer(new RegExp(`^${type}`))
    }
    const bloc = (nom: string) => screen.getByRole('region', { name: `Bloc ${nom}` })
    expect(within(bloc('Échauffement')).queryByLabelText('Repos entre exercices (s)')).toBeNull()
    expect(within(bloc('Activation')).queryByLabelText('Repos en fin de tour (s)')).toBeNull()
    expect(within(bloc('Superset')).getByLabelText('Repos entre exercices (s)')).toBeTruthy()
    expect(within(bloc('Superset')).queryByLabelText('Nombre de tours du circuit')).toBeNull()
    expect(within(bloc('Circuit')).getByLabelText('Repos en fin de tour (s)')).toBeTruthy()
    expect(within(bloc('Circuit')).getByLabelText('Nombre de tours du circuit')).toBeTruthy()
    expect(within(bloc('Récupération')).queryByLabelText('Repos entre exercices (s)')).toBeNull()
  })

  it('compteurs de repos : pas de 5 s entre exercices (défaut 20), 15 s en fin de tour (défaut 120), jamais sous 0', async () => {
    monter('/strength/new')
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter un bloc' }))
    cliquer(/^Superset/)
    const bloc = screen.getByRole('region', { name: 'Bloc Superset' })
    const inter = within(bloc).getByLabelText('Repos entre exercices (s)') as HTMLInputElement
    const fin = within(bloc).getByLabelText('Repos en fin de tour (s)') as HTMLInputElement
    expect([inter.value, fin.value]).toEqual(['20', '120'])
    fireEvent.click(within(bloc).getByRole('button', { name: 'Augmenter : Repos entre exercices (s)' }))
    fireEvent.click(within(bloc).getByRole('button', { name: 'Diminuer : Repos en fin de tour (s)' }))
    expect([inter.value, fin.value]).toEqual(['25', '105'])
    for (let i = 0; i < 6; i++) fireEvent.click(within(bloc).getByRole('button', { name: 'Diminuer : Repos entre exercices (s)' }))
    expect(inter.value).toBe('0')
    expect((within(bloc).getByRole('button', { name: 'Diminuer : Repos entre exercices (s)' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('changer le type d’un bloc existant, renommer, ajouter un exercice dans CE bloc, enregistrer', async () => {
    await ajouterBlocSeed('b1', 0)
    await ajouterExoSeed('x1', 'tr', 'b1', 0)
    monter('/strength/s1/edit')
    const bloc = await screen.findByRole('region', { name: 'Bloc Mobilité' })
    fireEvent.change(within(bloc).getByLabelText('Type de bloc'), { target: { value: 'CIRCUIT' } })
    fireEvent.change(within(bloc).getByLabelText('Nom du bloc'), { target: { value: 'Finisher' } })
    expect(screen.getByRole('region', { name: 'Bloc Finisher' })).toBeTruthy()
    fireEvent.change(within(bloc).getByLabelText('Nombre de tours du circuit'), { target: { value: '4' } })

    cliquer('Ajouter un exercice au bloc Finisher')
    await choisirExercices('Curl haltères')
    // Exercices d'un circuit : durée obligatoire (min + sec)
    for (const carte of within(bloc).getAllByRole('button', { name: /^(Tractions|Curl haltères)/ })) fireEvent.click(carte)
    const minutes = within(bloc).getAllByLabelText('Minutes')
    const secondes = within(bloc).getAllByLabelText('Secondes')
    expect(minutes).toHaveLength(2)
    fireEvent.change(minutes[0], { target: { value: '1' } })
    fireEvent.change(secondes[0], { target: { value: '30' } })
    fireEvent.change(secondes[1], { target: { value: '45' } })
    cliquer('Enregistrer')
    expect(await screen.findByText('Liste des séances')).toBeTruthy()

    expect(await base.get('SELECT nom, type FROM blocs_seance WHERE id = ?', ['b1'])).toEqual({ nom: 'Finisher', type: 'CIRCUIT' })
    const lignes = await base.getAll<Record<string, unknown>>(
      'SELECT exercise_id, reps_type, reps_cibles, nombre_series_prevues FROM exercices_seance WHERE bloc_id = ? AND deleted_at IS NULL ORDER BY position', ['b1'],
    )
    expect(lignes).toEqual([
      { exercise_id: 'tr', reps_type: 'DURATION', reps_cibles: '90', nombre_series_prevues: 4 },
      { exercise_id: 'curl', reps_type: 'DURATION', reps_cibles: '45', nombre_series_prevues: 4 },
    ])
  })

  it('monter / descendre un bloc et un exercice libre : un seul ordre', async () => {
    await ajouterExoSeed('libre', 'dc', null, 0)
    await ajouterBlocSeed('b1', 1)
    await ajouterExoSeed('x1', 'tr', 'b1', 0)
    monter('/strength/s1/edit')
    await screen.findByRole('region', { name: 'Bloc Mobilité' })
    fireEvent.click(screen.getByRole('button', { name: /^Développé couché/ }))
    expect((screen.getByRole('button', { name: 'Monter Développé couché' }) as HTMLButtonElement).disabled).toBe(true)
    cliquer('Descendre Développé couché')
    expect((screen.getByRole('button', { name: 'Descendre Développé couché' }) as HTMLButtonElement).disabled).toBe(true)
    cliquer('Enregistrer')
    await screen.findByText('Liste des séances')
    const ordre = await base.getAll<{ id: string; position: number }>(
      `SELECT id, position FROM (SELECT id, position FROM exercices_seance WHERE bloc_id IS NULL AND deleted_at IS NULL
       UNION ALL SELECT id, position FROM blocs_seance WHERE deleted_at IS NULL) ORDER BY position`,
    )
    expect(ordre).toEqual([{ id: 'b1', position: 0 }, { id: 'libre', position: 1 }])
  })

  it('supprimer un bloc garni demande confirmation ; un bloc vide part tout de suite', async () => {
    await ajouterBlocSeed('b1', 0)
    await ajouterExoSeed('x1', 'tr', 'b1', 0)
    await ajouterBlocSeed('b2', 1, 'SUPERSET', 'Vide')
    monter('/strength/s1/edit')
    await screen.findByRole('region', { name: 'Bloc Mobilité' })
    cliquer('Supprimer le bloc Vide')
    expect(screen.queryByRole('region', { name: 'Bloc Vide' })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()

    cliquer('Supprimer le bloc Mobilité')
    const dialogue = screen.getByRole('dialog', { name: 'Supprimer ce bloc ?' })
    expect(dialogue.textContent).toContain('1 exercice')
    // Focus sur l'option non destructive
    expect(document.activeElement).toBe(within(dialogue).getByRole('button', { name: 'Garder le bloc' }))
    cliquer('Garder le bloc')
    expect(screen.getByRole('region', { name: 'Bloc Mobilité' })).toBeTruthy()
    cliquer('Supprimer le bloc Mobilité')
    cliquer('Supprimer le bloc', 'button')
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Bloc Mobilité' })).toBeNull())
  })
})

describe('SeanceEditScreen : carte d’exercice', () => {
  it('repliée : résumé « 3 × 8–12 · 20 kg » et badges ; dépliée : dupliquer, descendre, supprimer', async () => {
    await ajouterBlocSeed('b1', 0, 'SUPERSET', 'Haut du corps')
    await ajouterExoSeed('x1', 'tr', 'b1', 0, { progression_activee: 1, systeme_progression: 'DOUBLE', reps_min: 8, reps_max: 12, is_bilateral: 1 })
    await ajouterExoSeed('x2', 'dc', 'b1', 1)
    monter('/strength/s1/edit')
    const entete = await screen.findByRole('button', { name: /^Tractions/ })
    expect(entete.textContent).toContain('3 × 8–12 · 20 kg')
    expect(entete.textContent).toContain('Progression')
    expect(entete.textContent).toContain('G + D')
    expect(entete.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByLabelText('Séries')).toBeNull()

    fireEvent.click(entete)
    expect(entete.getAttribute('aria-expanded')).toBe('true')
    cliquer('Dupliquer Tractions')
    expect(screen.getAllByRole('button', { name: /^Tractions/ })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /^Développé couché/ }))
    cliquer('Supprimer Développé couché')
    expect(screen.queryByRole('button', { name: /^Développé couché/ })).toBeNull()
  })

  it('superset : repos géré par le bloc (pas de repos par exercice) ; groupe de superset dans « Plus d’options »', async () => {
    await ajouterBlocSeed('b1', 0, 'SUPERSET', 'SS')
    await ajouterExoSeed('x1', 'tr', 'b1', 0)
    monter('/strength/s1/edit')
    fireEvent.click(await screen.findByRole('button', { name: /^Tractions/ }))
    expect(screen.getByLabelText('Séries')).toBeTruthy()
    expect(screen.queryByLabelText('Repos entre séries (s)')).toBeNull()
    expect(screen.getByLabelText('Groupe de superset (A, B…)')).toBeTruthy()
  })

  it('exercice libre : repos par exercice au pas de 15 s ; durée en minutes + secondes convertie en secondes', async () => {
    await ajouterExoSeed('l', 'tr', null, 0)
    monter('/strength/s1/edit')
    fireEvent.click(await screen.findByRole('button', { name: /^Tractions/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Augmenter : Repos entre séries (s)' }))
    expect((screen.getByLabelText('Repos entre séries (s)') as HTMLInputElement).value).toBe('105')

    fireEvent.click(screen.getByRole('radio', { name: 'Durée' }))
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Secondes'), { target: { value: '5' } })
    cliquer('Enregistrer')
    await screen.findByText('Liste des séances')
    expect(await base.get('SELECT reps_type, reps_cibles, temps_repos_sec FROM exercices_seance WHERE id = ?', ['l'])).toEqual({
      reps_type: 'DURATION', reps_cibles: '125', temps_repos_sec: 105,
    })
  })

  it('charge non composable avec Mon matériel : indice et « Arrondir » en un clic', async () => {
    await base.writeTransaction((tx) =>
      saveSettingsTx(tx, 'u1', { equipmentJson: JSON.stringify({ halteres: { poidsFixes: [8, 10, 12, 14], chargeable: null } }) }),
    )
    await ajouterExoSeed('l', 'curl', null, 0, { charge_cible: '11 kg' })
    monter('/strength/s1/edit')
    fireEvent.click(await screen.findByRole('button', { name: /^Curl haltères/ }))
    expect(screen.getByRole('note').textContent).toContain('la plus proche est 10 kg')
    cliquer('Arrondir à 10 kg')
    expect((screen.getByLabelText('Charge cible (ex. 20 kg ou PDC)') as HTMLInputElement).value).toBe('10 kg')
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('la virgule décimale est enregistrée avec un point, comme la lit le moteur de progression', async () => {
    await ajouterExoSeed('l', 'curl', null, 0)
    monter('/strength/s1/edit')
    fireEvent.click(await screen.findByRole('button', { name: /^Curl haltères/ }))
    saisir('Charge cible (ex. 20 kg ou PDC)', '12,5 kg')
    cliquer('Enregistrer')
    await screen.findByText('Liste des séances')
    expect((await base.get<{ charge_cible: string }>('SELECT charge_cible FROM exercices_seance WHERE id = ?', ['l'])).charge_cible).toBe('12.5 kg')
  })
})

describe('SeanceEditScreen : surcharge progressive', () => {
  it('activation : valeurs par défaut Android, aide, aperçu ; enregistrée dans les colonnes lues par le moteur', async () => {
    await base.writeTransaction((tx) =>
      saveSettingsTx(tx, 'u1', { equipmentJson: JSON.stringify({ halteres: { poidsFixes: [8, 10, 12, 14], chargeable: null } }) }),
    )
    await ajouterExoSeed('l', 'curl', null, 0, { reps_cibles: '', charge_cible: '10 kg' })
    monter('/strength/s1/edit')
    fireEvent.click(await screen.findByRole('button', { name: /^Curl haltères/ }))
    expect(screen.getByText(/Désactivée/)).toBeTruthy()
    expect(screen.queryByRole('radiogroup', { name: 'Système de progression' })).toBeNull()

    cliquer('Surcharge progressive', 'switch')
    const systemes = screen.getByRole('radiogroup', { name: 'Système de progression' })
    expect(within(systemes).getByRole('radio', { name: 'Double progression' }).getAttribute('aria-checked')).toBe('true')
    expect((screen.getByLabelText('Répétitions min') as HTMLInputElement).value).toBe('8')
    expect((screen.getByLabelText('Répétitions max') as HTMLInputElement).value).toBe('12')
    expect((screen.getByLabelText('Incrément (kg)') as HTMLInputElement).value).toBe('2,5')
    expect((screen.getByLabelText('Deload après (échecs)') as HTMLInputElement).value).toBe('3')
    // Répétitions de départ préremplies (indispensables à l'évaluation)
    expect((screen.getByLabelText('Répétitions cibles (ex. 8 ou 8-12)') as HTMLInputElement).value).toBe('8')
    expect(screen.getByText(/Double progression : vous visez d’abord/)).toBeTruthy()
    expect(screen.getByText(/charge 10 kg → 12 kg et retour à 8 répétitions/)).toBeTruthy()

    cliquer('Linéaire', 'radio')
    expect(screen.queryByLabelText('Répétitions min')).toBeNull()
    expect(screen.getByText(/10 kg → 12 kg \(\+2 kg\)/)).toBeTruthy()
    cliquer('Isolation', 'radio')

    cliquer('Surcharge progressive', 'switch')
    cliquer('Surcharge progressive', 'switch')
    cliquer('Temporelle', 'radio')
    expect(screen.queryByRole('radiogroup', { name: 'Type d’exercice' })).toBeNull()
    expect(screen.getByLabelText('Incrément de durée (s)')).toBeTruthy()
    expect(screen.getByRole('note').textContent).toMatch(/exercice en durée/)
    cliquer('Linéaire', 'radio')
    cliquer('Isolation', 'radio')
    cliquer('Enregistrer')
    await screen.findByText('Liste des séances')
    expect(await base.get('SELECT progression_activee, systeme_progression, reps_min, reps_max, increment_kg, seuil_deload, type_exercice FROM exercices_seance WHERE id = ?', ['l'])).toEqual({
      progression_activee: 1, systeme_progression: 'LINEAIRE', reps_min: 8, reps_max: 12, increment_kg: 2.5, seuil_deload: 3, type_exercice: 'ISOLATION',
    })
  })

  it('poids de corps : plus de choix de charge ni de type ; échauffement et activation : non applicable', async () => {
    await ajouterBlocSeed('b1', 0, 'ECHAUFFEMENT', 'Chauffe')
    await ajouterExoSeed('x1', 'tr', 'b1', 0)
    await ajouterExoSeed('l', 'dc', null, 1)
    monter('/strength/s1/edit')
    fireEvent.click(await screen.findByRole('button', { name: /^Tractions/ }))
    expect(screen.getByText(/ne s’applique pas à un exercice d’échauffement/)).toBeTruthy()
    expect(screen.queryByRole('switch')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /^Développé couché/ }))
    cliquer('Surcharge progressive', 'switch')
    cliquer(/Poids de corps/, 'checkbox')
    expect(screen.queryByLabelText('Incrément (kg)')).toBeNull()
    expect(screen.queryByRole('radiogroup', { name: 'Type d’exercice' })).toBeNull()
    expect(screen.getByText(/retour à 8 répétitions avec une série de plus/)).toBeTruthy()
  })
})

describe('SeanceEditScreen : échauffement modèle', () => {
  it('propose les modèles d’échauffement et les recopie en tête de séance', async () => {
    await inserer(base, 'seances', {
      id: 'w1', user_id: 'u1', updated_at: 'u', deleted_at: null, nom: 'Mobilité épaules', groupes_musculaires: '[]', duree_estimee_min: 5,
      notes: '', seance_category: 'WARMUP_MOBILITY', created_at: 'c', is_archived: 0,
    })
    await inserer(base, 'exercices_seance', {
      id: 'wx', user_id: 'u1', updated_at: 'u', deleted_at: null, seance_id: 'w1', exercise_id: 'face', bloc_id: null, position: 0,
      nombre_series_prevues: 2, reps_cibles: '15', instance_seance_id: null,
    })
    await ajouterExoSeed('l', 'dc', null, 0)
    monter('/strength/s1/edit')
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter un échauffement' }))
    const dialogue = await screen.findByRole('dialog', { name: 'Choisir un échauffement' })
    fireEvent.click(await within(dialogue).findByRole('button', { name: /Mobilité épaules/ }))
    expect(await screen.findByRole('region', { name: 'Bloc Mobilité épaules' })).toBeTruthy()
    cliquer('Enregistrer')
    await screen.findByText('Liste des séances')
    const ordre = await base.getAll<{ nom: string; position: number }>(
      "SELECT nom, position FROM blocs_seance WHERE seance_id = 's1' AND deleted_at IS NULL",
    )
    expect(ordre).toEqual([{ nom: 'Mobilité épaules', position: 0 }])
    expect((await base.get<{ position: number }>("SELECT position FROM exercices_seance WHERE id = 'l'")).position).toBe(1)
  })
})

describe('SeanceEditScreen : sortie avec modifications non enregistrées', () => {
  function monterAvecRouteurDonnees() {
    const routeur = createMemoryRouter(
      [
        { path: '/strength', element: <p>Liste des séances</p> },
        {
          path: '/strength/new',
          element: (
            <>
              <SeanceEditScreen />
              <Link to="/ailleurs">Aller ailleurs</Link>
            </>
          ),
        },
        { path: '/ailleurs', element: <p>Ailleurs</p> },
      ],
      { initialEntries: ['/strength/new'] },
    )
    render(<RouterProvider router={routeur} />)
    return routeur
  }

  it('sans modification : on part tout de suite', async () => {
    monterAvecRouteurDonnees()
    fireEvent.click(await screen.findByRole('link', { name: 'Aller ailleurs' }))
    expect(await screen.findByText('Ailleurs')).toBeTruthy()
  })

  it('avec modifications : confirmation ; « Rester » ne perd rien, « Quitter » part', async () => {
    monterAvecRouteurDonnees()
    await pret()
    saisir('Nom de la séance', 'Brouillon')
    fireEvent.click(screen.getByRole('link', { name: 'Aller ailleurs' }))
    const dialogue = await screen.findByRole('dialog', { name: 'Quitter sans enregistrer ?' })
    expect(document.activeElement).toBe(within(dialogue).getByRole('button', { name: 'Rester sur la séance' }))
    cliquer('Rester sur la séance')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((screen.getByLabelText('Nom de la séance') as HTMLInputElement).value).toBe('Brouillon')

    cliquer('Annuler')
    cliquer('Quitter sans enregistrer')
    expect(await screen.findByText('Liste des séances')).toBeTruthy()
    expect(await base.get<{ n: number }>("SELECT COUNT(*) AS n FROM seances WHERE nom = 'Brouillon'")).toEqual({ n: 0 })
  })

  it('après un enregistrement réussi, aucune confirmation', async () => {
    monterAvecRouteurDonnees()
    await pret()
    saisir('Nom de la séance', 'Enregistrée')
    cliquer('Enregistrer')
    expect(await screen.findByText('Liste des séances')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await base.get<{ n: number }>("SELECT COUNT(*) AS n FROM seances WHERE nom = 'Enregistrée'")).toEqual({ n: 1 })
  })
})

describe('SeanceEditScreen : modifier les exercices d’une séance en cours', () => {
  function monterInstance() {
    return render(
      <MemoryRouter initialEntries={['/strength/instance/i1/edit']}>
        <Routes>
          <Route path="/strength/instance/:id" element={<p>Séance en cours</p>} />
          <Route path="/strength/instance/:id/edit" element={<SeanceEditScreen instance />} />
        </Routes>
      </MemoryRouter>,
    )
  }

  beforeEach(async () => {
    await inserer(base, 'instances_seance', {
      id: 'i1', user_id: 'u1', updated_at: 'u', deleted_at: null, seance_id: 's1', date: '2026-10-24', notes: '', is_completed: 0,
      completed_at: null, duration_seconds: 0, created_at: 'c',
    })
    await ajouterExoSeed('modele-1', 'tr', null, 0)
    await ajouterExoSeed('inst-1', 'tr', null, 0, { instance_seance_id: 'i1' })
  })

  it('ne propose ni nom, ni notes, ni durée ; ajoute un exercice à la séance en cours puis revient à son exécution', async () => {
    monterInstance()
    await pret()
    expect(screen.getByRole('heading', { level: 1, name: 'Modifier les exercices' })).toBeTruthy()
    expect(screen.getByText(/seule cette séance est modifiée, la séance type reste inchangée/)).toBeTruthy()
    expect(screen.queryByLabelText('Nom de la séance')).toBeNull()
    expect(screen.queryByLabelText('Durée estimée (min)')).toBeNull()
    cliquer(/Rechercher ou ajouter un exercice/)
    await choisirExercices('Curl haltères')
    cliquer('Enregistrer')
    expect(await screen.findByText('Séance en cours')).toBeTruthy()
    const lignes = await base.getAll<{ exercise_id: string; instance_seance_id: string | null }>(
      'SELECT exercise_id, instance_seance_id FROM exercices_seance WHERE deleted_at IS NULL ORDER BY exercise_id, instance_seance_id',
    )
    expect(lignes).toEqual([
      { exercise_id: 'curl', instance_seance_id: 'i1' },
      { exercise_id: 'tr', instance_seance_id: null },
      { exercise_id: 'tr', instance_seance_id: 'i1' },
    ])
    expect((await base.get<{ nom: string; notes: string }>("SELECT nom, notes FROM seances WHERE id = 's1'"))).toEqual({ nom: 'Pull', notes: 'n' })
  })

  it('« Annuler » revient à la séance en cours sans rien écrire', async () => {
    monterInstance()
    await pret()
    cliquer('Annuler')
    expect(await screen.findByText('Séance en cours')).toBeTruthy()
  })

  it('retirer un exercice déjà travaillé demande confirmation avant de supprimer ses séries', async () => {
    await inserer(base, 'series_realisees', {
      id: 'sr1', user_id: 'u1', updated_at: 'u', deleted_at: null, instance_seance_id: 'i1', exercice_seance_id: 'inst-1', numero_serie: 1,
      reps_realisees: 8, charge_kg: 20, charge_label: null, rpe: null, notes: '', is_completed: 1, validated_at: '2026-10-24T10:00:00.000Z',
    })
    monterInstance()
    await pret()
    cliquer(/Rechercher ou ajouter un exercice/)
    await choisirExercices('Curl haltères')
    // Dépliée, la carte de Tractions propose « Supprimer »
    fireEvent.click(screen.getAllByRole('button', { name: /^Tractions/ })[0])
    cliquer('Supprimer Tractions')
    cliquer('Enregistrer')
    const dialogue = await screen.findByRole('dialog', { name: 'Retirer ces exercices ?' })
    expect(dialogue.textContent).toContain('1 série déjà validée')
    expect((await base.get<{ deleted_at: string | null }>("SELECT deleted_at FROM series_realisees WHERE id = 'sr1'")).deleted_at).toBeNull()
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Retirer et supprimer les séries' }))
    expect(await screen.findByText('Séance en cours')).toBeTruthy()
    expect((await base.get<{ deleted_at: string | null }>("SELECT deleted_at FROM series_realisees WHERE id = 'sr1'")).deleted_at).not.toBeNull()
  })

  it('séance terminée : message, pas de formulaire utile', async () => {
    await base.execute("UPDATE instances_seance SET is_completed = 1 WHERE id = 'i1'")
    monterInstance()
    await pret()
    expect((await screen.findByRole('alert')).textContent).toBe("Cette séance est terminée : elle n'est plus modifiable.")
    cliquer('Enregistrer')
    expect(screen.queryByText('Séance en cours')).toBeNull()
  })
})
