import { describe, expect, it } from 'vitest'
import {
  avancement, dureeCycleMs, dureeTotaleMs, echelleCercle, etatA, phasesActives, secondesRestantes, type ConfigSession,
} from './moteur'

const COHERENCE: ConfigSession = { inspireMs: 5000, retentionPleineMs: 0, expireMs: 5000, retentionVideMs: 0, cycles: 3 }
const BOITE: ConfigSession = { inspireMs: 4000, retentionPleineMs: 4000, expireMs: 4000, retentionVideMs: 4000, cycles: 2 }
const QUATRE_SEPT_HUIT: ConfigSession = { inspireMs: 4000, retentionPleineMs: 7000, expireMs: 8000, retentionVideMs: 0, cycles: 4 }

describe('phases et durées', () => {
  it('ignore les rétentions de durée nulle', () => {
    expect(phasesActives(COHERENCE).map((p) => p.phase)).toEqual(['inspire', 'expire'])
    expect(phasesActives(QUATRE_SEPT_HUIT).map((p) => p.phase)).toEqual(['inspire', 'retention_pleine', 'expire'])
  })

  it('garde l’ordre inspiration → rétention pleine → expiration → rétention vide', () => {
    expect(phasesActives(BOITE).map((p) => p.phase)).toEqual(['inspire', 'retention_pleine', 'expire', 'retention_vide'])
  })

  it('calcule la durée d’un cycle et de la séance', () => {
    expect(dureeCycleMs(QUATRE_SEPT_HUIT)).toBe(19_000)
    expect(dureeTotaleMs(QUATRE_SEPT_HUIT)).toBe(76_000)
    expect(dureeTotaleMs(COHERENCE)).toBe(30_000)
  })
})

describe('etatA', () => {
  it('démarre sur l’inspiration du premier cycle', () => {
    expect(etatA(COHERENCE, 0)).toEqual({ phase: 'inspire', progressionMs: 0, dureePhaseMs: 5000, cycle: 1, cyclesTotal: 3, termine: false })
  })

  it('reste dans la phase jusqu’à sa dernière milliseconde, puis passe à la suivante pile à la durée', () => {
    expect(etatA(COHERENCE, 4999)).toMatchObject({ phase: 'inspire', progressionMs: 4999 })
    expect(etatA(COHERENCE, 5000)).toMatchObject({ phase: 'expire', progressionMs: 0 })
  })

  it('passe au cycle suivant à la fin de la dernière phase', () => {
    expect(etatA(COHERENCE, 9999)).toMatchObject({ phase: 'expire', cycle: 1, progressionMs: 4999 })
    expect(etatA(COHERENCE, 10_000)).toMatchObject({ phase: 'inspire', cycle: 2, progressionMs: 0 })
    expect(etatA(COHERENCE, 20_000)).toMatchObject({ phase: 'inspire', cycle: 3 })
  })

  it('traverse les quatre phases d’un cycle en boîte', () => {
    const phases = [0, 4000, 8000, 12_000].map((t) => etatA(BOITE, t).phase)
    expect(phases).toEqual(['inspire', 'retention_pleine', 'expire', 'retention_vide'])
    expect(etatA(BOITE, 16_000)).toMatchObject({ phase: 'inspire', cycle: 2 })
  })

  it('termine exactement à la durée totale, figé sur la fin de la dernière phase', () => {
    expect(etatA(COHERENCE, 29_999)).toMatchObject({ termine: false, cycle: 3, phase: 'expire' })
    expect(etatA(COHERENCE, 30_000)).toEqual({
      phase: 'expire', progressionMs: 5000, dureePhaseMs: 5000, cycle: 3, cyclesTotal: 3, termine: true,
    })
    expect(etatA(COHERENCE, 999_999)).toMatchObject({ termine: true, cycle: 3 })
  })

  it('termine sur la rétention vide quand la méthode en a une', () => {
    expect(etatA(BOITE, 32_000)).toMatchObject({ termine: true, phase: 'retention_vide', cycle: 2 })
  })

  it('traite un temps négatif comme le début', () => {
    expect(etatA(COHERENCE, -50)).toMatchObject({ phase: 'inspire', progressionMs: 0, cycle: 1 })
  })

  it('gère des durées non multiples d’un pas de 100 ms', () => {
    const wim: ConfigSession = { inspireMs: 1500, retentionPleineMs: 0, expireMs: 1500, retentionVideMs: 15_000, cycles: 30 }
    expect(etatA(wim, 1500)).toMatchObject({ phase: 'expire', progressionMs: 0 })
    expect(etatA(wim, 3000)).toMatchObject({ phase: 'retention_vide', progressionMs: 0 })
    expect(etatA(wim, 18_000)).toMatchObject({ phase: 'inspire', cycle: 2 })
  })

  it('refuse une configuration sans durée ou sans cycle', () => {
    expect(() => etatA({ ...COHERENCE, inspireMs: 0, expireMs: 0 }, 0)).toThrow()
    expect(() => etatA({ ...COHERENCE, cycles: 0 }, 0)).toThrow()
  })
})

describe('affichage', () => {
  it('donne l’avancement dans la phase, borné entre 0 et 1', () => {
    expect(avancement(etatA(COHERENCE, 2500))).toBeCloseTo(0.5)
    expect(avancement(etatA(COHERENCE, 30_000))).toBe(1)
  })

  it('fait grandir le cercle à l’inspiration, le garde plein en rétention, le vide à l’expiration', () => {
    expect(echelleCercle('inspire', 0)).toBe(0)
    expect(echelleCercle('inspire', 0.25)).toBe(0.25)
    expect(echelleCercle('retention_pleine', 0.7)).toBe(1)
    expect(echelleCercle('expire', 0.25)).toBe(0.75)
    expect(echelleCercle('retention_vide', 0.7)).toBe(0)
  })

  it('arrondit les secondes restantes au-dessus', () => {
    expect(secondesRestantes(etatA(COHERENCE, 0))).toBe(5)
    expect(secondesRestantes(etatA(COHERENCE, 100))).toBe(5)
    expect(secondesRestantes(etatA(COHERENCE, 4100))).toBe(1)
    expect(secondesRestantes(etatA(COHERENCE, 30_000))).toBe(0)
  })
})
