import { describe, expect, it } from 'vitest'
import type { SerieRealisee } from '../../../core/db/types'
import type { PropositionProgression } from '../../../core/progression/engine'
import { formaterDureeBilan, formaterTonnage, resumerSeance, texteProposition } from './bilan'

const serie = (champs: Partial<SerieRealisee>): SerieRealisee => ({
  id: 's', instanceSeanceId: 'i1', exerciceSeanceId: 'e1', numeroSerie: 1, repsRealisees: 10, chargeKg: 60,
  chargeLabel: null, rpe: null, notes: '', isCompleted: true, updatedAt: 'u', validatedAt: null, ...champs,
})

const proposition = (champs: Partial<PropositionProgression> = {}): PropositionProgression => ({
  statut: 'SUCCES', nouvelleChargeCible: 62.5, nouveauRepsCible: 8, nouvelleDureeCible: null, nouveauCompteurEchec: 0,
  deload: false, nouveauNombreSeries: null, ...champs,
})

describe('resumerSeance', () => {
  it('tonnage = Σ reps × charge des séries terminées hors DURATION ; séries = toutes les séries terminées', () => {
    const exercices = [
      { id: 'e1', repsType: 'REPS' as const },
      { id: 'e2', repsType: 'DURATION' as const },
    ]
    const series = [
      serie({ id: 'a', exerciceSeanceId: 'e1', repsRealisees: 10, chargeKg: 60 }),
      serie({ id: 'b', exerciceSeanceId: 'e1', numeroSerie: 2, repsRealisees: 8, chargeKg: 62.5 }),
      serie({ id: 'c', exerciceSeanceId: 'e1', numeroSerie: 3, repsRealisees: 5, chargeKg: 60, isCompleted: false }),
      // DURATION : 60 s lestées de 10 kg ne comptent pas dans le tonnage
      serie({ id: 'd', exerciceSeanceId: 'e2', repsRealisees: 60, chargeKg: 10 }),
      serie({ id: 'e', exerciceSeanceId: 'e1', numeroSerie: 4, repsRealisees: 12, chargeKg: null }),
    ]
    expect(resumerSeance(exercices, series, 2730)).toEqual({ tonnageKg: 1100, seriesTotal: 4, dureeSec: 2730 })
  })
})

describe('formats', () => {
  it('durée : mm:ss sous une heure, « h mm » au-delà', () => {
    expect(formaterDureeBilan(2730)).toBe('45:30')
    expect(formaterDureeBilan(0)).toBe('00:00')
    expect(formaterDureeBilan(3900)).toBe('1 h 05')
  })

  it('tonnage : kg sous une tonne, t au-delà', () => {
    expect(formaterTonnage(1100)).toBe('1,1 t')
    expect(formaterTonnage(487.5)).toBe('488 kg')
  })
})

describe('texteProposition', () => {
  it('formate charge et reps à la française', () => {
    expect(texteProposition(proposition({ nouvelleChargeCible: 17.69999885559082, nouveauRepsCible: 8 }))).toBe('Proposer 8 reps à 17,7 kg')
    expect(texteProposition(proposition({ nouveauRepsCible: null, nouvelleChargeCible: 45 }))).toBe('Proposer 45 kg')
    expect(texteProposition(proposition({ nouvelleChargeCible: null, nouveauRepsCible: 9 }))).toBe('Proposer 9 reps')
    expect(texteProposition(proposition({ nouvelleDureeCible: 50 }))).toBe('Proposer 50 s')
    expect(texteProposition(proposition({ nouveauNombreSeries: 4, nouveauRepsCible: 8 }))).toBe('Proposer +1 série (4) — reps remis à 8')
  })
})
