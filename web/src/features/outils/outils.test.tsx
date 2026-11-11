// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import type { EvenementAgenda } from '../calendar/types'
import type { PointHistorique } from '../stats/statsQueries'
import { pointsDeLaPeriode, resumerProgression } from './progression'
import { lireReglages, purgerEnvoyes, rappelsDus, REGLAGES_PAR_DEFAUT, type ReglagesRappels } from './rappels'
import { compterDonnees, formaterDerniereSauvegarde } from './useDonnees'
import { useReglagesRappels, useRappelsActifs } from './useRappels'

const base = createTestDb()
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import DonneesScreen from './DonneesScreen'
import OutilsScreen from './OutilsScreen'
import RappelsScreen from './RappelsScreen'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

const evenement = (id: string, dateIso: string, etat: EvenementAgenda['etat'] = 'planifiee'): EvenementAgenda =>
  ({ id, dateIso, titre: `Séance ${id}`, etat, genre: 'course', consigne: null, detail: null, optionnelle: false, jalon: null, lien: null }) as EvenementAgenda

const actifs: ReglagesRappels = { ...REGLAGES_PAR_DEFAUT, actif: true }

describe('rappelsDus', () => {
  const apres19h = new Date(2026, 10, 11, 19, 5)
  it('rappelle la veille à partir de l\'heure choisie, une seule fois', () => {
    const dus = rappelsDus(actifs, [evenement('a', '2026-11-12')], apres19h, new Set())
    expect(dus).toEqual([{ cle: 'a|2026-11-12|veille', titre: 'Séance demain', corps: 'Séance a' }])
    expect(rappelsDus(actifs, [evenement('a', '2026-11-12')], apres19h, new Set(['a|2026-11-12|veille']))).toEqual([])
  })
  it('attend l\'heure : rien avant 19:00 la veille, ni avant 07:30 le jour même', () => {
    expect(rappelsDus(actifs, [evenement('a', '2026-11-12')], new Date(2026, 10, 11, 18, 59), new Set())).toEqual([])
    expect(rappelsDus(actifs, [evenement('b', '2026-11-11')], new Date(2026, 10, 11, 7, 29), new Set())).toEqual([])
    expect(rappelsDus(actifs, [evenement('b', '2026-11-11')], new Date(2026, 10, 11, 7, 30), new Set())[0]).toMatchObject({ titre: "Séance aujourd'hui" })
  })
  it('ignore les séances terminées, les autres jours, les rappels désactivés et l\'interrupteur général', () => {
    expect(rappelsDus(actifs, [evenement('c', '2026-11-12', 'terminee'), evenement('d', '2026-11-14')], apres19h, new Set())).toEqual([])
    expect(rappelsDus({ ...actifs, veille: false }, [evenement('a', '2026-11-12')], apres19h, new Set())).toEqual([])
    expect(rappelsDus({ ...actifs, actif: false }, [evenement('a', '2026-11-12')], apres19h, new Set())).toEqual([])
  })
  it('passe de décembre à janvier pour la veille', () => {
    expect(rappelsDus(actifs, [evenement('e', '2027-01-01')], new Date(2026, 11, 31, 20, 0), new Set())).toHaveLength(1)
  })
})

describe('réglages et purge', () => {
  it('lit les réglages enregistrés et corrige les valeurs invalides', () => {
    expect(lireReglages(null)).toEqual(REGLAGES_PAR_DEFAUT)
    expect(lireReglages('pas du json')).toEqual(REGLAGES_PAR_DEFAUT)
    expect(lireReglages(JSON.stringify({ actif: true, veilleHeure: '25:99', jourHeure: '08:15', jour: false }))).toEqual({ ...REGLAGES_PAR_DEFAUT, actif: true, jourHeure: '08:15', jour: false })
  })
  it('purge les rappels de plus de 3 jours', () => {
    expect(purgerEnvoyes(['a|2026-11-01|veille', 'b|2026-11-09|jour', 'c|2026-11-12|veille'], '2026-11-11')).toEqual(['b|2026-11-09|jour', 'c|2026-11-12|veille'])
  })
})

describe('progression', () => {
  const pt = (dateIso: string, maxChargeKg: number): PointHistorique => ({ dateIso, maxChargeKg, reps: 5, enSecondes: false })
  const points = [pt('2026-01-10', 60), pt('2026-09-01', 70), pt('2026-10-15', 80), pt('2026-11-05', 77.5)]
  it('filtre par période et calcule record et évolution', () => {
    const dans3Mois = pointsDeLaPeriode(points, '3m', new Date(2026, 10, 11))
    expect(dans3Mois.map((p) => p.dateIso)).toEqual(['2026-09-01', '2026-10-15', '2026-11-05'])
    const r = resumerProgression(dans3Mois)
    expect(r.record).toEqual({ valeur: 80, dateIso: '2026-10-15' })
    expect(r.evolution).toBe(7.5)
    expect(r.seances).toBe(3)
    expect(pointsDeLaPeriode(points, 'tout', new Date(2026, 10, 11))).toHaveLength(4)
  })
  it('sans point : pas de record ; une seule séance : pas d\'évolution', () => {
    expect(resumerProgression([])).toMatchObject({ record: null, evolution: null, seances: 0 })
    expect(resumerProgression([pt('2026-11-05', 80)]).evolution).toBeNull()
  })
})

