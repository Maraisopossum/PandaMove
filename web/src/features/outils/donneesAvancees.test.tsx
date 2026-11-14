// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import { debutPeriode, lireDonneesCiblees, nomFichierCible, resumerSelection, versCsv, versJson } from './exportCible'
import { resumerIntegrite, verifierIntegrite } from './integrite'
import { ilYa, joursDepuis, rappelDu } from './rappelSauvegarde'
import { resumerSynchro, formaterTaille } from './useDonnees'

const base = createTestDb()
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import DonneesScreen from './DonneesScreen'

const c = { user_id: 'u1', updated_at: 'u0', deleted_at: null }
const MAINTENANT = new Date(2026, 10, 14, 15, 0)

beforeEach(async () => {
  await inserer(base, 'sorties', { ...c, id: 'o1', sport: 'course', date: '2026-11-05', titre: 'Footing', duree_s: 2700, distance_m: 8000, source: 'manuel', en_salle: 0, created_at: 'x', trace: 'SECRET-TRACE' })
  await inserer(base, 'sorties', { ...c, id: 'o2', sport: 'velo', date: '2026-08-02', titre: '=HYPERLINK("x")', duree_s: 3600, source: 'manuel', en_salle: 0, created_at: 'x' })
  await inserer(base, 'seances_mobilite', { ...c, id: 'm1', date: '2026-11-10', duree_sec: 600, exercices: 6, zones: 'hanches', sport: 'course', created_at: 'x' })
  await inserer(base, 'seances_course', { ...c, id: 'p1', titre: 'Sortie longue', consigne: '', detail: '1 h 10', date: '2026-11-21', optionnelle: 0, jalon: '', lien: '', is_validated: 0, created_at: 'x' })
})
afterEach(async () => {
  cleanup()
  window.localStorage.clear()
  for (const t of ['sorties', 'seances_mobilite', 'seances_course', 'series_realisees', 'instances_seance', 'seances']) await base.execute(`DELETE FROM ${t}`)
})

describe('export ciblé', () => {
  it('bornes de période', () => {
    expect(debutPeriode('tout', MAINTENANT)).toBeNull()
    expect(debutPeriode('mois', MAINTENANT)).toBe('2026-11-01')
    expect(debutPeriode('trimestre', MAINTENANT)).toBe('2026-08-14')
    expect(debutPeriode('annee', MAINTENANT)).toBe('2026-01-01')
  })

  it('filtre par module et période, sans la trace', async () => {
    const d = await lireDonneesCiblees(base, ['sorties', 'mobilite'], 'mois', MAINTENANT)
    expect(d.sorties?.map((l) => l.id)).toEqual(['o1'])
    expect(d.mobilite?.map((l) => l.id)).toEqual(['m1'])
    expect(JSON.stringify(d)).not.toContain('SECRET-TRACE')
    expect(resumerSelection(d)).toBe('1 sortie et 1 séance de mobilité')
    expect((await lireDonneesCiblees(base, ['sorties'], 'tout', MAINTENANT)).sorties).toHaveLength(2)
    expect(resumerSelection({})).toBe('Aucune donnée sur cette sélection')
  })

  it('le calendrier exporte les séances planifiées à venir', async () => {
    const d = await lireDonneesCiblees(base, ['calendrier'], 'mois', MAINTENANT)
    expect(d.calendrier?.map((l) => l.titre)).toEqual(['Sortie longue'])
  })

  it('JSON documenté et CSV protégé contre les formules, avec BOM', async () => {
    const d = await lireDonneesCiblees(base, ['sorties'], 'tout', MAINTENANT)
    expect(JSON.parse(versJson(d, 'tout', MAINTENANT))).toMatchObject({ format: 'pandamove-export-partiel', version: 1, depuis: null })
    const csv = versCsv(d)
    expect(csv.startsWith('﻿module;date;titre;sport;duree_s;distance_m;detail')).toBe(true)
    expect(csv).toContain("sorties;2026-11-05;Footing;course;2700;8000;")
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(nomFichierCible(MAINTENANT, 'csv')).toBe('pandamove-donnees-2026-11-14.csv')
  })
})

