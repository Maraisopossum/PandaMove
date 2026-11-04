import { describe, expect, it } from 'vitest'
import { formaterDateHistorique, formaterDuree, MESSAGES_PANDA, messagePandaAuHasard } from './presentation'

describe('formaterDuree', () => {
  it.each([[0, '—'], [-3, '—'], [45, '45 s'], [60, '1 min 00'], [65, '1 min 05'], [300, '5 min 00'], [3725, '62 min 05']])('%i s -> %s', (s, attendu) => {
    expect(formaterDuree(s)).toBe(attendu)
  })
})

describe('formaterDateHistorique', () => {
  it('écrit le jour enregistré, quel que soit le fuseau', () => {
    expect(formaterDateHistorique('2026-11-04')).toMatch(/^4 nov\.? 2026$/)
    expect(formaterDateHistorique('2026-01-01')).toMatch(/^1(er)? janv\.? 2026$/)
  })
  it('renvoie le texte tel quel s’il n’est pas une date', () => {
    expect(formaterDateHistorique('hier')).toBe('hier')
  })
})

describe('messagePandaAuHasard', () => {
  it('choisit dans la liste, bornes comprises', () => {
    expect(messagePandaAuHasard(() => 0)).toBe(MESSAGES_PANDA[0])
    expect(messagePandaAuHasard(() => 0.9999)).toBe(MESSAGES_PANDA[MESSAGES_PANDA.length - 1])
    expect(messagePandaAuHasard(() => 1)).toBe(MESSAGES_PANDA[MESSAGES_PANDA.length - 1])
  })
})
