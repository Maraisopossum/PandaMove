// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enregistrerSeanceMobilite } from '../../core/db/repos/mobilite'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'

const base = createTestDb()
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))
vi.mock('../../core/images/usePandaVariante', () => ({ useImagePanda: () => null, usePandaVariante: () => 'male' }))

import { ecrireObjectif, lireObjectif } from '../endurance/objectif'
import { ecrireObjectifQuotidien, ecrireFavorite, lireFavorite, lireObjectifQuotidien } from '../respiration/reglages'
import { ecrireExerciceDefaut, lireExerciceDefaut } from '../stats/exerciceDefaut'
import { ObjectifsSection } from './ObjectifsSection'
import { CLE_OBJECTIFS, ecrireObjectifsPerso, lireObjectifsPerso, lireProgressionObjectifs } from './objectifs'
import { ajouterPesee, bilanPoids, CLE_POIDS, definirObjectifPoids, lireSuiviPoids, retirerPesee } from './poids'
import { PoidsSection } from './PoidsSection'
import { lireLignesReglages, reinitialiserReglages } from './reglagesAppareil'
import { ReglagesAppareilSection } from './ReglagesAppareilSection'

const texte = (el: Element) => (el.textContent ?? '').replace(/\s/g, ' ')
const b = { user_id: 'u1', updated_at: 'u0', deleted_at: null }
const MAINT = new Date(2026, 10, 12, 10, 0) // jeudi 12 novembre 2026

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(MAINT)
  localStorage.clear()
  for (const t of ['sorties', 'instances_seance', 'seances', 'seances_mobilite', 'seances_respiration', 'exercises']) await base.execute(`DELETE FROM ${t}`)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const monter = (el: React.ReactElement) => render(<MemoryRouter>{el}</MemoryRouter>)

