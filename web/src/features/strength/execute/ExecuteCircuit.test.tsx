// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInstance } from '../../../core/db/repos/instances'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'
import { ajouterBloc, ajouterExercice, brouillonVide, nouveauBloc, nouvelExercice, type SeanceDraft } from '../draft'
import { enregistrerBrouillon } from '../seanceStore'

const base = createTestDb()
vi.mock('../../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import ExecuteScreen from './ExecuteScreen'

const commun = { user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null }
await inserer(base, 'exercises', { ...commun, id: 'x1', name: 'Squat sauté' })
await inserer(base, 'exercises', { ...commun, id: 'x2', name: 'Gainage planche' })

const catalogue = (id: string, name: string) => ({ id, name, muscles: [], equipment: [], isBodyweight: true })

let compteur = 0
// Construit, par l'éditeur (brouillon -> enregistrement), un bloc Circuit : 2 exercices, 2 tours, durées de 4 s,
// repos 2 s entre exercices et 3 s en fin de tour. Renvoie l'instance planifiée à exécuter.
async function creerCircuit(): Promise<string> {
  const n = ++compteur
  let d: SeanceDraft = { ...brouillonVide(`s${n}`), nom: `Circuit ${n}` }
  d = ajouterBloc(d, { ...nouveauBloc(`bc${n}`, 'CIRCUIT'), tempsReposInterSec: 2, tempsReposFinRoundSec: 3, nombreSeriesPrevues: 2 })
  d = ajouterExercice(d, `bc${n}`, { ...nouvelExercice(`ea${n}`, catalogue('x1', 'Squat sauté'), 'CIRCUIT'), repsCibles: '4' })
  d = ajouterExercice(d, `bc${n}`, { ...nouvelExercice(`eb${n}`, catalogue('x2', 'Gainage planche'), 'CIRCUIT'), repsCibles: '4' })
  await enregistrerBrouillon(base, d)
  return createInstance(base, `s${n}`, '2026-10-24')
}

async function creerExerciceLibre(): Promise<string> {
  const n = ++compteur
  let d: SeanceDraft = { ...brouillonVide(`s${n}`), nom: `Libre ${n}` }
  d = ajouterExercice(d, null, { ...nouvelExercice(`el${n}`, catalogue('x2', 'Gainage planche'), null), repsType: 'DURATION', repsCibles: '45', nombreSeriesPrevues: 2 })
  await enregistrerBrouillon(base, d)
  return createInstance(base, `s${n}`, '2026-10-24')
}

function monter(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/strength/instance/${id}`]}>
      <Routes>
        <Route path="/strength/instance/:id" element={<ExecuteScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

type Ligne = { exercice_seance_id: string; numero_serie: number; reps_realisees: number; is_completed: number; validated_at: string | null }
const series = (instanceId: string) =>
  base.getAll<Ligne>(
    'SELECT exercice_seance_id, numero_serie, reps_realisees, is_completed, validated_at FROM series_realisees WHERE instance_seance_id = ? AND deleted_at IS NULL ORDER BY exercice_seance_id, numero_serie',
    [instanceId],
  )

// Fait avancer l'horloge fausse (dates et intervalles) de `s` secondes, une seconde à la fois, en laissant
// les écritures en base (promesses) se terminer
async function passer(s: number) {
  for (let i = 0; i < s; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
  }
  await viderFile()
}

// Laisse toutes les promesses (écritures en base, relectures, rendus) se terminer : chaque tour passe par une
// vraie macro-tâche (setImmediate n'est pas simulé), qui vide entièrement la file de micro-tâches
async function viderFile() {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
      await new Promise((resolve) => setImmediate(resolve))
    })
  }
}

// Le DOM de l'écran est chargé avec les vraies minuteries ; l'horloge est ensuite figée pour le circuit
async function ouvrir(id: string) {
  const r = monter(id)
  await screen.findByRole('heading', { level: 2 })
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
  return r
}

beforeEach(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete (navigator as unknown as Record<string, unknown>).wakeLock
})

const lancerCircuit = () => fireEvent.click(screen.getByRole('button', { name: /Démarrer le circuit|Reprendre le circuit/ }))

describe('circuit créé à l’édition puis exécuté automatiquement', () => {
  it('affiche le rappel des réglages et le bouton dans le bloc, avant tout démarrage', async () => {
    const id = await creerCircuit()
    await ouvrir(id)
    expect(screen.getByText('2 tours · 2 exercices · repos 2 s entre exercices, 3 s en fin de tour · environ 1 min')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Démarrer le circuit' })).toBeTruthy()
    expect(screen.getByText(/Les exercices s’enchaînent tout seuls/)).toBeTruthy()
    // le « Démarrer » de la séance reste distinct
    expect(screen.getByRole('button', { name: 'Démarrer' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('décompte, quatre séries validées dans l’ordre (durée, valeurs), repos, fin et annonce', async () => {
    const id = await creerCircuit()
    await ouvrir(id)
    lancerCircuit()
    await passer(0)
    const d = screen.getByRole('dialog', { name: 'Squat sauté' })
    expect(within(d).getByRole('timer').textContent).toBe('3')
    await passer(3)
    expect(within(screen.getByRole('dialog')).getByRole('timer').textContent).toBe('00:04')
    expect(screen.getByText('Série 1 sur 2')).toBeTruthy()
    expect(screen.getByText('Exercice 1 sur 2')).toBeTruthy()
    await passer(4) // fin de l'exercice 1
    expect((await series(id)).map((x) => [x.numero_serie, x.reps_realisees, x.is_completed])).toEqual([[1, 4, 1]])
    expect(screen.getByText('Prochain : Gainage planche')).toBeTruthy()
    await passer(2 + 4) // repos puis exercice 2
    expect((await series(id)).map((s) => [s.numero_serie, s.reps_realisees])).toEqual([[1, 4], [1, 4]])
    expect(screen.getByText('Fin du tour — repos')).toBeTruthy()
    await passer(3 + 4 + 2 + 4 + 2)
    const fin = await series(id)
    expect(fin).toHaveLength(4)
    expect(fin.map((s) => s.numero_serie)).toEqual([1, 2, 1, 2])
    expect(fin.every((s) => s.is_completed === 1 && s.reps_realisees === 4 && s.validated_at)).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Circuit terminé : toutes les séries sont enregistrées.')).toBeTruthy()
    // le chronomètre de séance a démarré avec le circuit
    expect((await base.get<{ started_at: string | null }>('SELECT started_at FROM instances_seance WHERE id = ?', [id])).started_at).not.toBeNull()
    // plus rien à lancer
    expect(screen.queryByRole('button', { name: /Démarrer le circuit|Reprendre le circuit/ })).toBeNull()
  })

  it('chronomètre la durée saisie dans le tableau (priorité sur la cible) et ne laisse pas de saisie périmée', async () => {
    const id = await creerCircuit()
    await ouvrir(id)
    fireEvent.change(screen.getByLabelText('Série 1, durée en secondes'), { target: { value: '6' } })
    lancerCircuit()
    await passer(3)
    expect(within(screen.getByRole('dialog')).getByRole('timer').textContent).toBe('00:06')
    await passer(6)
    expect((await series(id)).map((x) => x.reps_realisees)).toEqual([6])
    // la ligne validée affiche la valeur enregistrée, pas l'ancienne saisie
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Exercices de la séance' })).getByRole('button', { name: /^Squat sauté,/ }))
    expect((screen.getByLabelText('Série 1, durée en secondes') as HTMLInputElement).value).toBe('6')
  })

  it('arrêt manuel : ce qui est validé est conservé, plus rien n’est écrit ensuite', async () => {
    const id = await creerCircuit()
    await ouvrir(id)
    lancerCircuit()
    await passer(8)
    expect(await series(id)).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter le circuit' }))
    await passer(40)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await series(id)).toHaveLength(1)
    expect(screen.getByText('Circuit arrêté : les séries déjà validées sont conservées.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reprendre le circuit' })).toBeTruthy()
  })

  it('rechargement en plein circuit : aucune série perdue ni dupliquée, le circuit reprend où il en était', async () => {
    const id = await creerCircuit()
    const premier = await ouvrir(id)
    lancerCircuit()
    await passer(8)
    expect(await series(id)).toHaveLength(1)
    premier.unmount()
    vi.useRealTimers()
    await ouvrir(id)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await series(id)).toHaveLength(1)
    lancerCircuit()
    await passer(40)
    const fin = await series(id)
    expect(fin).toHaveLength(4)
    expect(new Set(fin.map((s) => `${s.exercice_seance_id}#${s.numero_serie}`)).size).toBe(4)
  })

  it('onglet masqué puis de retour : tout est rattrapé depuis les horodatages, sans doublon', async () => {
    const id = await creerCircuit()
    await ouvrir(id)
    lancerCircuit()
    await passer(0)
    // l'onglet dort 40 s : aucune minuterie ne tourne, l'horloge avance
    vi.setSystemTime(Date.now() + 40_000)
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await passer(0)
    const fin = await series(id)
    expect(fin).toHaveLength(4)
    expect(new Set(fin.map((s) => `${s.exercice_seance_id}#${s.numero_serie}`)).size).toBe(4)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('garde l’écran allumé pendant le circuit', async () => {
    const request = vi.fn(async () => ({ release: async () => {} }))
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })
    const id = await creerCircuit()
    await ouvrir(id)
    expect(request).not.toHaveBeenCalled()
    lancerCircuit()
    await passer(0)
    expect(request).toHaveBeenCalledWith('screen')
  })
})

