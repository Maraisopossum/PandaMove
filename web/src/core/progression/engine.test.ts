import { describe, expect, it } from 'vitest'
import fixtures from './__fixtures__/engine.json'
import {
  calculerIncrementQualitatif,
  evaluerExercice,
  proposerMontee,
  requiresValidation,
  serieReussie,
  type CibleExercice,
  type ExerciceConfig,
  type PropositionProgression,
  type SerieEvaluee,
  type StatutExercice,
} from './engine'
import type { TypeExercice } from '../db/types'

interface Cas {
  nom: string
  origine: 'test-kotlin' | 'source'
  fonction: 'evaluerExercice' | 'calculerIncrementQualitatif' | 'requiresValidation' | 'serieReussie' | 'proposerMontee'
  entree: unknown
  attendu: unknown
}

interface EntreeEvaluation {
  config: Partial<ExerciceConfig>
  cible: CibleExercice
  compteurEchecActuel: number
  series: Partial<SerieEvaluee>[]
  isBilateral: boolean
  pasMateriel?: number
  chargesAtteignables?: number[]
}

interface EntreeMontee {
  config: Partial<ExerciceConfig>
  cible: CibleExercice
  compteurEchecActuel: number
  pasMateriel?: number
  chargesAtteignables?: number[]
  repsReellementAtteintes?: number
}

interface EntreeIncrement {
  chargeActuelle: number
  typeExercice: TypeExercice | null
  incrementPctOverride: number | null
  pasMateriel: number | null
  chargesAtteignables: number[] | null
  incrementKgManuel: number | null
}

// Équivalents des helpers config() et serie() du test Kotlin.
const configDe = (surcharges: Partial<ExerciceConfig>): ExerciceConfig =>
  ({ ...fixtures.configParDefaut, ...surcharges }) as ExerciceConfig
const serieDe = (s: Partial<SerieEvaluee>): SerieEvaluee => ({
  repsRealisees: null,
  chargeKg: null,
  rpe: null,
  notes: '',
  ...s,
})
const propositionDe = (p: { statut: StatutExercice; deload: boolean }): PropositionProgression => ({
  nouvelleChargeCible: null,
  nouveauRepsCible: null,
  nouvelleDureeCible: null,
  nouveauCompteurEchec: 0,
  nouveauNombreSeries: null,
  ...p,
})

function executer(cas: Cas): unknown {
  switch (cas.fonction) {
    case 'evaluerExercice': {
      const e = cas.entree as EntreeEvaluation
      return evaluerExercice(
        configDe(e.config),
        e.cible,
        e.compteurEchecActuel,
        e.series.map(serieDe),
        e.isBilateral,
        e.pasMateriel,
        e.chargesAtteignables,
      )
    }
    case 'proposerMontee': {
      const e = cas.entree as EntreeMontee
      return proposerMontee(
        configDe(e.config),
        e.cible,
        e.compteurEchecActuel,
        e.pasMateriel,
        e.chargesAtteignables,
        e.repsReellementAtteintes,
      )
    }
    case 'serieReussie': {
      const e = cas.entree as { config: Partial<ExerciceConfig>; cible: CibleExercice; serie: Partial<SerieEvaluee> }
      return serieReussie(configDe(e.config), e.cible, serieDe(e.serie))
    }
    case 'calculerIncrementQualitatif': {
      const e = cas.entree as EntreeIncrement
      return calculerIncrementQualitatif(
        e.chargeActuelle,
        e.typeExercice,
        e.incrementPctOverride,
        e.pasMateriel,
        e.chargesAtteignables,
        e.incrementKgManuel,
      )
    }
    case 'requiresValidation':
      return (cas.entree as { statut: StatutExercice; deload: boolean }[]).map((p) =>
        requiresValidation(propositionDe(p)),
      )
  }
}

const tousLesCas = fixtures.cas as Cas[]

describe('ProgressionEngine (fixtures partagées avec Kotlin)', () => {
  it('reprend les 30 tests de ProgressionEngineTest.kt', () => {
    expect(tousLesCas.filter((c) => c.origine === 'test-kotlin')).toHaveLength(30)
  })

  it.each(tousLesCas)('$origine : $nom', (cas) => {
    expect(executer(cas)).toEqual(cas.attendu)
  })

  // Piège KNOWN_BUGS : un deload peut accompagner un statut d'échec, il ne doit jamais être persisté
  // silencieusement.
  it('requiresValidation reste vrai pour un deload accompagnant un statut ECHEC', () => {
    expect(requiresValidation(propositionDe({ statut: 'ECHEC', deload: true }))).toBe(true)
  })
})
