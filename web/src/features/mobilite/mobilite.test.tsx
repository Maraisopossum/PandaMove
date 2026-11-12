// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))
vi.mock('../../core/images/usePandaVariante', () => ({ useImagePanda: () => null, usePandaVariante: () => 'female' }))

import { SEANCES_TYPES } from './donnees'
import { genererSeance } from './generer'
import ApercuMobiliteScreen from './ApercuMobiliteScreen'
import MobiliteScreen from './MobiliteScreen'
import { decouperEnPhases, dureePhases, PREPARATION_S } from './phases'
import { formaterChrono, formaterMinutes } from './presentation'
import SeanceMobiliteScreen from './SeanceMobiliteScreen'
import { ajouterSeance, bilanSemaine, ecrireChoix, ecrirePlan, lireChoix, lireHistorique, lirePlan } from './stockage'
import { useSeanceMobilite } from './useSeanceMobilite'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
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
    expect(lireChoix()).toEqual({ minutes: 10, zones: [], moment: 'libre', sport: null })
    ecrireChoix({ minutes: 20, zones: ['cou', 'hanches'], moment: 'avant', sport: 'velo' })
    expect(lireChoix()).toEqual({ minutes: 20, zones: ['cou', 'hanches'], moment: 'avant', sport: 'velo' })
    localStorage.setItem('pandamove.mobilite.choix', JSON.stringify({ minutes: 9999, zones: ['x', 'cou'], moment: 'nimporte', sport: 'golf' }))
    expect(lireChoix()).toEqual({ minutes: 10, zones: ['cou'], moment: 'libre', sport: null })
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

  it('historique et bilan de la semaine', () => {
    ajouterSeance({ date: '2026-11-10', dureeS: 600, exercices: 8, zones: ['hanches'], sport: 'course' })
    ajouterSeance({ date: '2026-11-06', dureeS: 300, exercices: 5, zones: [], sport: null })
    ajouterSeance({ date: '2026-10-01', dureeS: 900, exercices: 10, zones: [], sport: null })
    expect(lireHistorique()).toHaveLength(3)
    expect(bilanSemaine(lireHistorique(), new Date(2026, 10, 11))).toEqual({ seances: 2, minutes: 15 })
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
  it('déroule les phases au rythme de l’horloge, supporte pause et saut, enregistre la séance à la fin', () => {
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
    expect(lireHistorique()).toHaveLength(1)
    expect(lireHistorique()[0]).toMatchObject({ exercices: p.etapes.length, dureeS: p.dureeTotaleS })
    vi.useRealTimers()
  })

  it('sans séance, rien ne démarre', () => {
    const { result } = renderHook(() => useSeanceMobilite(null))
    expect(result.current.pret).toBe(false)
  })
})