describe('compterDonnees', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  it('compte les lignes vivantes utiles et ignore archivées et supprimées', async () => {
    const c = { user_id: 'u1', updated_at: 'u0', deleted_at: null }
    await inserer(base, 'seances', { ...c, id: 'cd-s1', nom: 'A', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
    await inserer(base, 'seances', { ...c, id: 'cd-s2', nom: 'B', is_archived: 1, seance_category: 'STRENGTH', created_at: 'c' })
    await inserer(base, 'instances_seance', { ...c, id: 'cd-i1', seance_id: 'cd-s1', date: '2026-11-02', is_completed: 1 })
    await inserer(base, 'instances_seance', { ...c, id: 'cd-i2', seance_id: 'cd-s1', date: '2026-11-03', is_completed: 0 })
    await inserer(base, 'sorties', { ...c, id: 'cd-o1', sport: 'course', date: '2026-11-02', titre: 'Course', source: 'manuel', en_salle: 0, created_at: 'c' })
    await inserer(base, 'sorties', { ...c, id: 'cd-o2', sport: 'velo', date: '2026-11-02', titre: 'Vélo', source: 'garmin', en_salle: 0, created_at: 'c', deleted_at: 'x' })
    expect(await compterDonnees(base)).toMatchObject({ seances: 1, seancesJouees: 1, sorties: 1 })
  })
  it('formate la date de dernière sauvegarde ou rien', () => {
    expect(formaterDerniereSauvegarde(null)).toBeNull()
    expect(formaterDerniereSauvegarde('n\'importe quoi')).toBeNull()
    expect(formaterDerniereSauvegarde('2026-11-10T20:40:00Z')).toContain('2026')
  })
})

describe('écrans', () => {
  it('le menu Outils propose les trois écrans', () => {
    render(
      <MemoryRouter>
        <OutilsScreen />
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/outils/donnees', '/outils/rappels', '/outils/progression'])
  })

  it('Mes données : effectifs, aucune sauvegarde au départ, liens export et import', async () => {
    render(
      <MemoryRouter>
        <DonneesScreen />
      </MemoryRouter>,
    )
    expect(screen.getByText('Aucune sauvegarde faite depuis cet appareil.')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Séances types')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Exporter en JSON' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Importer une sauvegarde' }).getAttribute('href')).toBe('/import')
  })

  it('Rappels : activer sans autorisation de notifier affiche un message et laisse l\'interrupteur éteint', async () => {
    vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'default', requestPermission: vi.fn().mockResolvedValue('denied') }))
    render(<RappelsScreen />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Rappeler mes séances programmées' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('refusées'))
    expect((screen.getByRole('checkbox', { name: 'Rappeler mes séances programmées' }) as HTMLInputElement).checked).toBe(false)
    vi.unstubAllGlobals()
  })

  it('Rappels : autorisation accordée, les réglages sont enregistrés et l\'heure invalide est refusée', async () => {
    vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'granted', requestPermission: vi.fn() }))
    const { result } = renderHook(() => useReglagesRappels())
    await act(() => result.current.basculer(true))
    act(() => result.current.regler('veilleHeure', '20:15'))
    act(() => result.current.regler('jourHeure', 'abc'))
    expect(lireReglages(window.localStorage.getItem('pandamove.rappels'))).toMatchObject({ actif: true, veilleHeure: '20:15', jourHeure: '07:30' })
    vi.unstubAllGlobals()
  })
})

describe('useRappelsActifs', () => {
  it('envoie un rappel dû une seule fois', async () => {
    vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'granted' }))
    window.localStorage.setItem('pandamove.rappels', JSON.stringify(actifs))
    const c = { user_id: 'u1', updated_at: 'u0', deleted_at: null }
    await inserer(base, 'seances', { ...c, id: 'rap-s', nom: 'Pull', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
    await inserer(base, 'instances_seance', { ...c, id: 'rap-i', seance_id: 'rap-s', date: '2026-11-12', is_completed: 0 })
    const envoyer = vi.fn().mockResolvedValue(undefined)
    const maintenant = () => new Date(2026, 10, 11, 19, 30)
    const { unmount } = renderHook(() => useRappelsActifs({ db: base, maintenant, envoyer, intervalleMs: 20 }))
    await waitFor(() => expect(envoyer).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 80))
    expect(envoyer).toHaveBeenCalledTimes(1)
    expect(envoyer.mock.calls[0][0]).toBe('Séance demain')
    unmount()
    vi.unstubAllGlobals()
  })
})
