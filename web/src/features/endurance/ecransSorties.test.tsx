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

import RecordsSortiesScreen from './RecordsSortiesScreen'
import SortieDetailScreen from './SortieDetailScreen'
import SortiesScreen from './SortiesScreen'
import { CLE_OBJECTIF, ecrireObjectif, lireObjectif } from './objectif'
import { CLE_REGLAGES_CHARGE } from './useChargeEntrainement'

const texte = (el: Element) => (el.textContent ?? '').replace(/\s/g, ' ')

// Jeudi 12 novembre 2026 : seule l'horloge est simulée, les minuteries réelles servent à findBy / waitFor
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 12, 9, 0))
  localStorage.clear()
  await base.execute('DELETE FROM sorties')
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const b = { user_id: 'u1', updated_at: 'u', deleted_at: null, created_at: 'c', source: 'manuel', en_salle: 0 }

interface Ech {
  t: number
  v?: number
  w?: number
  fc?: number
}
const serie = (duree: number, pas: number, f: (t: number) => Omit<Ech, 't'>) =>
  JSON.stringify(Array.from({ length: Math.floor(duree / pas) + 1 }, (_, i) => ({ t: i * pas, fc: null, w: null, v: null, a: null, c: null, ...f(i * pas) })))

async function course(id: string, date: string, secParKm: number, km: number, titre = 'Footing') {
  const duree = secParKm * km
  await inserer(base, 'sorties', { ...b, id, sport: 'course', date, titre, duree_s: duree, distance_m: km * 1000, serie: serie(duree, 10, () => ({ v: 1000 / secParKm })) })
}
async function velo(id: string, date: string, titre: string, minutes: number, watts: number, fc = 140, deniv = 400, kmh = 30) {
  const duree = minutes * 60
  await inserer(base, 'sorties', {
    ...b, id, sport: 'velo', date, titre, duree_s: duree, distance_m: Math.round((kmh / 3.6) * duree), denivele_pos_m: deniv, serie: serie(duree, 10, () => ({ w: watts, fc, v: kmh / 3.6 })),
  })
}

const monterListe = (sport: 'course' | 'velo') =>
  render(
    <MemoryRouter initialEntries={[sport === 'course' ? '/running' : '/cycling']}>
      <Routes>
        <Route path="/running" element={<SortiesScreen sport="course" />} />
        <Route path="/cycling" element={<SortiesScreen sport="velo" />} />
      </Routes>
    </MemoryRouter>,
  )

describe('objectif de la semaine (stockage)', () => {
  it('écrit, relit par sport, retire ; refuse hors de 1 à 2 000 km ; ignore un stockage corrompu', () => {
    expect(lireObjectif('course')).toBeNull()
    expect(ecrireObjectif('course', 35)).toBe(true)
    expect(ecrireObjectif('velo', 120.46)).toBe(true)
    expect(lireObjectif('course')).toBe(35)
    expect(lireObjectif('velo')).toBe(120.5)
    expect(ecrireObjectif('course', 0)).toBe(false)
    expect(ecrireObjectif('course', 5000)).toBe(false)
    expect(lireObjectif('course')).toBe(35)
    expect(ecrireObjectif('course', null)).toBe(true)
    expect(lireObjectif('course')).toBeNull()
    expect(lireObjectif('velo')).toBe(120.5)
    localStorage.setItem(CLE_OBJECTIF, JSON.stringify({ course: -4, velo: 'x' }))
    expect(lireObjectif('course')).toBeNull()
    localStorage.setItem(CLE_OBJECTIF, 'pas du json')
    expect(lireObjectif('velo')).toBeNull()
  })
})

