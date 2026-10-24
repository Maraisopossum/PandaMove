import { describe, expect, it } from 'vitest'
import { enregistrerDecision, lireProgression, marquerEvaluee, serialiserProgression } from './marqueur'

describe('lireProgression', () => {
  it('lit la forme stockée', () => {
    expect(lireProgression('{"evaluee":true,"decisions":{"e1":"acceptee","e2":"refusee","e3":"ajustee"}}')).toEqual({
      evaluee: true,
      decisions: { e1: 'acceptee', e2: 'refusee', e3: 'ajustee' },
    })
  })

  it('absent ou malformé : null, sans exception', () => {
    expect(lireProgression(null)).toBeNull()
    expect(lireProgression(undefined)).toBeNull()
    expect(lireProgression('')).toBeNull()
    expect(lireProgression('pas du json')).toBeNull()
    expect(lireProgression('[1,2]')).toBeNull()
    expect(lireProgression('{"decisions":{}}')).toBeNull()
    expect(lireProgression('{"evaluee":"oui","decisions":{}}')).toBeNull()
  })

  it('ignore les décisions invalides', () => {
    expect(lireProgression('{"evaluee":true,"decisions":{"e1":"peut-etre","e2":"acceptee"}}')).toEqual({
      evaluee: true,
      decisions: { e2: 'acceptee' },
    })
    expect(lireProgression('{"evaluee":true}')).toEqual({ evaluee: true, decisions: {} })
  })
})

describe('marquerEvaluee / enregistrerDecision', () => {
  it('marque évaluée en conservant les décisions', () => {
    expect(marquerEvaluee(null)).toEqual({ evaluee: true, decisions: {} })
    expect(marquerEvaluee({ evaluee: false, decisions: { e1: 'refusee' } })).toEqual({ evaluee: true, decisions: { e1: 'refusee' } })
  })

  it('enregistre une décision sans muter l’état d’origine', () => {
    const etat = { evaluee: true, decisions: { e1: 'acceptee' as const } }
    expect(enregistrerDecision(etat, 'e2', 'ajustee')).toEqual({ evaluee: true, decisions: { e1: 'acceptee', e2: 'ajustee' } })
    expect(etat.decisions).toEqual({ e1: 'acceptee' })
    expect(enregistrerDecision(null, 'e1', 'refusee')).toEqual({ evaluee: false, decisions: { e1: 'refusee' } })
  })

  it('sérialise dans la forme lue', () => {
    const etat = { evaluee: true, decisions: { e1: 'acceptee' as const } }
    expect(lireProgression(serialiserProgression(etat))).toEqual(etat)
    expect(serialiserProgression(marquerEvaluee(null))).toBe('{"evaluee":true,"decisions":{}}')
  })
})