async function sortie(id: string, sport: 'course' | 'velo', date: string, km: number) {
  await inserer(base, 'sorties', { ...b, id, sport, date, titre: 'Sortie', duree_s: km * 300, distance_m: km * 1000, created_at: 'c', source: 'manuel', en_salle: 0 })
}
async function renfoTermine(id: string, date: string) {
  await inserer(base, 'seances', { ...b, id: `m-${id}`, nom: 'Pull', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
  await inserer(base, 'instances_seance', { ...b, id, seance_id: `m-${id}`, date, is_completed: 1, duration_seconds: 3000 })
}

describe('objectifs personnels (stockage)', () => {
  it('écrit, relit, retire ; refuse hors limites ; ignore un stockage corrompu', () => {
    expect(lireObjectifsPerso()).toEqual({ seancesSemaine: null, distanceAnnee: null, mobiliteSemaine: null })
    expect(ecrireObjectifsPerso({ seancesSemaine: 4, distanceAnnee: 3000, mobiliteSemaine: 3 })).toBe(true)
    expect(lireObjectifsPerso()).toEqual({ seancesSemaine: 4, distanceAnnee: 3000, mobiliteSemaine: 3 })
    expect(ecrireObjectifsPerso({ seancesSemaine: 0, distanceAnnee: null, mobiliteSemaine: null })).toBe(false)
    expect(ecrireObjectifsPerso({ seancesSemaine: null, distanceAnnee: 5, mobiliteSemaine: null })).toBe(false)
    expect(lireObjectifsPerso().seancesSemaine).toBe(4)
    expect(ecrireObjectifsPerso({ seancesSemaine: null, distanceAnnee: null, mobiliteSemaine: null })).toBe(true)
    expect(lireObjectifsPerso().seancesSemaine).toBeNull()
    localStorage.setItem(CLE_OBJECTIFS, JSON.stringify({ seancesSemaine: 'x', distanceAnnee: 2.5, mobiliteSemaine: 99 }))
    expect(lireObjectifsPerso()).toEqual({ seancesSemaine: null, distanceAnnee: null, mobiliteSemaine: null })
    localStorage.setItem(CLE_OBJECTIFS, 'pas du json')
    expect(lireObjectifsPerso().distanceAnnee).toBeNull()
  })
})

describe('progression des objectifs', () => {
  it('séances, course, distance de l’année, mobilité et respiration, d’après les données locales', async () => {
    await renfoTermine('i1', '2026-11-09')
    await renfoTermine('i2', '2026-11-11')
    await renfoTermine('i3', '2026-11-02') // semaine précédente : ne compte pas
    await sortie('c1', 'course', '2026-11-10', 12)
    await sortie('c2', 'course', '2026-02-01', 100) // cette année, pas cette semaine
    await sortie('v1', 'velo', '2025-12-31', 500) // année précédente
    await enregistrerSeanceMobilite(base, { date: '2026-11-10', dureeS: 600, exercices: 8, zones: [], sport: null })
    await inserer(base, 'seances_respiration', { ...b, id: 'r1', methode_id: 'coherence_cardiaque', methode_nom: 'Cohérence', cycles: 30, duree_sec: 300, date: '2026-11-11', created_at: '2026-11-11T08:00:00Z' })
    ecrireObjectif('course', 35)
    const p = await lireProgressionObjectifs(base, MAINT, { seancesSemaine: 4, distanceAnnee: 3000, mobiliteSemaine: 3 })
    const par = Object.fromEntries(p.map((o) => [o.id, o]))
    expect(p.map((o) => o.id)).toEqual(['seances', 'course', 'distance-annee', 'mobilite', 'respiration'])
    expect(par['seances']).toMatchObject({ valeur: '2 sur 4', pct: 50, atteint: false, detail: 'Il reste 2 séances d’ici dimanche.' })
    expect(par['course']).toMatchObject({ valeur: '12 sur 35 km', pct: 34 })
    expect(par['course'].detail).toBe('Encore 23 km, il reste 3 jours.')
    expect(texte({ textContent: par['distance-annee'].valeur } as Element)).toBe('112 sur 3 000 km')
    expect(par['distance-annee'].detail).toMatch(/^Au rythme actuel : \d+ km au 31 décembre\.$/)
    expect(par['mobilite']).toMatchObject({ valeur: '1 sur 3 séances', pct: 33 })
    expect(par['respiration']).toMatchObject({ valeur: '1 sur 7 jours', detail: 'Objectif quotidien : 5 min.' })
  })

  it('objectif atteint : barre pleine et message ; aucun objectif ni donnée : rien', async () => {
    await renfoTermine('i1', '2026-11-09')
    const p = await lireProgressionObjectifs(base, MAINT, { seancesSemaine: 1, distanceAnnee: null, mobiliteSemaine: null })
    expect(p).toHaveLength(1)
    expect(p[0]).toMatchObject({ pct: 100, atteint: true, detail: 'Objectif atteint cette semaine.' })
    await base.execute('DELETE FROM instances_seance')
    expect(await lireProgressionObjectifs(base, MAINT, { seancesSemaine: null, distanceAnnee: null, mobiliteSemaine: null })).toEqual([])
  })
})

describe('Mes objectifs (écran)', () => {
  it('sans objectif : invitation à en définir ; formulaire validé ; enregistrement et avancement affichés', async () => {
    await renfoTermine('i1', '2026-11-10')
    monter(<ObjectifsSection db={base} maintenant={() => MAINT} />)
    const carte = await screen.findByRole('region', { name: 'Mes objectifs' })
    await waitFor(() => expect(texte(carte)).toContain('Aucun objectif pour l’instant'))
    fireEvent.click(within(carte).getByRole('button', { name: 'Définir' }))
    const seances = within(carte).getByLabelText('Séances par semaine')
    fireEvent.change(seances, { target: { value: '99' } })
    expect(within(carte).getAllByRole('alert')[0].textContent).toContain('Entre 1 et 14')
    expect((within(carte).getByRole('button', { name: 'Enregistrer' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(seances, { target: { value: '2,5' } })
    expect(within(carte).getAllByRole('alert')[0].textContent).toContain('nombre entier')
    fireEvent.change(seances, { target: { value: '3' } })
    fireEvent.change(within(carte).getByLabelText('Course par semaine (km)'), { target: { value: '35' } })
    fireEvent.change(within(carte).getByLabelText('Respiration par jour (min)'), { target: { value: '8' } })
    fireEvent.click(within(carte).getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(within(carte).getByRole('progressbar', { name: 'Séances par semaine' })).toBeTruthy())
    expect(lireObjectifsPerso().seancesSemaine).toBe(3)
    expect(lireObjectif('course')).toBe(35)
    expect(lireObjectifQuotidien()).toBe(8)
    expect(texte(carte)).toContain('1 sur 3')
    expect(within(carte).getByRole('progressbar', { name: 'Séances par semaine' }).getAttribute('aria-valuenow')).toBe('33')
    expect(within(carte).getByRole('button', { name: 'Modifier' })).toBeTruthy()
  })

  it('vider un champ retire l’objectif ; annuler ne change rien', async () => {
    ecrireObjectifsPerso({ seancesSemaine: 4, distanceAnnee: null, mobiliteSemaine: null })
    monter(<ObjectifsSection db={base} maintenant={() => MAINT} />)
    const carte = await screen.findByRole('region', { name: 'Mes objectifs' })
    await within(carte).findByRole('progressbar', { name: 'Séances par semaine' })
    fireEvent.click(within(carte).getByRole('button', { name: 'Modifier' }))
    fireEvent.change(within(carte).getByLabelText('Séances par semaine'), { target: { value: '9' } })
    fireEvent.click(within(carte).getByRole('button', { name: 'Annuler' }))
    expect(lireObjectifsPerso().seancesSemaine).toBe(4)
    fireEvent.click(within(carte).getByRole('button', { name: 'Modifier' }))
    fireEvent.change(within(carte).getByLabelText('Séances par semaine'), { target: { value: '' } })
    fireEvent.click(within(carte).getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(lireObjectifsPerso().seancesSemaine).toBeNull())
  })
})

describe('suivi du poids', () => {
  it('ajoute (une pesée par jour), trie, refuse hors de 20 à 300 kg, retire, objectif', () => {
    let s = lireSuiviPoids()
    expect(s).toEqual({ objectifKg: null, pesees: [] })
    s = ajouterPesee(s, '2026-11-12', 80.44)!
    s = ajouterPesee(s, '2026-10-12', 81.6)!
    s = ajouterPesee(s, '2026-11-12', 80.4)! // même jour : remplacée
    expect(s.pesees).toEqual([{ date: '2026-10-12', kg: 81.6 }, { date: '2026-11-12', kg: 80.4 }])
    expect(ajouterPesee(s, '2026-11-13', 10)).toBeNull()
    expect(ajouterPesee(s, '2026-11-13', 400)).toBeNull()
    expect(ajouterPesee(s, 'demain', 80)).toBeNull()
    expect(definirObjectifPoids(s, 78)!.objectifKg).toBe(78)
    expect(definirObjectifPoids(s, 5)).toBeNull()
    expect(retirerPesee(s, '2026-10-12').pesees).toHaveLength(1)
    expect(lireSuiviPoids().pesees).toHaveLength(1)
  })

  it('bilan : dernière pesée, écart sur 30 jours (≥ 7 jours d’écart), pesées récentes ; stockage corrompu ignoré', () => {
    const s = { objectifKg: null, pesees: [{ date: '2026-09-01', kg: 90 }, { date: '2026-10-13', kg: 81.6 }, { date: '2026-11-08', kg: 80.8 }, { date: '2026-11-12', kg: 80.4 }] }
    const b = bilanPoids(s, '2026-11-12')
    expect(b.derniere).toEqual({ date: '2026-11-12', kg: 80.4 })
    expect(b.ecart30j).toBe(-1.2) // comparée au 13 octobre (30 jours avant), pas au 8 novembre
    expect(b.recentes.map((p) => p.date)).toEqual(['2026-09-30'].filter(() => false).concat(['2026-10-13', '2026-11-08', '2026-11-12']))
    expect(bilanPoids({ objectifKg: null, pesees: [{ date: '2026-11-12', kg: 80 }] }, '2026-11-12').ecart30j).toBeNull()
    localStorage.setItem(CLE_POIDS, JSON.stringify({ objectifKg: 'x', pesees: [{ date: 'n', kg: 80 }, null, { date: '2026-11-01', kg: 70 }] }))
    expect(lireSuiviPoids()).toEqual({ objectifKg: null, pesees: [{ date: '2026-11-01', kg: 70 }] })
    localStorage.setItem(CLE_POIDS, 'pas du json')
    expect(lireSuiviPoids().pesees).toEqual([])
  })

  it('écran : ajout d’une pesée, écart, objectif, suppression ; saisie invalide refusée', async () => {
    localStorage.setItem(CLE_POIDS, JSON.stringify({ objectifKg: null, pesees: [{ date: '2026-10-12', kg: 81.6 }] }))
    monter(<PoidsSection maintenant={() => MAINT} />)
    const carte = screen.getByRole('region', { name: 'Poids' })
    expect(texte(carte)).toContain('81,6 kg')
    fireEvent.click(within(carte).getByRole('button', { name: '+ Ajouter une pesée' }))
    const champ = within(carte).getByLabelText('Poids (kg)')
    fireEvent.change(champ, { target: { value: '12' } })
    expect(within(carte).getByRole('alert').textContent).toContain('Entre 20 et 300 kg')
    expect((within(carte).getByRole('button', { name: 'Enregistrer la pesée' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(champ, { target: { value: '80,4' } })
    fireEvent.click(within(carte).getByRole('button', { name: 'Enregistrer la pesée' }))
    expect(texte(carte)).toContain('80,4 kg')
    expect(texte(carte)).toContain('↓ −1,2 kg en 30 jours')
    expect(lireSuiviPoids().pesees.map((p) => p.kg)).toEqual([81.6, 80.4])

    fireEvent.click(within(carte).getByRole('button', { name: 'Définir un objectif' }))
    fireEvent.change(within(carte).getByLabelText('Objectif de poids (kg)'), { target: { value: '78' } })
    fireEvent.click(within(carte).getByRole('button', { name: 'Enregistrer' }))
    expect(lireSuiviPoids().objectifKg).toBe(78)
    expect(within(carte).getByRole('img', { name: /objectif 78,0 kg/ })).toBeTruthy()

    fireEvent.click(within(carte).getByText(/Mes pesées/))
    fireEvent.click(within(carte).getByRole('button', { name: /Supprimer la pesée du 12 nov/ }))
    expect(lireSuiviPoids().pesees.map((p) => p.kg)).toEqual([81.6])
    expect(texte(carte)).toContain('reste sur cet appareil')
  })
})

describe('réglages de cet appareil', () => {
  it('valeurs lues, noms résolus en base, remise à zéro après confirmation, sans toucher aux objectifs', async () => {
    await inserer(base, 'exercises', { ...b, id: 'sq', name: 'Squat', category: 'OTHER', muscle_groups: '[]', description: '', is_favorite: 0, is_custom: 0, image_url: null, exercise_type: '', equipment: '[]', muscle_primary: '', is_bodyweight: 0 })
    ecrireExerciceDefaut('sq')
    ecrireFavorite('wim_hof')
    localStorage.setItem('pandamove.charge.reglages', JSON.stringify({ ftpW: 265, fcMax: 188 }))
    localStorage.setItem('pandamove.stats.periode', '3m')
    localStorage.setItem('pandamove.mobilite.choix', JSON.stringify({ minutes: 15 }))
    ecrireObjectifsPerso({ seancesSemaine: 4, distanceAnnee: null, mobiliteSemaine: null })
    monter(<ReglagesAppareilSection db={base} />)
    const carte = screen.getByRole('region', { name: 'Réglages de cet appareil' })
    await waitFor(() => expect(texte(carte)).toContain('Squat'))
    expect(texte(carte)).toContain('Wim Hof')
    expect(texte(carte)).toContain('265 W · 188 bpm')
    expect(texte(carte)).toContain('3 mois')
    expect(texte(carte)).toContain('15 min')
    expect(texte(carte)).toContain('Désactivés')
    expect(within(carte).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/stats', '/breathing', '/stats', '/outils/rappels', '/stats', '/mobility'])

    fireEvent.click(within(carte).getByRole('button', { name: 'Rétablir les réglages par défaut' }))
    expect(screen.getByRole('dialog', { name: 'Rétablir les réglages par défaut ?' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(lireExerciceDefaut()).toBe('sq') // rien n'a changé
    fireEvent.click(within(carte).getByRole('button', { name: 'Rétablir les réglages par défaut' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rétablir' }))
    await waitFor(() => expect(texte(carte)).toContain('5 réglages rétablis.'))
    expect(lireExerciceDefaut()).toBeNull()
    expect(lireFavorite()).toBeNull()
    expect(localStorage.getItem('pandamove.charge.reglages')).toBeNull()
    expect(texte(carte)).toContain('Estimées')
    expect(lireObjectifsPerso().seancesSemaine).toBe(4)
  })

  it('réglage pointant vers un élément supprimé : affiché comme absent ; rien à rétablir : message', async () => {
    ecrireExerciceDefaut('disparu')
    ecrireFavorite('disparue')
    expect(lireLignesReglages({ exercice: null, methode: null }).slice(0, 2).map((l) => l.valeur)).toEqual(['Aucun', 'Aucune'])
    expect(reinitialiserReglages()).toBe(2)
    expect(reinitialiserReglages()).toBe(0)
    ecrireObjectifQuotidien(5)
  })
})
