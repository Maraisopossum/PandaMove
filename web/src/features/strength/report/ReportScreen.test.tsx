// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deterministicId } from '../../../core/db/ids'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'

const base = createTestDb()
vi.mock('../../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import ReportScreen from './ReportScreen'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const commun = { user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null }
await inserer(base, 'seances', { ...commun, id: 's1', nom: 'Haut du corps', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
await inserer(base, 'exercises', { ...commun, id: 'x1', name: 'Développé couché', equipment: '["Barre"]' })
await inserer(base, 'exercises', { ...commun, id: 'x2', name: 'Gainage planche', equipment: '["Poids de corps"]' })

let compteur = 0

// Une séance terminée par test (seance distincte pour isoler les objectifs).
async function seanceTerminee(id: string, { objectif = true, terminee = true, notes = '' } = {}) {
  const seanceId = `s-${id}`
  await inserer(base, 'seances', {
    ...commun, id: seanceId, nom: 'Haut du corps', notes: 'Pecs et dos', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c',
  })
  await inserer(base, 'instances_seance', {
    ...commun, id, seance_id: seanceId, date: '2026-10-24', notes, is_completed: terminee ? 1 : 0,
    completed_at: terminee ? '2026-10-24T11:00:00.000Z' : null, duration_seconds: terminee ? 2730 : 0, created_at: 'c',
    started_at: '2026-10-24T10:14:30.000Z', progression_json: terminee ? '{"evaluee":true,"decisions":{}}' : null,
  })
  const ex = (exId: string, champs: Record<string, unknown>) =>
    inserer(base, 'exercices_seance', {
      ...commun, id: `${id}-${exId}`, seance_id: seanceId, instance_seance_id: id, bloc_id: null, nombre_series_prevues: 3,
      reps_cibles: '8', charge_cible: '50 kg', reps_type: 'REPS', temps_repos_sec: 90, systeme_progression: 'LINEAIRE',
      increment_kg: 2.5, increment_duree_sec: 5, seuil_deload: 3, is_bodyweight: 0, is_bilateral: 0, ...champs,
    })
  await ex('e1', { exercise_id: 'x1', position: 0, progression_activee: 1 })
  await ex('e2', { exercise_id: 'x2', position: 1, progression_activee: 0, reps_type: 'DURATION', reps_cibles: '45', nombre_series_prevues: 2 })
  const numeros: Record<string, number> = {}
  const serie = (exId: string, reps: number, charge: number | null, rpe: number | null = null) =>
    inserer(base, 'series_realisees', {
      ...commun, id: `serie-${++compteur}`, instance_seance_id: id, exercice_seance_id: `${id}-${exId}`, numero_serie: (numeros[exId] = (numeros[exId] ?? 0) + 1),
      reps_realisees: reps, charge_kg: charge, rpe, notes: '', is_completed: 1,
    })
  // 3 × 7 reps à 50 kg (cible 8) : 3e échec consécutif -> deload proposé
  await serie('e1', 7, 50, 8.5)
  await serie('e1', 7, 50)
  await serie('e1', 7, 50)
  await serie('e2', 60, 10)
  if (objectif) {
    await inserer(base, 'objectifs_progression', {
      ...commun, id: `obj-${id}`, seance_id: seanceId, exercise_id: 'x1', charge_cible: 50, reps_cible: 8, duree_cible_sec: null,
      compteur_echec: 2, derniere_maj: '2026-10-01', nombre_series_cible: null,
    })
  }
  return seanceId
}

function monter(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/strength/instance/${id}/report`]}>
      <Routes>
        <Route path="/strength/instance/:id/report" element={<ReportScreen />} />
        <Route path="/strength/instance/:id" element={<p>Écran séance</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const objectif = (seanceId: string) =>
  base.getOptional<{ charge_cible: number; reps_cible: number; compteur_echec: number }>(
    'SELECT charge_cible, reps_cible, compteur_echec FROM objectifs_progression WHERE seance_id = ? AND deleted_at IS NULL',
    [seanceId],
  )

describe('ReportScreen : rapport', () => {
  it('en-tête (séance, date, notes), chiffres clés, sans icône 📅', async () => {
    await seanceTerminee('r-resume', { notes: 'Bonne forme' })
    const { container } = monter('r-resume')
    expect(await screen.findByRole('heading', { level: 1, name: 'Rapport de séance' })).toBeTruthy()
    const resume = screen.getByRole('region', { name: 'Résumé' })
    expect(within(resume).getByRole('heading', { level: 2, name: 'Haut du corps' })).toBeTruthy()
    expect(within(resume).getByText('Samedi 24 octobre 2026')).toBeTruthy()
    expect(within(resume).getByText('Pecs et dos')).toBeTruthy()
    // 3 × 7 × 50 = 1050 kg ; la série DURATION lestée n'y compte pas
    expect(within(resume).getByText('1,1 t')).toBeTruthy()
    // 4 séries validées sur 5 prévues (3 + 2)
    expect(within(resume).getByText('4 / 5')).toBeTruthy()
    expect(within(resume).getByText('45:30')).toBeTruthy()
    expect(container.textContent).not.toContain('📅')
    expect(document.body.textContent).not.toContain('📅')
    // Panda de victoire (variante par défaut : aucun réglage enregistré)
    const panda = await screen.findByRole('img', { name: 'Panda qui célèbre sa victoire' })
    expect(panda.getAttribute('src')).toBe('/panda/victory-male-sm.webp')
    expect(panda.getAttribute('loading')).toBe('lazy')
  })

  it('un détail repliable par exercice : résumé en une ligne, tableau avec en-têtes, valeurs exactes', async () => {
    await seanceTerminee('r-detail')
    monter('r-detail')
    const bilan = await screen.findByRole('region', { name: 'Exercices' })
    const resumes = within(bilan).getAllByText(/séries$/)
    expect(resumes.map((r) => r.textContent)).toEqual(['3 / 3 séries', '1 / 2 séries'])
    expect(within(bilan).getByText('Séance incomplète')).toBeTruthy()
    const details = bilan.querySelectorAll('details')
    expect(details.length).toBe(2)
    // Repliés par défaut
    expect(Array.from(details).every((d) => !d.open)).toBe(true)

    const tableau = within(bilan).getByRole('table', { name: 'Séries de Développé couché' })
    const entetes = within(tableau).getAllByRole('columnheader').map((h) => h.textContent)
    expect(entetes).toEqual(['Série', 'Reps', 'Charge', 'RPE'])
    const lignes = within(tableau).getAllByRole('row').slice(1)
    expect(lignes.map((l) => Array.from(l.querySelectorAll('th,td')).map((c) => c.textContent))).toEqual([
      ['Série 1', '7', '50 kg', '8,5'],
      ['Série 2', '7', '50 kg', '—'],
      ['Série 3', '7', '50 kg', '—'],
    ])
    // Cible du modèle rappelée
    expect(within(bilan).getByText('Cible : 3 × 8 reps à 50 kg')).toBeTruthy()
    // DURATION : des secondes, jamais des répétitions
    expect(within(bilan).getByText('60 s', { selector: 'td' })).toBeTruthy()
  })

  it('note de séance affichée seulement si elle existe', async () => {
    await seanceTerminee('r-note', { notes: 'Bonne forme' })
    monter('r-note')
    expect(await screen.findByRole('heading', { level: 2, name: 'Note de séance' })).toBeTruthy()
    expect(screen.getByText('Bonne forme')).toBeTruthy()
    cleanup()
    await seanceTerminee('r-sansnote')
    monter('r-sansnote')
    await screen.findByRole('heading', { level: 1, name: 'Rapport de séance' })
    expect(screen.queryByRole('heading', { name: 'Note de séance' })).toBeNull()
  })

  it('« Copier le résumé » met le résumé dans le presse-papiers et l’annonce', async () => {
    await seanceTerminee('r-copie')
    const ecrire = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: ecrire }, configurable: true })
    monter('r-copie')
    fireEvent.click(await screen.findByRole('button', { name: 'Copier le résumé' }))
    expect(await screen.findByText('Résumé copié.')).toBeTruthy()
    const texte = ecrire.mock.calls[0][0] as string
    expect(texte).toContain('Haut du corps — Samedi 24 octobre 2026')
    expect(texte).toContain('Série 1 : 7 reps à 50 kg, RPE 8,5')
    expect(screen.getByRole('status').textContent).toBe('Résumé copié.')
  })

  it('« Télécharger le rapport » produit un fichier HTML nommé et daté', async () => {
    await seanceTerminee('r-html')
    const creer = vi.fn().mockReturnValue('blob:rapport')
    const revoquer = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: creer, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revoquer, configurable: true })
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    monter('r-html')
    fireEvent.click(await screen.findByRole('button', { name: 'Télécharger le rapport (HTML)' }))
    await waitFor(() => expect(clic).toHaveBeenCalled())
    const blob = creer.mock.calls[0][0] as Blob
    expect(blob.type).toBe('text/html;charset=utf-8')
    expect(await blob.text()).toContain('<html lang="fr">')
    expect(revoquer).toHaveBeenCalledWith('blob:rapport')
  })

  it('séance introuvable : message et retour', async () => {
    monter('inconnue')
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Séance introuvable.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Retour aux séances' }).getAttribute('href')).toBe('/strength')
  })

  it('séance terminée sans exercice : état vide explicite', async () => {
    await inserer(base, 'instances_seance', {
      ...commun, id: 'r-vide', seance_id: 's1', date: '2026-10-24', notes: '', is_completed: 1, completed_at: '2026-10-24T11:00:00.000Z',
      duration_seconds: 0, created_at: 'c', started_at: '2026-10-24T10:14:30.000Z', progression_json: '{"evaluee":true,"decisions":{}}',
    })
    monter('r-vide')
    expect(await screen.findByText('Aucun exercice enregistré pour cette séance.')).toBeTruthy()
    // Durée nulle : tiret, comme l'Android
    expect(within(screen.getByRole('region', { name: 'Résumé' })).getAllByText('—').length).toBeGreaterThan(0)
  })

  it("séance non terminée : message et lien vers la séance", async () => {
    await seanceTerminee('r-encours', { terminee: false })
    monter('r-encours')
    expect(await screen.findByText("Cette séance n'est pas encore terminée : le rapport sera disponible à la fin.")).toBeTruthy()
    const lien = screen.getByRole('link', { name: 'Reprendre la séance' })
    expect(lien.getAttribute('href')).toBe('/strength/instance/r-encours')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('navigation : retour aux séances et aux séances terminées', async () => {
    await seanceTerminee('r-nav', { objectif: false })
    monter('r-nav')
    await screen.findByRole('heading', { level: 1, name: 'Rapport de séance' })
    expect(screen.getByRole('link', { name: 'Retour aux séances' }).getAttribute('href')).toBe('/strength')
    expect(screen.getByRole('link', { name: 'Séances terminées' }).getAttribute('href')).toBe('/strength/done')
  })
})

describe('ReportScreen : récap de progression', () => {
  it('s’ouvre de lui-même : sous-titre, Oui présélectionné, deload expliqué, rien d’écrit avant « Valider »', async () => {
    const seanceId = await seanceTerminee('r-ouvre')
    monter('r-ouvre')
    const dialogue = await screen.findByRole('dialog', { name: 'Progression' })
    expect(dialogue.getAttribute('aria-modal')).toBe('true')
    expect(within(dialogue).getByText('1 exercice prêt à progresser')).toBeTruthy()
    expect(within(dialogue).getByText(/Deload proposé : réduction de 10 %/)).toBeTruthy()
    expect(within(dialogue).getByText('Proposer 8 reps à 45 kg')).toBeTruthy()
    const groupe = within(dialogue).getByRole('group', { name: 'Développé couché' })
    expect((within(groupe).getByRole('radio', { name: 'Oui' }) as HTMLInputElement).checked).toBe(true)
    expect((within(groupe).getByRole('radio', { name: 'Non, garder' }) as HTMLInputElement).checked).toBe(false)
    expect(await objectif(seanceId)).toEqual({ charge_cible: 50, reps_cible: 8, compteur_echec: 2 })
  })

  it('le focus initial est sur « Plus tard » (action qui n’écrit rien), jamais sur « Valider »', async () => {
    await seanceTerminee('r-focus-init')
    monter('r-focus-init')
    const dialogue = await screen.findByRole('dialog', { name: 'Progression' })
    expect(document.activeElement).toBe(within(dialogue).getByRole('button', { name: 'Plus tard' }))
  })

  it('« Valider » avec Oui écrit le deload, ferme le récap et annonce le résultat', async () => {
    const seanceId = await seanceTerminee('r-oui')
    monter('r-oui')
    const dialogue = await screen.findByRole('dialog', { name: 'Progression' })
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Valider' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await objectif(seanceId)).toEqual({ charge_cible: 45, reps_cible: 8, compteur_echec: 0 })
    expect((await screen.findByRole('status')).textContent).toBe('Progression enregistrée pour 1 exercice.')
    const progression = screen.getByRole('region', { name: 'Progression' })
    expect(within(progression).getByText('Acceptée')).toBeTruthy()
  })

  it('« Non, garder » conserve la cible', async () => {
    const seanceId = await seanceTerminee('r-non')
    monter('r-non')
    const dialogue = await screen.findByRole('dialog', { name: 'Progression' })
    fireEvent.click(within(dialogue).getByRole('radio', { name: 'Non, garder' }))
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Valider' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await objectif(seanceId)).toEqual({ charge_cible: 50, reps_cible: 8, compteur_echec: 0 })
    expect(within(screen.getByRole('region', { name: 'Progression' })).getByText('Refusée')).toBeTruthy()
  })

  it('« Ajuster » : champ prérempli avec la charge proposée, aide courte, virgule décimale', async () => {
    const seanceId = await seanceTerminee('r-ajuster')
    monter('r-ajuster')
    const dialogue = await screen.findByRole('dialog', { name: 'Progression' })
    expect(within(dialogue).queryByLabelText('Nouvelle charge (kg)')).toBeNull()
    fireEvent.click(within(dialogue).getByRole('radio', { name: 'Ajuster' }))
    const champ = within(dialogue).getByLabelText('Nouvelle charge (kg)') as HTMLInputElement
    expect(champ.value).toBe('45')
    expect(within(dialogue).getByText(/Ajuster : vous choisissez vous-même la charge visée/)).toBeTruthy()
    fireEvent.change(champ, { target: { value: '47,5' } })
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Valider' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await objectif(seanceId)).toEqual({ charge_cible: 47.5, reps_cible: 8, compteur_echec: 0 })
    expect(within(screen.getByRole('region', { name: 'Progression' })).getByText('Ajustée')).toBeTruthy()
  })

  it('« Ajuster » avec un champ vide : le récap reste ouvert, erreur en français, rien d’écrit', async () => {
    const seanceId = await seanceTerminee('r-vide-ajust')
    monter('r-vide-ajust')
    const dialogue = await screen.findByRole('dialog', { name: 'Progression' })
    fireEvent.click(within(dialogue).getByRole('radio', { name: 'Ajuster' }))
    fireEvent.change(within(dialogue).getByLabelText('Nouvelle charge (kg)'), { target: { value: '' } })
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Valider' }))
    expect(await within(dialogue).findByRole('alert')).toBeTruthy()
    expect(within(dialogue).getByRole('alert').textContent).toBe('Développé couché : la charge doit être un nombre de kg strictement positif.')
    expect(await objectif(seanceId)).toEqual({ charge_cible: 50, reps_cible: 8, compteur_echec: 2 })
  })

  it('charge non composable avec « Mon matériel » : indice et bouton « Arrondir »', async () => {
    await inserer(base, 'user_settings', {
      ...commun, id: deterministicId('u1', 'user_settings'),
      equipment_json: JSON.stringify({ barre: { barreKg: 20, disques: { '10': 2, '5': 2, '2.5': 2 } }, selectedCategories: ['BARRE'], pasParCategorie: {} }),
      panda_variant: 'male', dark_mode: null,
    })
    await seanceTerminee('r-hint')
    monter('r-hint')
    const dialogue = await screen.findByRole('dialog', { name: 'Progression' })
    fireEvent.click(within(dialogue).getByRole('radio', { name: 'Ajuster' }))
    fireEvent.change(within(dialogue).getByLabelText('Nouvelle charge (kg)'), { target: { value: '46' } })
    expect(within(dialogue).getByText('Pas composable avec votre matériel : la charge la plus proche est 45 kg.')).toBeTruthy()
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Arrondir à 45 kg' }))
    expect((within(dialogue).getByLabelText('Nouvelle charge (kg)') as HTMLInputElement).value).toBe('45')
    expect(within(dialogue).queryByText(/Pas composable/)).toBeNull()
    await base.execute('DELETE FROM user_settings')
  })

  it('« Déjà décidé » quand une décision a été enregistrée ailleurs entre-temps', async () => {
    const seanceId = await seanceTerminee('r-deja')
    monter('r-deja')
    const dialogue = await screen.findByRole('dialog', { name: 'Progression' })
    await base.execute('UPDATE instances_seance SET progression_json = ? WHERE id = ?', [
      '{"evaluee":true,"decisions":{"r-deja-e1":"refusee"}}',
      'r-deja',
    ])
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Valider' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(within(screen.getByRole('region', { name: 'Progression' })).getByText('Déjà décidé : Refusée')).toBeTruthy()
    expect(await objectif(seanceId)).toEqual({ charge_cible: 50, reps_cible: 8, compteur_echec: 2 })
  })

  it('à la réouverture, la décision enregistrée est affichée (ni en attente, ni disparue)', async () => {
    await seanceTerminee('r-reouverture')
    const premier = monter('r-reouverture')
    const dialogue = await screen.findByRole('dialog', { name: 'Progression' })
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Valider' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    premier.unmount()

    monter('r-reouverture')
    const progression = await screen.findByRole('region', { name: 'Progression' })
    expect(within(progression).getByText('Développé couché')).toBeTruthy()
    expect(within(progression).getByText('Acceptée')).toBeTruthy()
    // Rien en attente : le récap ne s'ouvre pas de lui-même
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('« Plus tard » et Échap ferment sans rien écrire ; le bouton du rapport rouvre le récap et récupère le focus', async () => {
    const seanceId = await seanceTerminee('r-focus')
    monter('r-focus')
    await screen.findByRole('dialog', { name: 'Progression' })
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await objectif(seanceId)).toEqual({ charge_cible: 50, reps_cible: 8, compteur_echec: 2 })
    // La section Progression dit ce qui attend l'utilisateur
    expect(within(screen.getByRole('region', { name: 'Progression' })).getByText('En attente de votre choix')).toBeTruthy()

    const bouton = screen.getByRole('button', { name: 'Voir le récap de progression' })
    bouton.focus()
    fireEvent.click(bouton)
    const dialogue = await screen.findByRole('dialog', { name: 'Progression' })
    expect(dialogue.contains(document.activeElement)).toBe(true)
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Plus tard' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Voir le récap de progression' }))
  })

  it('le focus reste piégé dans le récap (Tab sur le dernier élément revient au premier)', async () => {
    await seanceTerminee('r-piege')
    monter('r-piege')
    const dialogue = await screen.findByRole('dialog', { name: 'Progression' })
    const boutons = Array.from(dialogue.querySelectorAll<HTMLElement>('button, input'))
    boutons[boutons.length - 1].focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(boutons[0])
  })
})
