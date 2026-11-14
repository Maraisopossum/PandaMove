// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'

const base = createTestDb()
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))
vi.mock('../../core/images/usePandaVariante', () => ({ useImagePanda: () => null, usePandaVariante: () => 'male' }))

import { ecrireObjectif } from '../endurance/objectif'
import { lirePlan } from '../mobilite/stockage'
import { ecrireObjectifsPerso } from '../profile/objectifs'
import { ecrireObjectifQuotidien } from '../respiration/reglages'
import HomeScreen from './HomeScreen'
import { lirePropositions } from './propositionsDuJour'

const texte = (el: Element) => (el.textContent ?? '').replace(/\s/g, ' ')
const b = { user_id: 'u1', updated_at: 'u0', deleted_at: null }
const MAINT = new Date(2026, 10, 14, 10, 0) // samedi 14 novembre 2026
let nSerie = 0

async function vider(db: Db) {
  for (const t of ['series_realisees', 'exercices_seance', 'instances_seance', 'seances', 'exercises', 'sorties', 'seances_respiration', 'seances_mobilite']) await db.execute(`DELETE FROM ${t}`)
}
const exercice = (id: string, name: string, groupes: string[]) =>
  inserer(base, 'exercises', { ...b, id, name, category: 'OTHER', muscle_groups: JSON.stringify(groupes), description: '', is_favorite: 0, is_custom: 0, image_url: null, exercise_type: '', equipment: '[]', muscle_primary: '', is_bodyweight: 0 })
