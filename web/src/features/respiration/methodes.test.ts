import { describe, expect, it } from 'vitest'
import {
  configDe, cyclesEffectifs, depuisMethodePerso, descriptionAuto, METHODES_INTEGREES, minutesParDefaut, trouverIntegree,
} from './methodes'
import { dureeCycleMs, dureeTotaleMs } from './moteur'

const methode = (id: string) => {
  const m = trouverIntegree(id)
  if (!m) throw new Error(`méthode ${id} absente`)
  return m
}

describe('méthodes intégrées', () => {
  it('reprennent les quatre méthodes de l’application Android, dans le même ordre', () => {
    expect(METHODES_INTEGREES.map((m) => m.id)).toEqual(['coherence_cardiaque', '4_7_8', 'box_breathing', 'wim_hof'])
    expect(METHODES_INTEGREES.every((m) => !m.personnalisee)).toBe(true)
  })

  it('ont des identifiants et des noms uniques', () => {
    expect(new Set(METHODES_INTEGREES.map((m) => m.id)).size).toBe(4)
    expect(new Set(METHODES_INTEGREES.map((m) => m.nom)).size).toBe(4)
  })

  it('donnent les durées d’origine, Wim Hof compris (1,5 s)', () => {
    expect(configDe(methode('coherence_cardiaque'))).toEqual({ inspireMs: 5000, retentionPleineMs: 0, expireMs: 5000, retentionVideMs: 0, cycles: 30 })
    expect(configDe(methode('4_7_8'))).toEqual({ inspireMs: 4000, retentionPleineMs: 7000, expireMs: 8000, retentionVideMs: 0, cycles: 4 })
    expect(configDe(methode('box_breathing'))).toEqual({ inspireMs: 4000, retentionPleineMs: 4000, expireMs: 4000, retentionVideMs: 4000, cycles: 6 })
    expect(configDe(methode('wim_hof'))).toEqual({ inspireMs: 1500, retentionPleineMs: 0, expireMs: 1500, retentionVideMs: 15_000, cycles: 30 })
  })

  it('durent 5 min pour la cohérence cardiaque (30 cycles de 10 s)', () => {
    expect(dureeTotaleMs(configDe(methode('coherence_cardiaque')))).toBe(300_000)
  })

  it('remplacent le nombre de cycles sans toucher aux durées', () => {
    expect(configDe(methode('4_7_8'), 10)).toMatchObject({ cycles: 10, inspireMs: 4000 })
  })
})

describe('méthodes personnalisées', () => {
  const perso = { id: 'u1', nom: 'Calme', emoji: '🌙', inspireSec: 4, retentionPleineSec: 7, expireSec: 8, retentionVideSec: 0, cyclesDefaut: 4 }

  it('se convertissent en méthode avec une description générée', () => {
    expect(depuisMethodePerso(perso)).toMatchObject({ id: 'u1', personnalisee: true, description: '4s · 7s · 8s — 4 cycles' })
  })

  it('génèrent une description sans les phases inactives', () => {
    expect(descriptionAuto({ ...perso, retentionPleineSec: 0, retentionVideSec: 0, cyclesDefaut: 6 })).toBe('4s · 8s — 6 cycles')
    expect(descriptionAuto({ ...perso, retentionVideSec: 2 })).toBe('4s · 7s · 8s · 2s — 4 cycles')
  })
})

describe('durée choisie', () => {
  it('donne la durée par défaut en minutes, arrondie vers le bas, au moins 1', () => {
    expect(minutesParDefaut(methode('coherence_cardiaque'))).toBe(5)
    expect(minutesParDefaut(methode('4_7_8'))).toBe(1) // 76 s
    expect(minutesParDefaut(methode('box_breathing'))).toBe(1) // 96 s
    expect(minutesParDefaut(methode('wim_hof'))).toBe(9)
  })

  it('garde le nombre de cycles choisi, borné', () => {
    const m = methode('4_7_8')
    expect(cyclesEffectifs(m, 'cycles', 7)).toBe(7)
    expect(cyclesEffectifs(m, 'cycles', 0)).toBe(1)
    expect(cyclesEffectifs(m, 'cycles', 5000)).toBe(1000)
  })

  it('convertit des minutes en cycles entiers sans dépasser la durée demandée', () => {
    const m = methode('coherence_cardiaque') // cycle de 10 s
    expect(cyclesEffectifs(m, 'minutes', 5)).toBe(30)
    expect(dureeCycleMs(configDe(m)) * cyclesEffectifs(m, 'minutes', 5)).toBeLessThanOrEqual(5 * 60_000)
    const q = methode('4_7_8') // cycle de 19 s : 1 min = 3 cycles (57 s)
    expect(cyclesEffectifs(q, 'minutes', 1)).toBe(3)
  })

  it('joue au moins un cycle même si la durée demandée est plus courte qu’un cycle', () => {
    const lent = { ...methode('4_7_8'), inspireSec: 60, expireSec: 60, retentionPleineSec: 60 }
    expect(cyclesEffectifs(lent, 'minutes', 1)).toBe(1)
  })
})