describe('intégrité', () => {
  it('signale séries orphelines et séances sans modèle, sans rien modifier', async () => {
    expect(resumerIntegrite(await verifierIntegrite(base))).toBe('Aucune anomalie : toutes les données sont cohérentes.')
    await inserer(base, 'instances_seance', { ...c, id: 'i1', seance_id: 'absent', date: '2026-11-01', is_completed: 1 })
    await inserer(base, 'series_realisees', { ...c, id: 'r1', instance_seance_id: 'disparue', numero_serie: 1, is_completed: 1 })
    const rapport = await verifierIntegrite(base)
    expect(rapport).toEqual({ seriesOrphelines: 1, seancesSansModele: 1 })
    expect(resumerIntegrite(rapport)).toBe('À examiner : 1 série orpheline et 1 séance sans modèle. Rien n’a été modifié.')
    expect((await base.get<{ n: number }>('SELECT COUNT(*) AS n FROM series_realisees')).n).toBe(1)
  })
})

describe('rappel et synchronisation', () => {
  it('échéance du rappel selon la fréquence', () => {
    const il = (j: number) => new Date(MAINTENANT.getTime() - j * 86_400_000).toISOString()
    expect(rappelDu(null, 'jamais', MAINTENANT)).toBe(false)
    expect(rappelDu(null, 'mois', MAINTENANT)).toBe(true)
    expect(rappelDu(il(29), 'mois', MAINTENANT)).toBe(false)
    expect(rappelDu(il(30), 'mois', MAINTENANT)).toBe(true)
    expect(rappelDu(il(60), 'trimestre', MAINTENANT)).toBe(false)
    expect(joursDepuis(il(41), MAINTENANT)).toBe(41)
    expect(joursDepuis('n’importe quoi', MAINTENANT)).toBeNull()
  })

  it('phrases lisibles', () => {
    expect(ilYa(new Date(MAINTENANT.getTime() - 2 * 60_000), MAINTENANT)).toBe('il y a 2 min')
    expect(ilYa(new Date(MAINTENANT.getTime() - 3 * 3_600_000), MAINTENANT)).toBe('il y a 3 h')
    expect(resumerSynchro({ enAttente: 0, derniere: new Date(MAINTENANT.getTime() - 120_000), connecte: true }, MAINTENANT)).toBe('Tout est synchronisé. Dernière synchronisation il y a 2 min, aucun changement en attente.')
    expect(resumerSynchro({ enAttente: 3, derniere: null, connecte: false }, MAINTENANT)).toBe('3 modifications en attente d’envoi (appareil hors ligne).')
    expect(formaterTaille(1_900_000)).toBe('1,8 Mo')
  })
})

describe('écran Mes données', () => {
  const monter = () =>
    render(
      <MemoryRouter>
        <DonneesScreen />
      </MemoryRouter>,
    )

  it('vérifier l’intégrité annonce le résultat', async () => {
    monter()
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier l’intégrité' }))
    await waitFor(() => expect(screen.getByText('Aucune anomalie : toutes les données sont cohérentes.')).toBeTruthy())
  })

  it('le rappel choisi est retenu sur l’appareil et déclenche l’avertissement sans sauvegarde', async () => {
    monter()
    expect(screen.queryByRole('note')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tous les mois' }))
    expect(window.localStorage.getItem('pandamove.sauvegarde.rappel')).toBe('mois')
    expect(screen.getByRole('button', { name: 'Tous les mois' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('note').textContent).toContain('pas encore de sauvegarde')
  })

  it('exporter une partie : aperçu chiffré puis téléchargement CSV', async () => {
    const telecharges: string[][] = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      void (b as Blob).text().then((t) => telecharges.push([(b as Blob).type, t]))
      return 'blob:x'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    monter()
    const bouton = screen.getByRole('button', { name: 'Exporter la sélection' }) as HTMLButtonElement
    expect(bouton.disabled).toBe(true)
    expect(screen.getByText('Choisissez au moins un module.')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Course et vélo' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mobilité' }))
    fireEvent.click(within(screen.getByRole('group', { name: 'Période' })).getByRole('button', { name: 'Tout' }))
    await waitFor(() => expect(screen.getByText('Export prévu : 2 sorties et 1 séance de mobilité.')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'CSV (tableur)' }))
    fireEvent.click(bouton)
    await waitFor(() => expect(screen.getByText(/pandamove-donnees-\d{4}-\d{2}-\d{2}\.csv téléchargé/)).toBeTruthy())
    await waitFor(() => expect(telecharges).toHaveLength(1))
    expect(telecharges[0][0]).toContain('text/csv')
    expect(telecharges[0][1]).toContain('mobilite;2026-11-10')
    vi.restoreAllMocks()
  })
})
