// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { MUSCLE_GROUPS } from '../../core/db/types'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'

let base: Db
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: '11111111-1111-4111-8111-111111111111' } } }),
}))

import StatsScreen from './StatsScreen'

const b = { user_id: 'u1', updated_at: '2026-01-01T00:00:00Z', deleted_at: null }

async function seanceTerminee(id: string, date: string, reps: number, charge: number) {
  await inserer(base, 'instances_seance', { ...b, id, seance_id: 's1', date, is_completed: 1, duration_seconds: 1800 })
  await inserer(base, 'exercices_seance', {
    ...b, id: `es-${id}`, seance_id: 's1', exercise_id: 'ex-dc', instance_seance_id: id, position: 0, reps_type: 'REPS',
  })
  await inserer(base, 'series_realisees', {
    ...b, id: `sr-${id}`, instance_seance_id: id, exercice_seance_id: `es-${id}`, numero_serie: 1,
    reps_realisees: reps, charge_kg: charge, is_completed: 1,
  })
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 24, 15, 0))
  localStorage.clear()
  base = createTestDb()
  await inserer(base, 'exercises', {
    ...b, id: 'ex-dc', name: 'Développé couché', category: 'CHEST', muscle_groups: '["PECTORAUX"]', muscle_primary: '',
  })
  await seanceTerminee('i1', '2026-10-20', 10, 120) // 1 200 kg
  await seanceTerminee('i2', '2026-08-01', 10, 100) // hors des 30 derniers jours
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.clear()
})

const texte = (el: Element) => (el.textContent ?? '').replace(/\s/g, ' ')

