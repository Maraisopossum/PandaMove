// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import type { PointHistorique } from '../stats/statsQueries'

const base = createTestDb()
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))
vi.mock('../../core/images/usePandaVariante', () => ({ useImagePanda: () => null, usePandaVariante: () => 'male' }))
vi.mock('../respiration/audio', () => ({ preparerAudio: vi.fn() }))

import { lirePlan } from '../mobilite/stockage'
import { infoExercice } from './infoExercice'
import SeanceDetailScreen from './SeanceDetailScreen'
import SeanceListScreen from './SeanceListScreen'
import { BilanPlus } from './report/BilanPlus'

const texte = (el: Element) => (el.textContent ?? '').replace(/\s/g, ' ')
const b = { user_id: 'u1', updated_at: 'u0', deleted_at: null }
let nSerie = 0

const exercice = (db: Db, id: string, name: string, groupes: string[]) =>
  inserer(db, 'exercises', { ...b, id, name, category: 'OTHER', muscle_groups: JSON.stringify(groupes), description: '', is_favorite: 0, is_custom: 0, image_url: null, exercise_type: '', equipment: '[]', muscle_primary: '', is_bodyweight: 0 })
const modele = (db: Db, id: string, nom: string) =>
  inserer(db, 'seances', { ...b, id, nom, groupes_musculaires: '[]', duree_estimee_min: 45, notes: '', seance_category: 'STRENGTH', created_at: 'c', is_archived: 0 })
const exoModele = (db: Db, id: string, seanceId: string, exerciseId: string, extra: Record<string, unknown> = {}) =>
  inserer(db, 'exercices_seance', { ...b, id, seance_id: seanceId, instance_seance_id: null, exercise_id: exerciseId, position: 0, nombre_series_prevues: 4, reps_cibles: '8', ...extra })
const joue = (db: Db, id: string, seanceId: string, date: string, duree = 3000) =>
  inserer(db, 'instances_seance', { ...b, id, seance_id: seanceId, date, is_completed: 1, duration_seconds: duree, created_at: 'c' })
async function series(db: Db, instanceId: string, exerciseId: string, n: number, reps: number, charge: number) {
  const es = `es-${instanceId}-${exerciseId}`
  await db.execute('INSERT OR IGNORE INTO exercices_seance (id, user_id, updated_at, deleted_at, seance_id, exercise_id, instance_seance_id, position, reps_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [es, 'u1', 'u0', null, 's', exerciseId, instanceId, 0, 'REPS'])
  for (let i = 0; i < n; i++) {
    nSerie++
    await inserer(db, 'series_realisees', { ...b, id: `sr-${String(nSerie).padStart(5, '0')}`, instance_seance_id: instanceId, exercice_seance_id: es, numero_serie: i + 1, reps_realisees: reps, charge_kg: charge, is_completed: 1, notes: '' })
  }
}

// Jeudi 14 novembre : seule l'horloge est simulée ; les muscles travaillés sur 14 jours sont pectoraux et dos, pas les jambes
beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 14, 9, 0))
  await exercice(base, 'dc', 'Développé couché', ['PECTORAUX'])
  await exercice(base, 'tr', 'Tractions', ['DOS'])
  await exercice(base, 'sq', 'Squat', ['QUADRICEPS'])
  await exercice(base, 'hip', 'Hip thrust', ['FESSIERS'])
  await modele(base, 'push', 'Push')
  await modele(base, 'pull', 'Pull')
  await modele(base, 'jambes', 'Jambes')
  await exoModele(base, 'm1', 'push', 'dc')
  await exoModele(base, 'm2', 'pull', 'tr')
  await exoModele(base, 'm3', 'jambes', 'sq', { charge_cible: '105', reps_cibles: '6' })
  await exoModele(base, 'm4', 'jambes', 'hip', { charge_cible: '100', reps_cibles: '12', position: 1 })
  // Historique : push (12 nov. et 28 oct.), pull (10 nov. et 20 oct.), jambes (5 nov.)
  await joue(base, 'i-push2', 'push', '2026-11-12')
  await series(base, 'i-push2', 'dc', 10, 8, 60) // 4 800 kg
  await joue(base, 'i-push1', 'push', '2026-10-28')
  await series(base, 'i-push1', 'dc', 5, 8, 50) // 2 000 kg
  await joue(base, 'i-pull2', 'pull', '2026-11-10')
  await series(base, 'i-pull2', 'tr', 8, 8, 40) // 2 560 kg
  await joue(base, 'i-pull1', 'pull', '2026-10-20')
  await series(base, 'i-pull1', 'tr', 4, 8, 40) // 1 280 kg
  await joue(base, 'i-jambes', 'jambes', '2026-11-05')
  await series(base, 'i-jambes', 'sq', 2, 5, 100) // 1 000 kg ; 1RM 116,67
  await series(base, 'i-jambes', 'hip', 2, 10, 100) // 2 000 kg
})
afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