async function renfoAvecHistorique() {
  await exercice('dc', 'Développé', ['PECTORAUX'])
  await exercice('tr', 'Tractions', ['DOS'])
  await exercice('sq', 'Squat', ['QUADRICEPS'])
  for (const [id, nom] of [['push', 'Push'], ['jambes', 'Jambes']]) await inserer(base, 'seances', { ...b, id, nom, groupes_musculaires: '[]', duree_estimee_min: 45, notes: '', seance_category: 'STRENGTH', created_at: 'c', is_archived: 0 })
  await inserer(base, 'exercices_seance', { ...b, id: 'm1', seance_id: 'push', instance_seance_id: null, exercise_id: 'dc', position: 0, nombre_series_prevues: 4, reps_cibles: '8' })
  await inserer(base, 'exercices_seance', { ...b, id: 'm2', seance_id: 'jambes', instance_seance_id: null, exercise_id: 'sq', position: 0, nombre_series_prevues: 4, reps_cibles: '8' })
  await inserer(base, 'instances_seance', { ...b, id: 'i1', seance_id: 'push', date: '2026-11-12', is_completed: 1, duration_seconds: 3000, created_at: 'c' })
  await inserer(base, 'exercices_seance', { ...b, id: 'e1', seance_id: 'push', instance_seance_id: 'i1', exercise_id: 'dc', position: 0, reps_type: 'REPS' })
  for (let i = 0; i < 10; i++) {
    nSerie++
    await inserer(base, 'series_realisees', { ...b, id: `sr-${nSerie}`, instance_seance_id: 'i1', exercice_seance_id: 'e1', numero_serie: i + 1, reps_realisees: 8, charge_kg: 60, is_completed: 1, notes: '' })
  }
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(MAINT)
  localStorage.clear()
  sessionStorage.clear()
  await vider(base)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const monter = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/strength/:id" element={<p>Détail séance</p>} />
        <Route path="/breathing" element={<p>Écran respiration</p>} />
        <Route path="/mobility/apercu" element={<p>Aperçu mobilité</p>} />
        <Route path="/profile" element={<p>Profil</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('propositions du jour', () => {
  it('renforcement : la séance qui travaille les muscles en retard, sauf si une séance est déjà prévue aujourd’hui', async () => {
    await renfoAvecHistorique()
    const p = await lirePropositions(base, MAINT)
    expect(p).toHaveLength(1)
    expect(p[0]).toMatchObject({ id: 'renforcement', titre: 'Jambes', action: { type: 'lien', vers: '/strength/jambes' } })
    expect(p[0].detail).toBe('Quadriceps est le moins travaillé de la quinzaine.')
    // Séance déjà prévue ce jour : la carte « Prochaine séance » s'en charge
    await inserer(base, 'instances_seance', { ...b, id: 'iplan', seance_id: 'push', date: '2026-11-14', is_completed: 0, created_at: 'c' })
    expect(await lirePropositions(base, MAINT)).toEqual([])
  })

  it('mobilité : routine après une grosse sortie d’hier ; respiration : minutes manquantes pour l’objectif du jour', async () => {
    await inserer(base, 'sorties', { ...b, id: 'v1', sport: 'velo', date: '2026-11-13', titre: 'Sortie', duree_s: 7200, distance_m: 60000, created_at: 'c', source: 'manuel', en_salle: 0 })
    await inserer(base, 'seances_respiration', { ...b, id: 'r1', methode_id: 'coherence_cardiaque', methode_nom: 'Cohérence', cycles: 18, duree_sec: 180, date: '2026-11-14', created_at: '2026-11-14T08:00:00Z' })
    const p = await lirePropositions(base, MAINT)
    expect(p.map((x) => x.id)).toEqual(['mobilite', 'respiration'])
    expect(p[0]).toMatchObject({ categorie: 'Mobilité · après le vélo d’hier', titre: 'Séance de 10 min', action: { type: 'mobilite' } })
    expect(p[0].detail).toContain('2 h')
    expect(p[1]).toMatchObject({ categorie: 'Respiration · 3 min aujourd’hui', titre: 'Cohérence cardiaque', detail: 'Il vous manque 2 min pour votre objectif du jour.' })
  })

  it('rien quand tout est fait ou sans données : objectif de respiration atteint, module jamais utilisé, séance de mobilité faite', async () => {
    expect(await lirePropositions(base, MAINT)).toEqual([])
    await inserer(base, 'seances_respiration', { ...b, id: 'r1', methode_id: 'x', methode_nom: 'X', cycles: 30, duree_sec: 300, date: '2026-11-14', created_at: '2026-11-14T08:00:00Z' })
    expect(await lirePropositions(base, MAINT)).toEqual([])
    ecrireObjectifQuotidien(10)
    expect((await lirePropositions(base, MAINT)).map((x) => x.id)).toEqual(['respiration'])
  })
})

describe('accueil : carte « Aujourd’hui » et objectifs', () => {
  it('affiche les propositions et les actions : lien vers la séance, respiration, lancement de la routine de mobilité', async () => {
    await renfoAvecHistorique()
    await inserer(base, 'sorties', { ...b, id: 'v1', sport: 'velo', date: '2026-11-13', titre: 'Sortie', duree_s: 7200, distance_m: 60000, created_at: 'c', source: 'manuel', en_salle: 0 })
    monter()
    const carte = await screen.findByRole('region', { name: 'Aujourd’hui' })
    await waitFor(() => expect(within(carte).getAllByRole('listitem')).toHaveLength(2))
    expect(texte(carte)).toContain('Renforcement · séance du jour')
    expect(texte(carte)).toContain('Mobilité · après le vélo d’hier')
    expect(texte(carte)).toContain('ne remplacent pas vos sensations')
    expect(within(carte).getByRole('link', { name: 'Voir : Jambes' }).getAttribute('href')).toBe('/strength/jambes')

    fireEvent.click(within(carte).getByRole('button', { name: /Lancer : Séance de 10 min/ }))
    expect(await screen.findByText('Aperçu mobilité')).toBeTruthy()
    const plan = lirePlan()!
    expect(plan.minutes).toBe(10)
    expect(plan.moment).toBe('apres')
  })

  it('sans proposition : la carte n’apparaît pas', async () => {
    monter()
    await screen.findByRole('navigation', { name: 'Accès rapides' })
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.queryByRole('region', { name: 'Aujourd’hui' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Objectifs de la semaine' })).toBeNull()
  })

  it('objectifs de la semaine : avancement des objectifs définis, sans celui de l’année ; lien vers le profil', async () => {
    ecrireObjectifsPerso({ seancesSemaine: 3, distanceAnnee: 3000, mobiliteSemaine: null })
    ecrireObjectif('course', 35)
    await inserer(base, 'sorties', { ...b, id: 'c1', sport: 'course', date: '2026-11-12', titre: 'Footing', duree_s: 3600, distance_m: 12000, created_at: 'c', source: 'manuel', en_salle: 0 })
    monter()
    const carte = await screen.findByRole('region', { name: 'Objectifs de la semaine' })
    await waitFor(() => expect(within(carte).getAllByRole('progressbar')).toHaveLength(2))
    const lignes = within(carte).getAllByRole('listitem').map((l) => texte(l))
    expect(lignes[0]).toContain('Séances par semaine')
    expect(lignes[0]).toContain('0 sur 3')
    expect(lignes[1]).toContain('Course, cette semaine')
    expect(lignes[1]).toContain('12 sur 35 km')
    expect(texte(carte)).not.toContain('Distance de l’année')
    expect(within(carte).getByRole('progressbar', { name: 'Course, cette semaine' }).getAttribute('aria-valuenow')).toBe('34')
    fireEvent.click(within(carte).getByRole('link', { name: 'Modifier' }))
    expect(await screen.findByText('Profil')).toBeTruthy()
  })
})
