// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'

const base = createTestDb()
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))
vi.mock('../../core/images/usePandaVariante', () => ({ useImagePanda: () => null, usePandaVariante: () => 'male' }))

import RespirationScreen from './RespirationScreen'
import StatsRespirationScreen from './StatsRespirationScreen'
import { CLE_FAVORITE, CLE_OBJECTIF_QUOTIDIEN, ecrireFavorite, ecrireObjectifQuotidien, lireFavorite, lireObjectifQuotidien } from './reglages'

const texte = (el: Element) => (el.textContent ?? '').replace(/\s/g, ' ')

// Jeudi 12 novembre 2026, 18 h : seule l'horloge est simulée, les minuteries réelles servent à findBy / waitFor
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 12, 18, 0))
  localStorage.clear()
  await base.execute('DELETE FROM seances_respiration')
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const instant = (jour: string, heure: number) => {
  const [a, m, j] = jour.split('-').map(Number)
  return new Date(a, m - 1, j, heure, 0).toISOString()
}
let compteur = 0
async function seance(date: string, dureeSec: number, methodeId = 'coherence_cardiaque', methodeNom = 'Cohérence cardiaque', heure = 8) {
  const cree = instant(date, heure)
  await inserer(base, 'seances_respiration', {
    id: `s${++compteur}`, user_id: 'u1', updated_at: cree, deleted_at: null, methode_id: methodeId, methode_nom: methodeNom,
    cycles: Math.round(dureeSec / 10), duree_sec: dureeSec, date, created_at: cree,
  })
}