const monterListe = () =>
  render(
    <MemoryRouter initialEntries={['/strength']}>
      <Routes>
        <Route path="/strength" element={<SeanceListScreen />} />
        <Route path="/strength/:id" element={<p>Détail</p>} />
        <Route path="/strength/instance/:id" element={<p>Écran exécution</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('Renforcement : suggestion du jour et dernière fois', () => {
  it('suggère la séance qui travaille les muscles en retard, avec l’équilibre des 14 jours', async () => {
    monterListe()
    const carte = await screen.findByRole('region', { name: 'Séance suggérée aujourd’hui' })
    expect(texte(carte)).toContain('Jambes')
    expect(texte(carte)).toMatch(/Quadriceps et fessiers sont les moins travaillés ces deux semaines \(2 séries chacun contre 10 pour pectoraux\)/)
    const barres = within(carte).getByRole('list', { name: 'Séries par groupe musculaire sur 14 jours' })
    expect(within(barres).getAllByRole('listitem').map((l) => texte(l))).toEqual(['Pectoraux10', 'Dos8', 'Quadriceps2', 'Fessiers2'])
    expect(texte(carte)).toContain('d’après vos 14 derniers jours')
  })

  it('« Commencer » lance la séance suggérée ; « Autre idée » n’apparaît qu’avec plusieurs suggestions', async () => {
    monterListe()
    const carte = await screen.findByRole('region', { name: 'Séance suggérée aujourd’hui' })
    expect(within(carte).queryByRole('button', { name: 'Autre idée' })).toBeNull() // une seule séance touche les muscles en retard
    fireEvent.click(within(carte).getByRole('button', { name: 'Commencer Jambes' }))
    expect(await screen.findByText('Écran exécution')).toBeTruthy()
    const lancee = await base.getOptional<{ seance_id: string; started_at: string | null }>("SELECT seance_id, started_at FROM instances_seance WHERE date = '2026-11-14'")
    expect(lancee?.seance_id).toBe('jambes')
    expect(lancee?.started_at).not.toBeNull()
    await base.execute("DELETE FROM instances_seance WHERE date = '2026-11-14'")
  })

  it('alerte de charge : tonnage des 7 derniers jours bien au-dessus de la moyenne des blocs précédents', async () => {
    monterListe()
    const alerte = await screen.findByRole('region', { name: 'Charge de la semaine en hausse' })
    expect(texte(alerte)).toMatch(/\d+ % au-dessus de votre moyenne des 4 semaines précédentes/)
    expect(texte(alerte)).toContain('Indicateur indicatif')
  })

  it('chaque séance type indique sa dernière fois et la tendance de tonnage', async () => {
    monterListe()
    await screen.findByRole('region', { name: 'Séance suggérée aujourd’hui' })
    const liste = screen.getAllByRole('list').find((l) => l.className.includes('seances__liste'))!
    const carte = (nom: string) => Array.from(liste.querySelectorAll(':scope > li')).find((l) => l.querySelector('.seance__nom')?.textContent === nom)!
    await waitFor(() => expect(texte(carte('Push'))).toContain('il y a 2 jours'))
    expect(texte(carte('Push'))).toContain('↑ +140 % de tonnage') // 4 800 contre 2 000
    expect(texte(carte('Pull'))).toContain('il y a 4 jours · ↑ +100 % de tonnage') // 2 560 contre 1 280
    expect(texte(carte('Jambes'))).toContain('il y a 9 jours')
    expect(texte(carte('Jambes'))).not.toContain('tonnage')
  })
})

describe('Renforcement : détail d’une séance type', () => {
  const monterDetail = (id: string) =>
    render(
      <MemoryRouter initialEntries={[`/strength/${id}`]}>
        <Routes>
          <Route path="/strength/:id" element={<SeanceDetailScreen />} />
          <Route path="/mobility/apercu" element={<p>Aperçu mobilité</p>} />
        </Routes>
      </MemoryRouter>,
    )

  it('échauffement conseillé : zones des muscles de la séance, lancement dans Mobilité', async () => {
    monterDetail('jambes')
    const section = await screen.findByRole('region', { name: 'Échauffement conseillé' })
    expect(texte(section)).toContain('8 min de mobilité et d’activation : hanches, fessiers, cuisses (avant).')
    fireEvent.click(within(section).getByRole('button', { name: 'Lancer dans Mobilité' }))
    expect(await screen.findByText('Aperçu mobilité')).toBeTruthy()
    const plan = lirePlan()!
    expect(plan.minutes).toBe(8)
    expect(plan.zones).toEqual(['hanches', 'fessiers', 'quadriceps'])
    expect(plan.moment).toBe('avant')
    expect(plan.types).toEqual(['mobilite', 'activation'])
    expect(plan.etapes.every((e) => e.exercice.type !== 'etirement')).toBe(true)
  })

  it('dernière fois et indication de cible de chaque exercice', async () => {
    monterDetail('jambes')
    const compo = await screen.findByRole('region', { name: 'Composition' })
    await waitFor(() => expect(texte(compo)).toContain('Dernière fois : 100 kg × 5'))
    const exos = Array.from(compo.querySelectorAll('.detail__exo')).map((l) => texte(l))
    // Squat : cible 105 kg × 6 = 1RM 126 kg, au-dessus du meilleur 116,67 kg
    expect(exos[0]).toMatch(/Squat.*Dernière fois : 100 kg × 5.*Record à battre/)
    // Hip thrust : cible 100 kg × 12 contre 100 kg × 10, 1RM 140 contre 133,33 : record à battre
    expect(exos[1]).toMatch(/Hip thrust.*Dernière fois : 100 kg × 10.*Record à battre/)
  })

  it('séance jamais jouée : pas de « dernière fois » ; séance sans exercice : pas d’échauffement', async () => {
    await modele(base, 'vide', 'Vide')
    await modele(base, 'neuve', 'Neuve')
    await exercice(base, 'dips', 'Dips', ['TRICEPS'])
    await exoModele(base, 'n1', 'neuve', 'dips', { charge_cible: '20', reps_cibles: '10' })
    monterDetail('neuve')
    const compo = await screen.findByRole('region', { name: 'Composition' })
    expect(texte(compo)).toContain('Dips')
    expect(texte(compo)).not.toContain('Dernière fois')
    cleanup()
    monterDetail('vide')
    await screen.findByRole('heading', { name: 'Vide' })
    expect(screen.queryByRole('region', { name: 'Échauffement conseillé' })).toBeNull()
  })
})

describe('infoExercice', () => {
  const p = (maxChargeKg: number, reps: number, rmEstimeKg: number, enSecondes = false): PointHistorique => ({ dateIso: '2026-11-01', maxChargeKg, reps, enSecondes, volumeKg: 0, rmEstimeKg })
  it('record à battre prioritaire, puis charge en hausse, puis répétitions en plus', () => {
    expect(infoExercice([p(100, 5, 116.67)], 105, 6)).toEqual({ derniere: '100 kg × 5', etiquette: { texte: 'Record à battre', record: true } })
    expect(infoExercice([p(100, 8, 150)], 102.5, 6)).toEqual({ derniere: '100 kg × 8', etiquette: { texte: 'Charge +2,5 kg', record: false } })
    expect(infoExercice([p(100, 8, 150)], 100, 9).etiquette).toEqual({ texte: 'Une rep de plus', record: false })
    expect(infoExercice([p(100, 8, 150)], 100, 11).etiquette).toEqual({ texte: '+3 reps', record: false })
    expect(infoExercice([p(100, 8, 150)], 100, 8).etiquette).toBeNull()
    expect(infoExercice([p(100, 8, 150)], 90, 8).etiquette).toBeNull()
  })
  it('sans historique chargé, sans cible ou pour une durée : pas d’indication inventée', () => {
    expect(infoExercice([], 100, 8)).toEqual({ derniere: null, etiquette: null })
    expect(infoExercice([p(0, 12, 0)], 100, 8)).toEqual({ derniere: null, etiquette: null })
    expect(infoExercice([p(10, 60, 0, true)], 10, 60).derniere).toBeNull()
    expect(infoExercice([p(100, 8, 126.67)], null, null)).toEqual({ derniere: '100 kg × 8', etiquette: null })
  })
})

describe('Bilan de séance : écarts, records et retour au calme', () => {
  const monterBilan = (instanceId: string) =>
    render(
      <MemoryRouter initialEntries={['/bilan']}>
        <Routes>
          <Route path="/bilan" element={<BilanPlus instanceId={instanceId} />} />
          <Route path="/breathing/session/:id/:cycles" element={<p>Séance de respiration</p>} />
        </Routes>
      </MemoryRouter>,
    )

  it('écarts avec la séance précédente du même modèle', async () => {
    monterBilan('i-push2')
    const section = await screen.findByRole('region', { name: 'Par rapport à la dernière fois' })
    expect(texte(section)).toContain('4 800 kg')
    expect(texte(section)).toContain('↑ +140 % par rapport à la séance précédente')
    expect(texte(section)).toContain('↑ +5 par rapport à la séance précédente') // 10 séries contre 5
    expect(texte(section)).toContain('Séance précédente du même modèle : 28 oct. 2026.')
  })

  it('record de la séance : 1RM supérieur à tous les précédents (premier du modèle ou égalité : rien)', async () => {
    await joue(base, 'i-jambes2', 'jambes', '2026-11-13')
    await series(base, 'i-jambes2', 'sq', 2, 5, 105) // 1RM 122,5 contre 116,67
    monterBilan('i-jambes2')
    const records = await screen.findByRole('region', { name: 'Records de la séance' })
    expect(texte(records)).toMatch(/Squat.*105 kg × 5.*ancien record 116,7 kg.*122,5 kg.*\+5,8 kg/)
    cleanup()
    // Push du 12 nov. : 60 kg × 8 (1RM 76) contre 50 kg × 8 (63,33) le 28 oct. : record aussi
    monterBilan('i-push2')
    const push = await screen.findByRole('region', { name: 'Records de la séance' })
    expect(texte(push)).toMatch(/Développé couché.*ancien record 63,3 kg.*76 kg/)
    cleanup()
    // Première séance du modèle : rien à battre, donc aucun record
    monterBilan('i-pull1')
    await screen.findByRole('region', { name: 'Retour au calme' })
    expect(screen.queryByRole('region', { name: 'Records de la séance' })).toBeNull()
  })

  it('première séance du modèle : pas de comparaison ; retour au calme vers la respiration de 5 minutes', async () => {
    monterBilan('i-pull1')
    expect(await screen.findByRole('region', { name: 'Retour au calme' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Par rapport à la dernière fois' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Respirer 5 min' }))
    expect(await screen.findByText('Séance de respiration')).toBeTruthy()
  })
})
