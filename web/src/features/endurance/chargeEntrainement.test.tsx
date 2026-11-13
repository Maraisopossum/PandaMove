// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sortie } from '../../core/db/repos/sorties'
import { creerSortie } from '../../core/db/repos/sorties'
import { createTestDb } from '../../test/sqliteDb'
import {
  ajouterJours,
  calculerSerieCharge,
  chargeSortie,
  estimerParametres,
  etatForme,
  parametresEffectifs,
  repartitionMethodes,
  type ParametresCharge,
} from './calculCharge'
import { construireGraphiqueCharge } from './graphiqueCharge'
import { CLE_REGLAGES_CHARGE, lireReglagesCharge, useChargeEntrainement } from './useChargeEntrainement'

const base = createTestDb()
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import StatsScreen from '../stats/StatsScreen'

beforeEach(async () => {
  window.localStorage.clear()
  await base.execute('DELETE FROM sorties')
})
afterEach(cleanup)

const sortie = (date: string, extra: Partial<Sortie> = {}): Sortie => ({
  id: date + (extra.titre ?? ''), sport: 'course', date, debutAt: null, titre: 'Course', dureeS: 3600, dureeDeplacementS: null, distanceM: 10_000,
  denivelePosM: null, deniveleNegM: null, fcMoy: null, fcMax: null, rpe: null, puissanceMoyW: null, puissanceMaxW: null, puissanceNormW: null,
  cadenceMoy: null, enSalle: false, notes: null, lien: null, source: 'manuel', empreinte: null, seanceId: null, tours: null, serie: null,
  trace: null, createdAt: '', ...extra,
})

const AUCUN: ParametresCharge = { ftpW: null, fcMax: null, fcRepos: 55 }

describe('chargeSortie', () => {
  it('puissance : 1 h à la FTP = 100 points, le carré du rapport au-dessus', () => {
    const p = { ...AUCUN, ftpW: 200 }
    expect(chargeSortie(sortie('2026-11-10', { puissanceNormW: 200 }), p)).toEqual({ points: 100, methode: 'puissance' })
    expect(chargeSortie(sortie('2026-11-10', { puissanceNormW: 100, dureeS: 7200 }), p).points).toBeCloseTo(50)
    expect(chargeSortie(sortie('2026-11-10', { puissanceNormW: 300 }), p).points).toBeCloseTo(225)
  })

  it('fréquence cardiaque : 1 h à 85 % de la réserve = 100 points, borné entre 0 et la FC max', () => {
    const p: ParametresCharge = { ftpW: null, fcMax: 190, fcRepos: 50 }
    const auSeuil = 50 + 0.85 * 140
    expect(chargeSortie(sortie('2026-11-10', { fcMoy: auSeuil }), p).points).toBeCloseTo(100, 5)
    const facile = chargeSortie(sortie('2026-11-10', { fcMoy: 120 }), p)
    expect(facile.methode).toBe('frequence')
    expect(facile.points).toBeLessThan(60)
    // FC supérieure à la FC max : plafonnée, jamais de charge démesurée
    expect(chargeSortie(sortie('2026-11-10', { fcMoy: 250 }), p).points).toBeLessThan(200)
    expect(chargeSortie(sortie('2026-11-10', { fcMoy: 20 }), p).points).toBe(0)
  })

  it('effort ressenti puis durée seule en dernier recours', () => {
    expect(chargeSortie(sortie('2026-11-10', { rpe: 7 }), AUCUN)).toEqual({ points: 100, methode: 'effort' })
    expect(chargeSortie(sortie('2026-11-10', { rpe: 3 }), AUCUN).points).toBeCloseTo(18.4, 1)
    const duree = chargeSortie(sortie('2026-11-10'), AUCUN)
    expect(duree.methode).toBe('duree')
    expect(duree.points).toBeCloseTo(42.25)
  })

  it('priorité puissance > fréquence > effort ; sans FTP la puissance est ignorée ; sans durée : 0', () => {
    const toutes = sortie('2026-11-10', { puissanceNormW: 200, fcMoy: 150, rpe: 6 })
    expect(chargeSortie(toutes, { ftpW: 200, fcMax: 190, fcRepos: 50 }).methode).toBe('puissance')
    expect(chargeSortie(toutes, { ftpW: null, fcMax: 190, fcRepos: 50 }).methode).toBe('frequence')
    expect(chargeSortie(toutes, AUCUN).methode).toBe('effort')
    expect(chargeSortie(sortie('2026-11-10', { dureeS: null }), AUCUN).points).toBe(0)
    expect(chargeSortie(sortie('2026-11-10', { dureeS: 0, puissanceNormW: 300 }), { ...AUCUN, ftpW: 200 }).points).toBe(0)
  })
})

