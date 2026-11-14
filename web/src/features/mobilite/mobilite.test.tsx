// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTestDb } from '../../test/sqliteDb'

const base = createTestDb()
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))
vi.mock('../../core/images/usePandaVariante', () => ({ useImagePanda: () => null, usePandaVariante: () => 'female' }))

import { SEANCES_TYPES } from './donnees'
import { genererSeance } from './generer'
import ApercuMobiliteScreen from './ApercuMobiliteScreen'
import MobiliteScreen from './MobiliteScreen'
import { decouperEnPhases, dureePhases, PREPARATION_S } from './phases'
import { formaterChrono, formaterMinutes } from './presentation'
import SeanceMobiliteScreen from './SeanceMobiliteScreen'
import { enregistrerSeanceMobilite, lireSeancesMobilite } from '../../core/db/repos/mobilite'
import { bilanSemaine, ecrireChoix, ecrirePlan, lireChoix, lireHistorique, lirePlan } from './stockage'
import { useHistoriqueMobilite } from './useHistoriqueMobilite'
import { useSeanceMobilite } from './useSeanceMobilite'

beforeEach(async () => {
  localStorage.clear()
  sessionStorage.clear()
  await base.execute('DELETE FROM seances_mobilite')
})
afterEach(cleanup)

const plan = (minutes = 5) => genererSeance({ minutes, zones: ['hanches', 'chevilles'], moment: 'apres', graine: 4 })

describe('présentation', () => {
  it('formate les durées', () => {
    expect(formaterMinutes(600)).toBe('10 min')
    expect(formaterMinutes(615)).toBe('10 min 15 s')
    expect(formaterMinutes(45)).toBe('45 s')
    expect(formaterChrono(75)).toBe('1:15')
    expect(formaterChrono(9)).toBe('0:09')
  })
})

describe('phases', () => {
  it('découpe : préparation, côtés gauche et droite, transitions sauf après le dernier exercice ; le total égale la durée de la séance', () => {
    const p = plan(10)
    const phases = decouperEnPhases(p)
    expect(phases[0]).toMatchObject({ type: 'preparation', dureeS: PREPARATION_S })
    expect(phases.filter((x) => x.type === 'transition')).toHaveLength(p.etapes.length - 1)
    expect(phases.at(-1)?.type).toBe('exercice')
    const cotes = p.etapes.filter((e) => e.exercice.cote).length
    expect(phases.filter((x) => x.type === 'exercice' && x.cote === 'gauche')).toHaveLength(cotes)
    expect(phases.filter((x) => x.type === 'exercice' && x.cote === 'droite')).toHaveLength(cotes)
    // Séance = exercices + une transition entre chaque ; la dernière transition du plan est remplacée par la préparation
    expect(dureePhases(phases)).toBe(p.dureeTotaleS - 6 + PREPARATION_S)
  })
})

describe('stockage', () => {
  it('relit le choix, corrige les valeurs invalides', () => {
    const tous = ['mobilite', 'activation', 'etirement']
    expect(lireChoix()).toEqual({ minutes: 10, zones: [], moment: 'libre', sport: null, types: tous })
    ecrireChoix({ minutes: 20, zones: ['cou', 'hanches'], moment: 'avant', sport: 'velo', types: ['activation'] })
    expect(lireChoix()).toEqual({ minutes: 20, zones: ['cou', 'hanches'], moment: 'avant', sport: 'velo', types: ['activation'] })
    localStorage.setItem('pandamove.mobilite.choix', JSON.stringify({ minutes: 9999, zones: ['x', 'cou'], moment: 'nimporte', sport: 'golf', types: ['x'] }))
    expect(lireChoix()).toEqual({ minutes: 10, zones: ['cou'], moment: 'libre', sport: null, types: tous })
    localStorage.setItem('pandamove.mobilite.choix', 'pas du json')
    expect(lireChoix().minutes).toBe(10)
  })

  it('écrit et relit un plan par identifiants, ignore un exercice disparu', () => {
    const p = plan(10)
    ecrirePlan(p)
    expect(lirePlan()?.etapes.map((x) => [x.exercice.id, x.dureeS])).toEqual(p.etapes.map((x) => [x.exercice.id, x.dureeS]))
    sessionStorage.setItem('pandamove.mobilite.plan', JSON.stringify({ etapes: [{ id: 'inconnu', dureeS: 30 }] }))
    expect(lirePlan()).toBeNull()
  })

  it('bilan de la semaine', () => {
    const h = [
      { date: '2026-11-10', dureeS: 600, exercices: 8, zones: [], sport: 'course' as const },
      { date: '2026-11-06', dureeS: 300, exercices: 5, zones: [], sport: null },
      { date: '2026-10-01', dureeS: 900, exercices: 10, zones: [], sport: null },
    ]
    expect(bilanSemaine(h, new Date(2026, 10, 11))).toEqual({ seances: 2, minutes: 15 })
  })
})