const monter = (chemin = '/breathing') =>
  render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route path="/breathing" element={<RespirationScreen />} />
        <Route path="/breathing/stats" element={<StatsRespirationScreen />} />
        <Route path="/breathing/session/:id/:cycles" element={<p>Séance</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('réglages de la respiration', () => {
  it('objectif quotidien : défaut 5, écrit, refusé hors de 1 à 60, stockage corrompu ignoré', () => {
    expect(lireObjectifQuotidien()).toBe(5)
    expect(ecrireObjectifQuotidien(12)).toBe(true)
    expect(lireObjectifQuotidien()).toBe(12)
    expect(ecrireObjectifQuotidien(0)).toBe(false)
    expect(ecrireObjectifQuotidien(61)).toBe(false)
    expect(ecrireObjectifQuotidien(2.5)).toBe(false)
    expect(lireObjectifQuotidien()).toBe(12)
    localStorage.setItem(CLE_OBJECTIF_QUOTIDIEN, 'abc')
    expect(lireObjectifQuotidien()).toBe(5)
  })

  it('méthode favorite : écrite, relue, retirée', () => {
    expect(lireFavorite()).toBeNull()
    ecrireFavorite('4_7_8')
    expect(localStorage.getItem(CLE_FAVORITE)).toBe('4_7_8')
    expect(lireFavorite()).toBe('4_7_8')
    ecrireFavorite(null)
    expect(lireFavorite()).toBeNull()
  })
})

describe('écran Respiration : régularité', () => {
  it('pas de carte tant qu’aucune séance n’existe', async () => {
    monter()
    await screen.findByRole('heading', { name: 'Choisissez une méthode' })
    expect(screen.queryByRole('region', { name: 'Cette semaine' })).toBeNull()
  })

  it('jours de suite, minutes et séances avec écart, jours de la semaine par rapport à l’objectif', async () => {
    await seance('2026-11-12', 300) // jeudi, aujourd'hui
    await seance('2026-11-11', 300)
    await seance('2026-11-10', 180)
    await seance('2026-11-09', 300)
    await seance('2026-11-05', 300) // semaine précédente, même point
    monter()
    const carte = await screen.findByRole('region', { name: 'Cette semaine' })
    expect(texte(carte)).toContain('4 jde suite')
    expect(texte(carte)).toContain('18 min') // 300 + 300 + 180 + 300 = 1 080 s
    expect(texte(carte)).toContain('↑ +13 min par rapport à la semaine passée')
    expect(texte(carte)).toContain('4séances')
    expect(texte(carte)).toContain('↑ +3 par rapport à la semaine passée')
    expect(texte(carte)).toContain('Objectif quotidien : 5 min')
    expect(texte(carte)).toContain('atteint 3 jours cette semaine')
    const jours = within(within(carte).getByRole('list', { name: 'Jours de la semaine' })).getAllByRole('listitem').map((l) => texte(l))
    expect(jours[0]).toContain('lundi : objectif atteint, 5 min')
    expect(jours[1]).toContain('mardi : objectif non atteint, 3 min')
    expect(jours[3]).toContain('jeudi : objectif atteint, 5 min')
    expect(jours[4]).toContain('vendredi : à venir')
    expect(within(carte).getByRole('link', { name: 'Statistiques' }).getAttribute('href')).toBe('/breathing/stats')
  })

  it('objectif quotidien : modifiable, validé, retenu sur l’appareil, recalcule les jours atteints', async () => {
    await seance('2026-11-12', 300)
    await seance('2026-11-11', 300)
    monter()
    const carte = await screen.findByRole('region', { name: 'Cette semaine' })
    fireEvent.click(within(carte).getByRole('button', { name: 'Modifier' }))
    const champ = within(carte).getByRole('textbox', { name: 'Minutes par jour' })
    fireEvent.change(champ, { target: { value: '90' } })
    expect(within(carte).getByRole('alert').textContent).toContain('Entre 1 et 60 minutes')
    expect((within(carte).getByRole('button', { name: 'Enregistrer' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(champ, { target: { value: '10' } })
    fireEvent.click(within(carte).getByRole('button', { name: 'Enregistrer' }))
    expect(lireObjectifQuotidien()).toBe(10)
    expect(texte(carte)).toContain('Objectif quotidien : 10 min')
    expect(texte(carte)).toContain('atteint 0 jour cette semaine')
  })
})

describe('écran Respiration : méthode favorite et usage', () => {
  const noms = () => within(screen.getByRole('list', { name: 'Méthodes de respiration' })).getAllByRole('listitem').map((l) => l.querySelector('.respiration__nom')?.textContent)

  it('sans favorite, l’ordre habituel ; avec, la favorite passe en premier avec son badge ; retirable', async () => {
    monter()
    await screen.findByRole('list', { name: 'Méthodes de respiration' })
    expect(noms()[0]).toBe('Cohérence cardiaque')
    fireEvent.click(screen.getByRole('button', { name: 'Mettre Wim Hof en favori' }))
    expect(lireFavorite()).toBe('wim_hof')
    expect(noms()[0]).toBe('Wim HofFavorite')
    expect(screen.getByRole('button', { name: 'Retirer Wim Hof des favoris' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Retirer Wim Hof des favoris' }))
    expect(lireFavorite()).toBeNull()
    expect(noms()[0]).toBe('Cohérence cardiaque')
  })

  it('une favorite disparue (méthode supprimée) : ordre habituel', async () => {
    ecrireFavorite('methode-supprimee')
    monter()
    await screen.findByRole('list', { name: 'Méthodes de respiration' })
    expect(noms()[0]).toBe('Cohérence cardiaque')
  })

  it('usage sur 30 jours par méthode, « Votre préférée » à trois séances ou plus', async () => {
    for (const j of ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11']) await seance(j, 300)
    await seance('2026-11-05', 300, '4_7_8', '4-7-8')
    await seance('2026-09-01', 300, '4_7_8', '4-7-8') // hors des 30 jours
    monter()
    await screen.findByRole('region', { name: 'Cette semaine' })
    const liste = screen.getByRole('list', { name: 'Méthodes de respiration' })
    const carte = (nom: string) => Array.from(liste.querySelectorAll(':scope > li')).find((l) => l.querySelector('.respiration__nom')?.textContent?.startsWith(nom))!
    expect(texte(carte('Cohérence cardiaque'))).toContain('Votre préférée : 4 séances en 30 jours')
    expect(texte(carte('4-7-8'))).toContain('1 séance en 30 jours')
    expect(texte(carte('Wim Hof'))).toContain('Aucune séance en 30 jours')
  })
})

describe('Statistiques de la respiration', () => {
  it('résumé du mois, écart à la période précédente, moyenne, série et jours', async () => {
    await seance('2026-11-10', 300, 'coherence_cardiaque', 'Cohérence cardiaque', 8)
    await seance('2026-11-11', 600, 'coherence_cardiaque', 'Cohérence cardiaque', 12)
    await seance('2026-11-12', 240, '4_7_8', '4-7-8', 22)
    await seance('2026-10-01', 300, 'coherence_cardiaque', 'Cohérence cardiaque', 19) // période précédente (11 sept. au 11 oct.)
    monter('/breathing/stats')
    const resume = await screen.findByRole('region', { name: 'Résumé' })
    expect(texte(resume)).toContain('19 min')
    expect(texte(resume)).toContain('3 séances')
    expect(texte(resume)).toContain('↑ +14 min par rapport à la période précédente')
    expect(texte(resume)).toContain('6,3 min') // 1 140 s / 3 séances = 380 s
    expect(texte(resume)).toContain('3 jplus longue série')
    expect(texte(resume)).toContain('3 jjours avec séance')
    expect(screen.getByRole('button', { name: '1 mois' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('minutes par semaine avec l’objectif hebdomadaire (objectif quotidien × 7)', async () => {
    ecrireObjectifQuotidien(5)
    await seance('2026-10-20', 600)
    await seance('2026-11-10', 300)
    await seance('2026-11-11', 300)
    monter('/breathing/stats')
    const graphique = await screen.findByRole('img', { name: /Minutes de respiration par semaine/ })
    expect(graphique.getAttribute('aria-label')).toBe('Minutes de respiration par semaine : 10, 0, 0, 10 en cours, avec un objectif de 35 minutes')
  })

  it('méthodes pratiquées, du plus de minutes au moins, et moments de la journée', async () => {
    await seance('2026-11-10', 300, 'coherence_cardiaque', 'Cohérence cardiaque', 8)
    await seance('2026-11-11', 600, 'coherence_cardiaque', 'Cohérence cardiaque', 12)
    await seance('2026-11-12', 240, '4_7_8', '4-7-8', 22)
    monter('/breathing/stats')
    const methodes = await screen.findByRole('region', { name: 'Méthodes pratiquées' })
    const lignes = within(methodes).getAllByRole('listitem').map((l) => texte(l))
    expect(lignes[0]).toMatch(/Cohérence cardiaque.*2 séances · 15 min/)
    expect(lignes[1]).toMatch(/4-7-8.*1 séance · 4 min/)
    const moments = within(screen.getByRole('region', { name: 'Moments habituels' })).getAllByRole('listitem').map((l) => texte(l))
    expect(moments).toEqual(['1Matin', '1Midi', '0Soir', '1Nuit'])
  })

  it('changer de période recharge les chiffres ; « Tout » sans écart ; période vide : message', async () => {
    await seance('2026-11-11', 300)
    await seance('2026-08-01', 600)
    monter('/breathing/stats')
    const resume = await screen.findByRole('region', { name: 'Résumé' })
    expect(texte(resume)).toContain('1 séance')
    fireEvent.click(screen.getByRole('button', { name: 'Tout' }))
    await waitFor(() => expect(texte(screen.getByRole('region', { name: 'Résumé' }))).toContain('2 séances'))
    expect(texte(screen.getByRole('region', { name: 'Résumé' }))).not.toContain('par rapport à la période précédente')
    fireEvent.click(screen.getByRole('button', { name: '7 jours' }))
    await waitFor(() => expect(texte(screen.getByRole('region', { name: 'Résumé' }))).toContain('1 séance'))
    await base.execute('DELETE FROM seances_respiration')
  })

  it('sans séance : message simple', async () => {
    monter('/breathing/stats')
    expect(await screen.findByText('Aucune séance de respiration sur cette période.')).toBeTruthy()
  })
})