describe('paramètres', () => {
  it('estimés : FC max la plus haute vue, FTP = 95 % de la meilleure puissance normalisée sur 20 min ou plus', () => {
    const liste = [
      sortie('2026-11-01', { fcMax: 178, fcMoy: 150 }),
      sortie('2026-11-02', { fcMax: 185 }),
      sortie('2026-11-03', { puissanceNormW: 210, dureeS: 3600 }),
      sortie('2026-11-04', { puissanceNormW: 400, dureeS: 300 }),
    ]
    expect(estimerParametres(liste)).toEqual({ ftpW: 200, fcMax: 185, fcRepos: 55 })
    expect(estimerParametres([])).toEqual({ ftpW: null, fcMax: null, fcRepos: 55 })
  })

  it('le réglage de l’utilisateur prime s’il est plausible, sinon l’estimation', () => {
    const liste = [sortie('2026-11-02', { fcMax: 185 })]
    expect(parametresEffectifs(liste, { fcMax: 190, ftpW: 250, fcRepos: 48 })).toEqual({ ftpW: 250, fcMax: 190, fcRepos: 48 })
    expect(parametresEffectifs(liste, { fcMax: 20, ftpW: 5000, fcRepos: 500 })).toEqual({ ftpW: null, fcMax: 185, fcRepos: 55 })
  })

  it('répartition des mesures utilisées', () => {
    const p: ParametresCharge = { ftpW: 200, fcMax: 190, fcRepos: 50 }
    const liste = [
      sortie('2026-11-01', { puissanceNormW: 200 }),
      sortie('2026-11-02', { fcMoy: 150 }),
      sortie('2026-11-03', { rpe: 6 }),
      sortie('2026-11-04'),
      sortie('2026-11-05', { dureeS: null }),
    ]
    expect(repartitionMethodes(liste, p)).toEqual({ puissance: 1, frequence: 1, effort: 1, duree: 1 })
  })
})