describe('historique synchronisé', () => {
  it('relit les séances en base, les plus récentes d’abord', async () => {
    await enregistrerSeanceMobilite(base, { date: '2026-11-06', dureeS: 300, exercices: 5, zones: [], sport: null })
    await enregistrerSeanceMobilite(base, { date: '2026-11-10', dureeS: 600, exercices: 8, zones: ['hanches', 'zone-inconnue'], sport: 'course' })
    const { result } = renderHook(() => useHistoriqueMobilite({ userId: 'u1' }))
    await waitFor(() => expect(result.current).toHaveLength(2))
    expect(result.current[0]).toEqual({ date: '2026-11-10', dureeS: 600, exercices: 8, zones: ['hanches'], sport: 'course' })
  })

  it('reprend une fois l’historique du navigateur, sans doublon, puis l’efface', async () => {
    const ancien = [
      { date: '2026-11-10', dureeS: 600, exercices: 8, zones: ['hanches'], sport: 'course' },
      { date: '2026-11-10', dureeS: 600, exercices: 8, zones: ['hanches'], sport: 'course' },
      { date: 'pas une date', dureeS: 600, exercices: 8, zones: [], sport: null },
    ]
    localStorage.setItem('pandamove.mobilite.historique', JSON.stringify(ancien))
    const premier = renderHook(() => useHistoriqueMobilite({ userId: 'u1' }))
    // Deux séances identiques le même jour restent deux séances ; la ligne invalide est ignorée
    await waitFor(() => expect(premier.result.current).toHaveLength(2))
    expect(lireHistorique()).toEqual([])
    // Reprise rejouée (stockage restauré) : aucun doublon
    localStorage.setItem('pandamove.mobilite.historique', JSON.stringify(ancien))
    const second = renderHook(() => useHistoriqueMobilite({ userId: 'u1' }))
    await waitFor(() => expect(lireHistorique()).toEqual([]))
    expect(second.result.current).toHaveLength(2)
    expect(await lireSeancesMobilite(base)).toHaveLength(2)
  })

  it('refuse une séance qui violerait les contraintes du serveur', async () => {
    expect(await enregistrerSeanceMobilite(base, { date: '2026-11-10', dureeS: 0, exercices: 3, zones: [], sport: null })).toBeNull()
    expect(await enregistrerSeanceMobilite(base, { date: '10/11/2026', dureeS: 60, exercices: 3, zones: [], sport: null })).toBeNull()
    expect(await enregistrerSeanceMobilite(base, { date: '2026-11-10', dureeS: 60, exercices: 0, zones: [], sport: null })).toBeNull()
    expect(await lireSeancesMobilite(base)).toHaveLength(0)
  })
})

describe('MobiliteScreen', () => {
  const monter = () =>
    render(
      <MemoryRouter initialEntries={['/mobility']}>
        <Routes>
          <Route path="/mobility" element={<MobiliteScreen />} />
          <Route path="/mobility/apercu" element={<ApercuMobiliteScreen />} />
          <Route path="/mobility/seance" element={<SeanceMobiliteScreen />} />
        </Routes>
      </MemoryRouter>,
    )

  it('une séance type remplit les zones et le moment ; retoucher une zone la détache du sport', () => {
    monter()
    const course = SEANCES_TYPES.find((s) => s.id === 'course')!
    fireEvent.click(screen.getByRole('button', { name: /Course à pied/ }))
    expect(screen.getByRole('button', { name: /Course à pied/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Hanches' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Après le sport' }).getAttribute('aria-pressed')).toBe(course.moment === 'apres' ? 'true' : 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Cou' }))
    expect(screen.getByRole('button', { name: /Course à pied/ }).getAttribute('aria-pressed')).toBe('false')
    expect(lireChoix().zones).toContain('cou')
  })

  it('choisit le temps, génère la séance, l’aperçu la montre, on peut la commencer', () => {
    monter()
    fireEvent.click(screen.getByRole('button', { name: '15 minutes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hanches' }))
    fireEvent.click(screen.getByRole('button', { name: 'Générer ma séance de 15 min' }))
    expect(screen.getByRole('heading', { name: 'Votre séance' })).toBeTruthy()
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3)
    fireEvent.click(screen.getAllByRole('button', { name: /Remplacer/ })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Commencer' }))
    expect(screen.getByRole('timer', { name: 'Temps restant' })).toBeTruthy()
    expect(screen.getByText('Préparez-vous')).toBeTruthy()
  })

  it('sans séance préparée, l’aperçu propose d’en préparer une', () => {
    render(
      <MemoryRouter initialEntries={['/mobility/apercu']}>
        <Routes>
          <Route path="/mobility/apercu" element={<ApercuMobiliteScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Préparer une séance' })).toBeTruthy()
  })
})

describe('useSeanceMobilite', () => {
  it('déroule les phases au rythme de l’horloge, supporte pause et saut, enregistre la séance à la fin', async () => {
    vi.useFakeTimers()
    let t = 0
    const p = plan(5)
    const { result } = renderHook(() => useSeanceMobilite(p, { maintenant: () => t, intervalleMs: 100 }))
    const avancer = (ms: number) =>
      act(() => {
        t += ms
        vi.advanceTimersByTime(ms)
      })

    expect(result.current.phase?.type).toBe('preparation')
    avancer(PREPARATION_S * 1000 + 200)
    expect(result.current.phase?.type).toBe('exercice')
    expect(result.current.numeroEtape).toBe(1)

    // Pause : le temps ne s'écoule plus
    act(() => result.current.basculerPause())
    const restant = result.current.restantS
    avancer(20_000)
    expect(result.current.restantS).toBe(restant)
    act(() => result.current.basculerPause())

    // Saut à l'exercice suivant
    act(() => result.current.suivant())
    expect(result.current.numeroEtape).toBe(2)

    // Jusqu'à la fin : la séance est enregistrée une fois
    for (let i = 0; i < 40 && !result.current.termine; i++) act(() => result.current.suivant())
    expect(result.current.termine).toBe(true)
    vi.useRealTimers()
    await waitFor(async () => expect(await lireSeancesMobilite(base)).toHaveLength(1))
    expect((await lireSeancesMobilite(base))[0]).toMatchObject({ exercices: p.etapes.length, dureeS: p.dureeTotaleS })
  })

  it('sans séance, rien ne démarre', () => {
    const { result } = renderHook(() => useSeanceMobilite(null))
    expect(result.current.pret).toBe(false)
  })
})