describe('Course : liste, objectif, records et filtres', () => {
  beforeEach(async () => {
    await course('a', '2026-10-10', 330, 6, 'Footing d’octobre') // 5:30 /km
    await course('b', '2026-11-02', 320, 8, 'Footing') // semaine précédente
    await course('c', '2026-11-10', 300, 12, 'Sortie longue') // 5:00 /km, cette semaine : records
    await course('d', '2026-11-11', 340, 4, 'Récupération') // cette semaine
  })

  it('cette semaine : distance, écart à la semaine passée, durée et allure moyenne', async () => {
    monterListe('course')
    const carte = await screen.findByRole('region', { name: 'Cette semaine' })
    // 12 + 4 = 16 km sur 2 sorties ; la semaine précédente (2 au 5 nov.) : 8 km -> +8 km
    expect(texte(carte)).toMatch(/16\s*km/)
    expect(texte(carte)).toContain('↑ +8 km par rapport à la semaine passée')
    expect(texte(carte)).toContain('2sorties')
    expect(texte(carte)).toContain('1 h 23') // 3 600 + 1 360 = 4 960 s
    expect(texte(carte)).toContain('5:10 /km') // 4 960 s / 16 km = 310 s/km
    expect(within(carte).getByRole('button', { name: 'Définir un objectif' })).toBeTruthy()
    expect(within(carte).queryByRole('progressbar')).toBeNull()
  })

  it('définit l’objectif : progression, reste à faire, jours restants ; le modifie et le retire', async () => {
    monterListe('course')
    const carte = await screen.findByRole('region', { name: 'Cette semaine' })
    fireEvent.click(within(carte).getByRole('button', { name: 'Définir un objectif' }))
    const champ = within(carte).getByRole('textbox', { name: 'Objectif de la semaine (km)' }) as HTMLInputElement
    const enregistrer = within(carte).getByRole('button', { name: 'Enregistrer' }) as HTMLButtonElement
    expect(enregistrer.disabled).toBe(true)
    fireEvent.change(champ, { target: { value: '5000' } })
    expect(within(carte).getByRole('alert').textContent).toContain('Entre 1 et 2000 km')
    expect(enregistrer.disabled).toBe(true)
    fireEvent.change(champ, { target: { value: '32,5' } })
    fireEvent.click(enregistrer)

    expect(lireObjectif('course')).toBe(32.5)
    expect(texte(carte)).toContain('sur un objectif de 32,5 km')
    const barre = within(carte).getByRole('progressbar', { name: 'Objectif hebdomadaire' })
    expect(barre.getAttribute('aria-valuenow')).toBe('16')
    expect(barre.getAttribute('aria-valuemax')).toBe('32.5')
    expect(texte(carte)).toContain('Encore 16,5 km pour l’atteindre, il reste 3 jours.')

    // Objectif atteint
    fireEvent.click(within(carte).getByRole('button', { name: 'Modifier l’objectif' }))
    fireEvent.change(within(carte).getByRole('textbox', { name: 'Objectif de la semaine (km)' }), { target: { value: '15' } })
    fireEvent.click(within(carte).getByRole('button', { name: 'Enregistrer' }))
    expect(texte(carte)).toContain('Objectif atteint : bravo.')

    fireEvent.click(within(carte).getByRole('button', { name: 'Modifier l’objectif' }))
    fireEvent.click(within(carte).getByRole('button', { name: 'Retirer' }))
    expect(lireObjectif('course')).toBeNull()
    expect(within(carte).queryByRole('progressbar')).toBeNull()
  })

  it('l’objectif est propre à chaque sport', async () => {
    ecrireObjectif('velo', 100)
    monterListe('course')
    const carte = await screen.findByRole('region', { name: 'Cette semaine' })
    expect(within(carte).getByRole('button', { name: 'Définir un objectif' })).toBeTruthy()
  })

  it('bandeau Records : meilleurs 5 km, 10 km et lien vers la page complète', async () => {
    monterListe('course')
    const records = await screen.findByRole('region', { name: 'Records' })
    expect(texte(records)).toMatch(/5 km.*25:00/)
    expect(texte(records)).toMatch(/10 km.*50:00/)
    expect(within(records).getByRole('link', { name: 'Tout voir' }).getAttribute('href')).toBe('/running/records')
  })

  it('badges de record sur les cartes, et filtres Tout / Cette semaine / Ce mois / Records', async () => {
    monterListe('course')
    await screen.findByRole('region', { name: 'Records' })
    const cartes = () => Array.from(document.querySelectorAll('.sorties__liste > li'))
    await waitFor(() => expect(cartes()).toHaveLength(4))
    const longue = cartes().find((c) => c.textContent?.includes('Sortie longue'))!
    expect(texte(longue)).toContain('Sortie la plus longue')
    expect(texte(longue)).toContain('Meilleur 5 km : 25:00')
    expect(texte(longue)).toContain('Meilleur 10 km : 50:00')
    expect(texte(cartes().find((c) => c.textContent?.includes('Récupération'))!)).not.toContain('Meilleur')

    const filtres = screen.getByRole('group', { name: 'Sorties affichées' })
    expect(within(filtres).getByRole('button', { name: 'Tout' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(filtres).getByRole('button', { name: 'Cette semaine' }))
    expect(cartes().map((c) => c.textContent?.includes('Sortie longue') || c.textContent?.includes('Récupération'))).toEqual([true, true])
    fireEvent.click(within(filtres).getByRole('button', { name: 'Ce mois' }))
    expect(cartes()).toHaveLength(3) // 2, 10 et 11 novembre
    fireEvent.click(within(filtres).getByRole('button', { name: 'Records' }))
    expect(cartes()).toHaveLength(1)
    expect(texte(cartes()[0])).toContain('Sortie longue')
  })

  it('un seul filtre sans résultat : message clair', async () => {
    await base.execute('DELETE FROM sorties')
    await course('x', '2026-09-01', 330, 6)
    monterListe('course')
    const filtres = await screen.findByRole('group', { name: 'Sorties affichées' })
    fireEvent.click(within(filtres).getByRole('button', { name: 'Cette semaine' }))
    expect(screen.getByText('Aucune sortie dans cette sélection.')).toBeTruthy()
    fireEvent.click(within(filtres).getByRole('button', { name: 'Records' }))
    expect(screen.getByText('Aucune sortie ne détient de record pour l’instant.')).toBeTruthy()
  })
})

describe('Records', () => {
  const monterRecords = (chemin: string) =>
    render(
      <MemoryRouter initialEntries={[chemin]}>
        <Routes>
          <Route path="/running/records" element={<RecordsSortiesScreen sport="course" />} />
          <Route path="/cycling/records" element={<RecordsSortiesScreen sport="velo" />} />
          <Route path="/running" element={<p>Liste course</p>} />
        </Routes>
      </MemoryRouter>,
    )

  it('course : meilleurs temps par distance, distance jamais couverte, évolution du 5 km et autres records', async () => {
    await course('a', '2026-08-10', 330, 6)
    await course('b', '2026-09-12', 315, 6)
    await course('c', '2026-10-21', 313, 11)
    await course('d', '2026-11-04', 295, 6)
    monterRecords('/running/records')
    const temps = await screen.findByRole('region', { name: 'Meilleurs temps' })
    const lignes = within(temps).getAllByRole('listitem')
    expect(lignes.map((l) => l.firstElementChild?.textContent)).toEqual(['1 km', '5 km', '10 km', 'Semi', 'Marathon'])
    expect(texte(lignes[1])).toMatch(/5 km.*24:3\d.*4 nov\. 2026.*4:5\d \/km.*Nouveau/)
    expect(texte(lignes[2])).toMatch(/10 km.*5\d:\d\d.*21 oct\. 2026.*il y a 22 j/)
    expect(texte(lignes[3])).toContain('Aucune sortie assez longue ou détaillée')
    expect(texte(lignes[4])).toContain('—')

    const courbe = screen.getByRole('img', { name: /Meilleur 5 km par mois/ })
    expect(courbe.getAttribute('aria-label')).toMatch(/août.*sept\..*oct\..*nov\./)
    expect(screen.getByRole('region', { name: 'Évolution sur 5 km' }).textContent).toMatch(/−\d+:\d\d depuis août/)

    const autres = screen.getByRole('region', { name: 'Autres records' })
    expect(texte(autres)).toContain('Sortie la plus longue')
    expect(texte(autres)).toContain('11 km')
  })

  it('bascule Course / Vélo ; vélo : meilleurs efforts de puissance', async () => {
    await velo('v1', '2026-10-01', 'Longue', 75, 180)
    await velo('v2', '2026-11-10', 'Tempo', 35, 230)
    monterRecords('/cycling/records')
    const efforts = await screen.findByRole('region', { name: 'Meilleurs efforts' })
    const lignes = within(efforts).getAllByRole('listitem').map((l) => texte(l))
    expect(lignes[0]).toMatch(/1 min.*230 W.*10 nov\. 2026.*Nouveau/) // 230 W (la sortie la plus récente, et plus forte)
    expect(lignes[2]).toMatch(/20 min.*230 W/)
    expect(lignes[3]).toMatch(/60 min.*180 W.*1 oct\. 2026.*il y a 42 j/)
    const bascule = screen.getByRole('navigation', { name: 'Sport' })
    expect(within(bascule).getByRole('link', { name: 'Vélo' }).getAttribute('aria-current')).toBe('page')
    expect(within(bascule).getByRole('link', { name: 'Course' }).getAttribute('href')).toBe('/running/records')
    expect(screen.queryByRole('region', { name: 'Meilleurs temps' })).toBeNull()
  })

  it('sans sortie : aucun record, message simple', async () => {
    monterRecords('/running/records')
    expect(await screen.findByText('Aucune sortie pour l’instant.')).toBeTruthy()
  })
})

describe('Vélo : détail d’une sortie, analyse', () => {
  const monterDetail = (id: string) =>
    render(
      <MemoryRouter initialEntries={[`/cycling/${id}`]}>
        <Routes>
          <Route path="/cycling/:id" element={<SortieDetailScreen sport="velo" />} />
          <Route path="/cycling" element={<p>Liste vélo</p>} />
        </Routes>
      </MemoryRouter>,
    )

  beforeEach(() => {
    // FTP et FC max réglées : zones prévisibles (110 / 150 / 180 / 210 W pour 200 W)
    localStorage.setItem(CLE_REGLAGES_CHARGE, JSON.stringify({ ftpW: 200, fcMax: 190 }))
  })

  it('temps par zone de puissance, bascule vers le cœur, référence annoncée', async () => {
    await velo('v1', '2026-11-08', 'Sortie du dimanche', 60, 160, 150)
    monterDetail('v1')
    const zones = await screen.findByRole('region', { name: 'Temps par zone' })
    const lignes = within(zones).getAllByRole('listitem')
    expect(lignes).toHaveLength(5)
    // 160 W avec une FTP de 200 W : 80 % -> Z3 (150 à 179 W), toute la sortie
    expect(texte(lignes[2])).toMatch(/Z3.*150 – 179 W.*1 h.*100 %/)
    expect(texte(lignes[0])).toMatch(/Z1.*< 110 W.*0 min.*0 %/)
    expect(texte(zones)).toContain('votre FTP de 200 W')
    expect(texte(zones)).not.toContain('estimée')

    fireEvent.click(within(zones).getByRole('button', { name: 'Cœur' }))
    expect(within(zones).getByRole('button', { name: 'Cœur' }).getAttribute('aria-pressed')).toBe('true')
    // 150 bpm sur 190 = 79 % -> Z3 (133 à 151 bpm)
    expect(texte(within(zones).getAllByRole('listitem')[2])).toMatch(/Z3.*133 – 151 bpm.*100 %/)
    expect(texte(zones)).toContain('votre FC max de 190 bpm')
  })

  it('compare la sortie aux 30 jours précédents : position, moyenne et verdict', async () => {
    await velo('a', '2026-10-20', 'Sortie A', 90, 180, 140, 640, 30)
    await velo('b', '2026-10-25', 'Sortie B', 100, 180, 140, 640, 30)
    await velo('c', '2026-11-01', 'Sortie C', 110, 180, 140, 680, 30)
    await velo('s', '2026-11-08', 'Sortie longue', 130, 180, 140, 412, 30.5)
    monterDetail('s')
    const comparaison = await screen.findByRole('region', { name: 'Par rapport à vos sorties' })
    const lignes = within(comparaison).getAllByRole('listitem').map((l) => texte(l))
    expect(lignes[0]).toMatch(/Distance.*66,1 km.*Plus longue que d’habitude.*moyenne 50 km.*la plus longue sur 4 sorties/)
    expect(lignes[1]).toMatch(/Vitesse moyenne.*30,5 km\/h.*Dans la moyenne/)
    expect(lignes[2]).toMatch(/Dénivelé positif.*412 m.*Plus plate que d’habitude/)
  })

  it('pas de comparaison avec moins de trois sorties comparables', async () => {
    await velo('a', '2026-11-01', 'Sortie A', 60, 180)
    await velo('s', '2026-11-08', 'Sortie B', 60, 180)
    monterDetail('s')
    await screen.findByRole('heading', { name: 'Temps par zone' })
    expect(screen.queryByRole('region', { name: 'Par rapport à vos sorties' })).toBeNull()
  })

  it('meilleurs efforts : puissance sur 1, 5, 20 et 60 min ; « Record » quand la sortie détient le meilleur', async () => {
    await velo('v1', '2026-10-01', 'Longue', 75, 180)
    await velo('v2', '2026-11-10', 'Tempo', 70, 230)
    monterDetail('v2')
    const efforts = await screen.findByRole('region', { name: 'Meilleurs efforts' })
    const lignes = within(efforts).getAllByRole('row').slice(1).map((r) => texte(r))
    expect(lignes).toEqual(['1 min230 WRecord', '5 min230 WRecord', '20 min230 WRecord', '60 min230 WRecord'])
    cleanup()
    monterDetail('v1')
    const autres = await screen.findByRole('region', { name: 'Meilleurs efforts' })
    expect(within(autres).queryByText('Record')).toBeNull()
  })

  it('sortie saisie à la main (sans série) : aucun bloc d’analyse, le détail reste complet', async () => {
    await inserer(base, 'sorties', { ...b, id: 'm', sport: 'velo', date: '2026-11-08', titre: 'À la main', duree_s: 3600, distance_m: 30_000 })
    monterDetail('m')
    await screen.findByLabelText('Chiffres principaux')
    expect(screen.queryByRole('region', { name: 'Temps par zone' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Meilleurs efforts' })).toBeNull()
  })
})
