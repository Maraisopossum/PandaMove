import { describe, expect, it } from 'vitest'
import { enregistrerBase, enregistrerDecision, lireProgression, marquerEvaluee, retirerExercice, serialiserProgression, type BaseExercice } from './marqueur'

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

  it('lit la décision appliquee_auto (issue appliquée sans validation, ex. échec simple)', () => {
    expect(lireProgression('{"evaluee":true,"decisions":{"e1":"appliquee_auto"}}')).toEqual({
      evaluee: true,
      decisions: { e1: 'appliquee_auto' },
    })
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

// Bases d'évaluation (lot 29) : de quoi recalculer proprement la progression d'une séance corrigée
describe('bases d’évaluation par exercice', () => {
  const objectif = { chargeCible: 50, repsCible: 8, dureeCibleSec: null, compteurEchec: 1, nombreSeriesCible: null, derniereMaj: '2026-10-01' }
  const base: BaseExercice = {
    cible: { chargeKg: 50, reps: 8, dureeSec: null },
    avant: objectif,
    ecrit: { ...objectif, chargeCible: 52.5, compteurEchec: 0, derniereMaj: '2026-10-24' },
    proposition: { statut: 'SUCCES', chargeCible: 52.5, repsCible: 8, dureeCibleSec: null, compteurEchec: 0, nombreSeries: null, deload: false },
    seriesAvant: null,
    seriesApres: null,
  }

  it('enregistre une base sans muter l’état d’origine et la relit à l’identique', () => {
    const etat = { evaluee: true, decisions: { e1: 'acceptee' as const } }
    const suivant = enregistrerBase(etat, 'e1', base)
    expect(etat).toEqual({ evaluee: true, decisions: { e1: 'acceptee' } })
    expect(lireProgression(serialiserProgression(suivant))).toEqual({ evaluee: true, decisions: { e1: 'acceptee' }, bases: { e1: base } })
  })

  it('sans base, le JSON reste exactement celui d’avant (aucune clé « bases »)', () => {
    expect(serialiserProgression({ evaluee: true, decisions: {}, bases: {} })).toBe('{"evaluee":true,"decisions":{}}')
  })

  it('une base absente de l’objectif (avant = null) est lisible', () => {
    const sansAvant = { ...base, avant: null }
    expect(lireProgression(serialiserProgression(enregistrerBase(null, 'e1', sansAvant)))?.bases?.e1).toEqual(sansAvant)
  })

  it('ignore une base malformée sans rejeter le reste du marqueur', () => {
    const json = '{"evaluee":true,"decisions":{"e1":"acceptee"},"bases":{"e1":{"cible":1},"e2":"x"}}'
    expect(lireProgression(json)).toEqual({ evaluee: true, decisions: { e1: 'acceptee' } })
  })

  it('retirerExercice efface la décision ET la base de cet exercice seulement', () => {
    const etat = enregistrerBase(enregistrerBase({ evaluee: true, decisions: { e1: 'acceptee', e2: 'refusee' } }, 'e1', base), 'e2', base)
    const apres = retirerExercice(etat, 'e1')
    expect(apres.decisions).toEqual({ e2: 'refusee' })
    expect(Object.keys(apres.bases ?? {})).toEqual(['e2'])
  })
})