describe('minuteur d’un exercice en durée', () => {
  it('bouton « Démarrer le minuteur » hors circuit ; durée invalide refusée avec un message', async () => {
    const id = await creerExerciceLibre()
    await ouvrir(id)
    expect(screen.queryByRole('button', { name: 'Démarrer le circuit' })).toBeNull()
    const duree = screen.getByLabelText('Série 1, durée en secondes') as HTMLInputElement
    fireEvent.change(duree, { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer le minuteur' }))
    expect(screen.getByRole('alert').textContent).toBe('Durée invalide : saisissez un nombre de secondes supérieur à 0.')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await series(id)).toHaveLength(0)
  })

  it('chronomètre la durée saisie, enregistre la série tout seul, puis rend la main', async () => {
    const id = await creerExerciceLibre()
    await ouvrir(id)
    fireEvent.change(screen.getByLabelText('Série 1, durée en secondes'), { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer le minuteur' }))
    await passer(0)
    expect(screen.getByRole('button', { name: 'Arrêter le minuteur' })).toBeTruthy()
    expect(screen.queryByText(/Exercice \d sur/)).toBeNull()
    await passer(3 + 6)
    const lignes = await series(id)
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({ numero_serie: 1, reps_realisees: 6, is_completed: 1 })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Minuteur terminé : série enregistrée.')).toBeTruthy()
    // la deuxième série reste à faire : le bouton est de retour
    expect(screen.getByRole('button', { name: 'Démarrer le minuteur' })).toBeTruthy()
  })
})