describe('calculerSerieCharge', () => {
  const p = { ...AUCUN, ftpW: 200 }
  const dur = (date: string) => sortie(date, { puissanceNormW: 200 }) // 100 points

  it('sans sortie : série vide', () => {
    expect(calculerSerieCharge([], p, '2026-11-10')).toEqual([])
  })

  it('moyennes exponentielles 42 et 7 jours, fraîcheur = forme − fatigue de la veille, jours sans sortie à 0', () => {
    const serie = calculerSerieCharge([dur('2026-11-01')], p, '2026-11-04')
    expect(serie.map((j) => j.date)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'])
    expect(serie[0]).toMatchObject({ charge: 100, fraicheur: 0 })
    expect(serie[0].forme).toBeCloseTo(100 / 42)
    expect(serie[0].fatigue).toBeCloseTo(100 / 7)
    // Lendemain : la fraîcheur est celle de la veille (forme − fatigue), donc négative après une séance
    expect(serie[1].fraicheur).toBeCloseTo(100 / 42 - 100 / 7)
    expect(serie[1].fatigue).toBeCloseTo((100 / 7) * (1 - 1 / 7))
    // Pas de nouvelle charge : la fatigue retombe plus vite que la forme
    expect(serie[3].fatigue).toBeLessThan(serie[0].fatigue)
    expect(serie[3].forme).toBeGreaterThan(serie[0].forme * 0.9)
  })

  it('charge régulière : forme et fatigue convergent vers la charge quotidienne, fraîcheur vers 0', () => {
    const liste: Sortie[] = []
    for (let i = 0; i < 300; i++) liste.push(dur(ajouterJours('2026-01-01', i)))
    const dernier = calculerSerieCharge(liste, p, ajouterJours('2026-01-01', 299)).at(-1)!
    expect(dernier.forme).toBeGreaterThan(99.9)
    expect(dernier.fatigue).toBeGreaterThan(99.9)
    expect(Math.abs(dernier.fraicheur)).toBeLessThan(0.1)
  })

  it('une semaine de repos après un bloc fait monter la fraîcheur', () => {
    const liste: Sortie[] = []
    for (let i = 0; i < 42; i++) liste.push(dur(ajouterJours('2026-09-01', i)))
    const fin = ajouterJours('2026-09-01', 42 + 7)
    const serie = calculerSerieCharge(liste, p, fin)
    expect(serie.at(-1)!.fraicheur).toBeGreaterThan(serie[41].fraicheur + 20)
  })

  it('ignore les sorties futures, additionne deux sorties du même jour, franchit un changement d’heure', () => {
    const serie = calculerSerieCharge([dur('2026-10-24'), { ...dur('2026-10-24'), id: 'b' }, dur('2026-12-01')], p, '2026-10-27')
    expect(serie[0].charge).toBe(200)
    expect(serie.map((j) => j.date)).toEqual(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'])
  })

  it('garde-fou : une sortie très ancienne ne rallonge pas le calcul au-delà de trois ans', () => {
    const serie = calculerSerieCharge([dur('2010-01-01'), dur('2026-11-01')], p, '2026-11-10')
    expect(serie.length).toBeLessThanOrEqual(3 * 366 + 1)
    expect(serie.at(-1)!.date).toBe('2026-11-10')
  })
})

describe('etatForme', () => {
  it.each([
    [-40, 'Très fatigué'],
    [-20, 'Charge productive'],
    [0, 'Équilibre'],
    [15, 'Frais'],
    [40, 'Désentraîné'],
  ])('fraîcheur %i : %s', (valeur, libelle) => {
    expect(etatForme(valeur).libelle).toBe(libelle)
  })
})

describe('construireGraphiqueCharge', () => {
  it('null sans données ; sinon courbes, zéro, graduations et trois dates dans la zone de tracé', () => {
    expect(construireGraphiqueCharge([])).toBeNull()
    const serie = calculerSerieCharge([sortie('2026-11-01', { rpe: 8 })], AUCUN, '2026-11-20')
    const g = construireGraphiqueCharge(serie)!
    expect(g.forme.split(' ')).toHaveLength(serie.length)
    expect(g.dates).toHaveLength(3)
    expect(g.dates[0].x).toBeCloseTo(g.zone.x)
    expect(g.dates.at(-1)!.x).toBeCloseTo(g.zone.x + g.zone.largeur)
    expect(g.yZero).toBeGreaterThan(g.zone.y)
    expect(g.yZero).toBeLessThanOrEqual(g.zone.y + g.zone.hauteur)
    // Les graduations couvrent le zéro et tous les points restent dans le cadre
    expect(g.graduations.some((t) => t.valeur === 0)).toBe(true)
    for (const pt of [...g.forme.split(' '), ...g.fatigue.split(' '), ...g.fraicheur.split(' ')]) {
      const y = Number(pt.split(',')[1])
      expect(y).toBeGreaterThanOrEqual(g.zone.y - 0.5)
      expect(y).toBeLessThanOrEqual(g.zone.y + g.zone.hauteur + 0.5)
    }
  })

  it('un seul jour : un point au centre, sans division par zéro', () => {
    const g = construireGraphiqueCharge([{ date: '2026-11-01', charge: 50, forme: 1, fatigue: 7, fraicheur: 0 }])!
    expect(g.dates).toHaveLength(1)
    expect(g.forme).not.toMatch(/NaN|Infinity/)
  })
})

describe('réglages et hook', () => {
  it('lit des réglages valides, ignore le reste', () => {
    expect(lireReglagesCharge()).toEqual({})
    window.localStorage.setItem(CLE_REGLAGES_CHARGE, JSON.stringify({ ftpW: 230, fcMax: 'x', fcRepos: 50 }))
    expect(lireReglagesCharge()).toEqual({ ftpW: 230, fcMax: undefined, fcRepos: 50 })
    window.localStorage.setItem(CLE_REGLAGES_CHARGE, 'pas du json')
    expect(lireReglagesCharge()).toEqual({})
  })

  it('charge les sorties, calcule la série sur la fenêtre et enregistre les réglages', async () => {
    await creerSortie(base, { sport: 'course', date: '2026-11-08', dureeS: 3600, fcMoy: 160, fcMax: 180 })
    await creerSortie(base, { sport: 'velo', date: '2026-11-10', dureeS: 5400, puissanceNormW: 200 })
    const maintenant = () => new Date(2026, 10, 12)
    const { result } = renderHook(() => useChargeEntrainement({ db: base, maintenant }))
    await waitFor(() => expect(result.current.pret).toBe(true))
    // De la première sortie (8 nov.) à aujourd'hui (12 nov.)
    expect(result.current.serie).toHaveLength(5)
    expect(result.current.dernier?.date).toBe('2026-11-12')
    expect(result.current.parametres).toMatchObject({ fcMax: 180, ftpW: 190 })
    act(() => result.current.regler({ ftpW: 250 }))
    expect(result.current.parametres?.ftpW).toBe(250)
    expect(JSON.parse(window.localStorage.getItem(CLE_REGLAGES_CHARGE)!)).toEqual({ ftpW: 250 })
    act(() => result.current.choisirFenetre(42))
    expect(result.current.fenetre).toBe(42)
  })
})

describe('vue « Forme » des statistiques', () => {
  it('sans sortie : message ; avec sorties : état, valeurs, courbes et réglages', async () => {
    render(<StatsScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Forme' }))
    expect(await screen.findByText(/Aucune sortie enregistrée/)).toBeTruthy()
    cleanup()

    const aujourdhui = new Date()
    const jour = (decalage: number) => {
      const d = new Date(aujourdhui)
      d.setDate(d.getDate() - decalage)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    for (const n of [1, 3, 5]) await creerSortie(base, { sport: 'course', date: jour(n), dureeS: 3600, rpe: 7 })
    render(<StatsScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Forme' }))
    expect(await screen.findByRole('heading', { name: 'Aujourd’hui' })).toBeTruthy()
    expect(screen.getByRole('img', { name: /Courbes de forme, fatigue et fraîcheur/ })).toBeTruthy()
    expect(screen.getByText('Forme', { selector: 'dt' })).toBeTruthy()
    expect(screen.getByText('Fatigue', { selector: 'dt' })).toBeTruthy()
    expect(screen.getByText('Fraîcheur', { selector: 'dt' })).toBeTruthy()

    // Réglages : la mesure utilisée est indiquée, un réglage s'enregistre sur l'appareil
    fireEvent.click(screen.getByText('Réglages du calcul'))
    expect(screen.getByText(/3 sorties à l’effort ressenti/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('FTP (W)'), { target: { value: '240' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(JSON.parse(window.localStorage.getItem(CLE_REGLAGES_CHARGE)!)).toMatchObject({ ftpW: 240 })
    fireEvent.click(screen.getByRole('button', { name: 'Revenir aux estimations' }))
    expect(JSON.parse(window.localStorage.getItem(CLE_REGLAGES_CHARGE)!)).toEqual({})
  })
})
