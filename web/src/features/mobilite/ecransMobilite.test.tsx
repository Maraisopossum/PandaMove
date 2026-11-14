// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enregistrerSeanceMobilite } from '../../core/db/repos/mobilite'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'

const base = createTestDb()
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))
vi.mock('../../core/images/usePandaVariante', () => ({ useImagePanda: () => null, usePandaVariante: () => 'female' }))

import ApercuMobiliteScreen from './ApercuMobiliteScreen'
import MobiliteScreen from './MobiliteScreen'
import { EXERCICES } from './donnees'
import { lireRoutines } from './routines'
import RoutinesMobiliteScreen from './RoutinesMobiliteScreen'
import { lireChoix, lirePlan } from './stockage'

beforeEach(async () => {
  // Seule l'horloge est simulée (jeudi 12 novembre 2026) : les minuteries réelles servent à findBy / waitFor
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 12, 9, 0))
  localStorage.clear()
  sessionStorage.clear()
  await base.execute('DELETE FROM seances_mobilite')
  await base.execute('DELETE FROM sorties')
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const monter = (entree = '/mobility') =>
  render(
    <MemoryRouter initialEntries={[entree]}>
      <Routes>
        <Route path="/mobility" element={<MobiliteScreen />} />
        <Route path="/mobility/apercu" element={<ApercuMobiliteScreen />} />
        <Route path="/mobility/routines" element={<RoutinesMobiliteScreen />} />
      </Routes>
    </MemoryRouter>,
  )

const pressed = (nom: string | RegExp) => screen.getByRole('button', { name: nom }).getAttribute('aria-pressed')