describe('StatsScreen', () => {
  it('affiche le résumé de la période, la figure et les 16 groupes', async () => {
    render(<StatsScreen />)
    const resume = await screen.findByRole('region', { name: 'Résumé de la période' })
    await waitFor(() => expect(texte(resume)).toContain('1 200 kg'))
    expect(texte(resume)).toMatch(/1\s*séance terminée/)
    expect(screen.getByRole('button', { name: '1 mois' }).getAttribute('aria-pressed')).toBe('true')

    // Le détail par muscle est replié par défaut : un aperçu des trois premiers, la liste s'ouvre sur demande
    const bascule = screen.getByRole('button', { name: /Détail par muscle/ })
    expect(bascule.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('list', { name: 'Séries par groupe musculaire' })).toBeNull()
    expect(texte(screen.getByRole('region', { name: 'Muscles travaillés' }))).toContain('Pectoraux 1')
    fireEvent.click(bascule)
    expect(bascule.getAttribute('aria-expanded')).toBe('true')
    const liste = screen.getByRole('list', { name: 'Séries par groupe musculaire' })
    expect(within(liste).getAllByRole('listitem')).toHaveLength(MUSCLE_GROUPS.length)
    expect(texte(within(liste).getAllByRole('listitem')[0])).toMatch(/Pectoraux.*1 série/)
    expect(texte(liste)).toContain('Adducteurs')
    expect(texte(liste)).toContain('Autre')
  })

  it('bascule entre face et dos', async () => {
    render(<StatsScreen />)
    const figure = await screen.findByRole('figure', { name: /Heatmap musculaire/ })
    const image = () => figure.querySelector('img')?.getAttribute('src')
    expect(image()).toBe('/panda/heatmap-male-face.webp')
    expect(figure.querySelector('title')?.textContent).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Dos' }))
    expect(screen.getByRole('button', { name: 'Dos' }).getAttribute('aria-pressed')).toBe('true')
    expect(image()).toBe('/panda/heatmap-male-dos.webp')
  })

  it('changer de période recharge les chiffres et retient le choix', async () => {
    render(<StatsScreen />)
    const resume = await screen.findByRole('region', { name: 'Résumé de la période' })
    await waitFor(() => expect(texte(resume)).toContain('1 200 kg'))
    fireEvent.click(screen.getByRole('button', { name: '3 mois' }))
    await waitFor(() => expect(texte(resume)).toContain('2 200 kg'))
    expect(localStorage.getItem('pandamove.stats.periode')).toBe('3m')
  })

  it('état vide quand aucune séance terminée sur la période', async () => {
    // Seule la séance d'août existe : rien sur les 7 derniers jours
    localStorage.setItem('pandamove.stats.periode', '7j')
    await base.execute('DELETE FROM series_realisees WHERE id = ?', ['sr-i1'])
    await base.execute('DELETE FROM instances_seance WHERE id = ?', ['i1'])
    render(<StatsScreen />)
    expect(await screen.findByText('Aucune séance terminée sur cette période.')).toBeTruthy()
    expect(screen.queryByRole('figure')).toBeNull()
    // L'historique reste disponible (toutes dates)
    expect(screen.getByRole('region', { name: "Historique d'un exercice" })).toBeTruthy()
  })

  it("erreur de lecture : alertes visibles, jamais l'état vide", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reelle = base
    base = { ...reelle, getAll: () => Promise.reject(new Error('base indisponible')) }
    render(<StatsScreen />)
    expect(await screen.findByText('Le chargement des statistiques a échoué.')).toBeTruthy()
    expect(await screen.findByText("Le chargement de l'historique a échoué.")).toBeTruthy()
    expect(screen.queryByText('Aucune séance terminée sur cette période.')).toBeNull()
  })

  it("affiche l'historique de l'exercice en graphique et en tableau", async () => {
    render(<StatsScreen />)
    const section = await screen.findByRole('region', { name: "Historique d'un exercice" })
    const tableau = await within(section).findByRole('table')
    await waitFor(() => expect(within(tableau).getAllByRole('row')).toHaveLength(3))
    expect(texte(tableau)).toMatch(/1 août 2026.*100 kg.*10/)
    expect(texte(tableau)).toMatch(/20 oct\. 2026.*120 kg.*10/)
    expect(within(section).getByRole('combobox', { name: 'Exercice' })).toBeTruthy()
    expect(section.querySelector('svg polyline')).toBeTruthy()
  })

  it('compare la période à la précédente : plage annoncée et tendances sur séances, séries et répétitions', async () => {
    render(<StatsScreen />)
    expect(await screen.findByText(/Du 24 sept\. au 24 oct\./)).toBeTruthy()
    expect(screen.getByText(/comparé au 24 août – 23 sept\./)).toBeTruthy()
    const resume = await screen.findByRole('region', { name: 'Résumé de la période' })
    // Rien sur la période précédente : +1 séance, +1 série, +10 répétitions ; pas de pourcentage de tonnage (division par zéro)
    await waitFor(() => expect(texte(resume)).toContain('↑ +1 par rapport à la période précédente'))
    expect(texte(resume)).toContain('↑ +10 par rapport')
    expect(texte(resume)).not.toContain('%')
    // « Tout » n'a pas de période précédente
    fireEvent.click(screen.getByRole('button', { name: 'Tout' }))
    await waitFor(() => expect(screen.queryByText(/comparé au/)).toBeNull())
    expect(screen.getByText('Depuis le début')).toBeTruthy()
  })

  it('records personnels : 1RM estimé, nouveau record récent, sélection de l’exercice dans l’historique', async () => {
    render(<StatsScreen />)
    const records = await screen.findByRole('region', { name: 'Records personnels' })
    // 120 kg × 10 -> 160 kg (Epley) ; établi le 20 oct., 4 jours avant « aujourd'hui »
    expect(texte(records)).toMatch(/Développé couché.*120 kg × 10.*20 oct\. 2026.*160 kg.*Nouveau record/)
    fireEvent.click(within(records).getByRole('button', { name: /Développé couché/ }))
    expect((screen.getByRole('combobox', { name: 'Exercice' }) as HTMLSelectElement).value).toBe('ex-dc')
  })

  it('tonnage par semaine : quatre semaines, la dernière est la semaine en cours', async () => {
    render(<StatsScreen />)
    const barres = await screen.findByRole('list', { name: 'Tonnage des quatre dernières semaines' })
    const semaines = within(barres).getAllByRole('listitem')
    expect(semaines).toHaveLength(4)
    expect(texte(semaines[3])).toContain('Cette semaine')
    expect(texte(semaines[3])).toContain('1,2 t') // 20 oct. : semaine du lundi 19
  })

  it('exercice affiché en premier : réglage d’appareil, retenu et retirable', async () => {
    await inserer(base, 'exercises', { ...b, id: 'ex-sq', name: 'Squat', category: 'LEGS', muscle_groups: '["QUADRICEPS"]', muscle_primary: '' })
    await inserer(base, 'exercices_seance', { ...b, id: 'es-sq', seance_id: 's1', exercise_id: 'ex-sq', instance_seance_id: 'i1', position: 1, reps_type: 'REPS' })
    await inserer(base, 'series_realisees', { ...b, id: 'sr-sq', instance_seance_id: 'i1', exercice_seance_id: 'es-sq', numero_serie: 1, reps_realisees: 5, charge_kg: 100, is_completed: 1 })
    const exercice = () => (screen.getByRole('combobox', { name: 'Exercice' }) as HTMLSelectElement).value
    const { unmount } = render(<StatsScreen />)
    const choix = await screen.findByRole('combobox', { name: 'Exercice' })
    await waitFor(() => expect(exercice()).toBe('ex-dc')) // sans réglage : le premier par ordre alphabétique
    fireEvent.change(choix, { target: { value: 'ex-sq' } })
    const bouton = await screen.findByRole('button', { name: /Afficher cet exercice en premier/ })
    expect(bouton.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(bouton)
    expect(localStorage.getItem('pandamove.stats.exerciceDefaut')).toBe('ex-sq')
    expect(screen.getByRole('button', { name: /Exercice affiché en premier/ }).getAttribute('aria-pressed')).toBe('true')
    unmount()

    // Au prochain affichage, Squat est montré d'emblée
    render(<StatsScreen />)
    await waitFor(() => expect(exercice()).toBe('ex-sq'))
    // Retrait du réglage
    fireEvent.click(await screen.findByRole('button', { name: /Exercice affiché en premier/ }))
    expect(localStorage.getItem('pandamove.stats.exerciceDefaut')).toBeNull()
  })

  it('un exercice défini par défaut puis disparu : retour au premier de la liste', async () => {
    localStorage.setItem('pandamove.stats.exerciceDefaut', 'ex-inconnu')
    render(<StatsScreen />)
    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Exercice' }) as HTMLSelectElement).value).toBe('ex-dc'))
  })

  it('courbe : mesure au choix, axes, point record et bulle d’information au toucher', async () => {
    render(<StatsScreen />)
    const section = await screen.findByRole('region', { name: "Historique d'un exercice" })
    const groupe = await within(section).findByRole('group', { name: 'Mesure affichée' })
    expect(within(groupe).getByRole('button', { name: 'Charge max' }).getAttribute('aria-pressed')).toBe('true')
    // Deux séances (100 kg le 1er août, 120 kg le 20 oct.) : le record est la plus récente ; la bulle montre la dernière séance
    const bulle = () => within(section).getByRole('status')
    expect(texte(bulle())).toMatch(/20 oct\. 2026.*120 kg × 10.*record/)
    fireEvent.click(within(section).getByRole('button', { name: /1 août 2026 : 100 kg × 10/ }))
    expect(texte(bulle())).toMatch(/1 août 2026.*100 kg × 10/)
    expect(texte(bulle())).not.toContain('record')
    fireEvent.click(within(groupe).getByRole('button', { name: '1RM estimé' }))
    expect(within(groupe).getByRole('button', { name: '1RM estimé' }).getAttribute('aria-pressed')).toBe('true')
    expect(texte(bulle())).toMatch(/1RM estimé 133,3 kg/)
    // Axes : dates en abscisse
    expect(section.querySelector('svg')?.textContent).toMatch(/20 oct/)
    // Synthèse : record, progression et 1RM
    expect(texte(section)).toMatch(/Record.*120 kg.*Progression.*\+20 kg.*depuis le 1 août 2026.*1RM estimé.*160 kg/)
    // Volume ajouté au tableau
    expect(texte(within(section).getByRole('table'))).toMatch(/Volume/)
  })
})