describe('Mobilité : types d’exercices et programme annoncé', () => {
  it('trois types actifs au départ, avec leur nombre d’exercices ; on en décoche, jamais le dernier', () => {
    monter()
    const groupe = screen.getByRole('group', { name: 'Types d’exercices' })
    const boutons = within(groupe).getAllByRole('button')
    const n = (type: string) => EXERCICES.filter((e) => e.type === type).length
    expect(boutons.map((b) => b.textContent)).toEqual([`Mobilité${n('mobilite')} exercices`, `Activation${n('activation')} exercices`, `Étirement${n('etirement')} exercices`])
    expect(boutons.every((b) => b.getAttribute('aria-pressed') === 'true')).toBe(true)

    fireEvent.click(within(groupe).getByRole('button', { name: /Étirement/ }))
    expect(lireChoix().types).toEqual(['mobilite', 'activation'])
    fireEvent.click(within(groupe).getByRole('button', { name: /Activation/ }))
    fireEvent.click(within(groupe).getByRole('button', { name: /Mobilité/ })) // dernier type : sans effet
    expect(lireChoix().types).toEqual(['mobilite'])
    expect(within(groupe).getByRole('button', { name: /Mobilité/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('« Mobilité seule » règle les types sans étirement ; retoucher un type la détache du sport', () => {
    monter()
    fireEvent.click(screen.getByRole('button', { name: /Mobilité seule/ }))
    expect(pressed(/Mobilité seule/)).toBe('true')
    expect(pressed(/Étirement/)).toBe('false')
    expect(lireChoix()).toMatchObject({ sport: 'seule', types: ['mobilite', 'activation'], moment: 'avant' })
    fireEvent.click(screen.getByRole('button', { name: /Étirement/ }))
    expect(pressed(/Mobilité seule/)).toBe('false')
    expect(lireChoix().sport).toBeNull()
  })

  it('« Au programme » annonce la séance même que « Générer » prépare', () => {
    monter()
    fireEvent.click(screen.getByRole('button', { name: /Mobilité seule/ }))
    const programme = screen.getByRole('region', { name: 'Au programme' })
    const annonce = /(\d+) exercices · (\d+) min/.exec(programme.textContent ?? '')!
    expect(annonce).not.toBeNull()
    expect(programme.textContent).not.toContain('d’étirement')
    fireEvent.click(screen.getByRole('button', { name: /Générer ma séance de 10 min/ }))
    expect(screen.getByRole('heading', { name: 'Votre séance' })).toBeTruthy()
    const plan = lirePlan()!
    expect(plan.etapes).toHaveLength(Number(annonce[1]))
    expect(plan.etapes.every((e) => e.exercice.type !== 'etirement')).toBe(true)
    expect(plan.types).toEqual(['mobilite', 'activation'])
  })

  it('combinaison sans exercice : message clair, Générer et Enregistrer inactifs', () => {
    monter()
    fireEvent.click(screen.getByRole('button', { name: /Mobilité\d/ }))
    fireEvent.click(screen.getByRole('button', { name: /Étirement\d/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cuisses (avant)' }))
    expect(screen.getByRole('region', { name: 'Au programme' }).textContent).toContain('Aucun exercice ne correspond')
    expect((screen.getByRole('button', { name: /Générer ma séance/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Enregistrer' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('Mobilité : routines enregistrées', () => {
  it('enregistre le réglage sous un nom proposé et modifiable, puis le propose en tête d’écran', () => {
    monter()
    expect(screen.queryByRole('heading', { name: 'Mes routines' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Mobilité seule/ }))
    fireEvent.click(screen.getByRole('button', { name: '5 minutes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    const champ = screen.getByRole('textbox', { name: 'Nom de la routine' }) as HTMLInputElement
    expect(champ.value).toBe('Mobilité seule · 5 min')
    fireEvent.change(champ, { target: { value: '   ' } })
    expect((screen.getByRole('button', { name: 'Enregistrer la routine' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(champ, { target: { value: 'Échauffement express' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la routine' }))

    expect(screen.queryByRole('textbox', { name: 'Nom de la routine' })).toBeNull()
    const routines = lireRoutines()
    expect(routines).toHaveLength(1)
    expect(routines[0]).toMatchObject({ nom: 'Échauffement express', choix: { minutes: 5, sport: 'seule', types: ['mobilite', 'activation'] } })
    const section = screen.getByRole('region', { name: 'Mes routines' })
    expect(within(section).getByRole('button', { name: /Échauffement express/ })).toBeTruthy()
    expect(within(section).getByRole('link', { name: 'Gérer' }).getAttribute('href')).toBe('/mobility/routines')
  })

  it('annuler l’enregistrement ne crée rien', () => {
    monter()
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('textbox', { name: 'Nom de la routine' })).toBeNull()
    expect(lireRoutines()).toEqual([])
  })

  it('lancer une routine reprend son réglage, prépare la séance et ouvre l’aperçu', () => {
    localStorage.setItem('pandamove.mobilite.routines', JSON.stringify([{ id: 'r1', nom: 'Hanches', choix: { minutes: 15, zones: ['hanches'], moment: 'avant', sport: null, types: ['activation'] } }]))
    monter()
    fireEvent.click(within(screen.getByRole('region', { name: 'Mes routines' })).getByRole('button', { name: /Hanches/ }))
    expect(screen.getByRole('heading', { name: 'Votre séance' })).toBeTruthy()
    const plan = lirePlan()!
    expect(plan.minutes).toBe(15)
    expect(plan.zones).toEqual(['hanches'])
    expect(plan.etapes.length).toBeGreaterThan(0)
    expect(plan.etapes.every((e) => e.exercice.type === 'activation')).toBe(true)
    expect(lireChoix()).toMatchObject({ minutes: 15, moment: 'avant', types: ['activation'] })
  })
})

describe('Routines : régularité, suggestion et gestion', () => {
  const seance = (date: string) => enregistrerSeanceMobilite(base, { date, dureeS: 600, exercices: 8, zones: ['hanches'], sport: null })

  it('régularité : jours de suite, totaux sur quatre semaines et grille accessible', async () => {
    await seance('2026-11-12')
    await seance('2026-11-11')
    await seance('2026-11-02')
    monter('/mobility/routines')
    expect(await screen.findByText('2 j')).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/Vous avez fait 3 séances en 4 semaines, soit 30 min de mobilité\./)).toBeTruthy())
    const grille = screen.getByRole('list', { name: 'Séances de mobilité des quatre dernières semaines' })
    const jours = within(grille).getAllByRole('listitem')
    expect(jours).toHaveLength(28)
    expect(jours.filter((j) => j.textContent?.includes('séance faite'))).toHaveLength(3)
    expect(jours.filter((j) => j.textContent?.includes('à venir'))).toHaveLength(3)
  })

  it('sans séance : message simple, aucune suggestion, aide pour créer une routine', async () => {
    monter('/mobility/routines')
    expect(await screen.findByText('Aucune séance de mobilité ces quatre semaines.')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Suggestion du jour' })).toBeNull()
    expect(screen.getByText(/Aucune routine pour l’instant/)).toBeTruthy()
  })

  it('suggestion après une grosse sortie : lance la routine « après le sport » ou une séance type', async () => {
    await inserer(base, 'sorties', {
      id: 'v1', user_id: 'u1', updated_at: 'u', deleted_at: null, created_at: 'c', sport: 'velo', date: '2026-11-11', titre: 'Sortie vélo',
      duree_s: 7200, distance_m: 60000, source: 'manuel', en_salle: 0,
    })
    monter('/mobility/routines')
    const suggestion = await screen.findByRole('region', { name: 'Suggestion du jour' })
    expect(suggestion.textContent).toContain('Sortie vélo de 2 h hier. Une routine de 10 min aidera à relâcher.')
    fireEvent.click(within(suggestion).getByRole('button', { name: 'Lancer une séance de 10 min' }))
    expect(screen.getByRole('heading', { name: 'Votre séance' })).toBeTruthy()
    expect(lirePlan()!.moment).toBe('apres')
  })

  it('pas de suggestion quand une séance de mobilité est déjà faite aujourd’hui', async () => {
    await inserer(base, 'sorties', {
      id: 'v1', user_id: 'u1', updated_at: 'u', deleted_at: null, created_at: 'c', sport: 'velo', date: '2026-11-11', titre: 'Sortie vélo',
      duree_s: 7200, distance_m: 60000, source: 'manuel', en_salle: 0,
    })
    await seance('2026-11-12')
    monter('/mobility/routines')
    await screen.findByText('1 j')
    expect(screen.queryByRole('region', { name: 'Suggestion du jour' })).toBeNull()
  })

  it('renomme une routine, puis la supprime après confirmation', async () => {
    localStorage.setItem('pandamove.mobilite.routines', JSON.stringify([
      { id: 'a', nom: 'Pause bureau', choix: { minutes: 5, zones: ['cou', 'epaules'], moment: 'libre', sport: null, types: ['mobilite'] } },
      { id: 'b', nom: 'Après le vélo', choix: { minutes: 12, zones: ['hanches'], moment: 'apres', sport: 'velo', types: ['etirement'] } },
    ]))
    monter('/mobility/routines')
    const liste = await screen.findByRole('region', { name: 'Mes routines' })
    expect(within(liste).getAllByRole('listitem').length).toBeGreaterThanOrEqual(2)
    expect(liste.textContent).toContain('5 min')
    expect(liste.textContent).toContain('après le sport')

    fireEvent.click(within(liste).getByRole('button', { name: /Modifier la routine Pause bureau/ }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Nom de la routine' }), { target: { value: 'Pause café' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(lireRoutines().map((r) => r.nom)).toEqual(['Pause café', 'Après le vélo'])

    fireEvent.click(within(liste).getByRole('button', { name: /Modifier la routine Après le vélo/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la routine' }))
    // Rien n'est supprimé avant la confirmation
    expect(lireRoutines()).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Garder' }))
    expect(lireRoutines()).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la routine' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }))
    expect(lireRoutines().map((r) => r.nom)).toEqual(['Pause café'])
  })
})
