import { describe, expect, it } from 'vitest'
import type { SerieRealisee } from '../../../core/db/types'
import type { PropositionProgression } from '../../../core/progression/engine'
import {
  chargesAtteignablesExercice, cibleDepuis, cibleInitiale, formaterDureeBilan, formaterTonnage, lireListeEquipement, objectifDejaApplique,
  objectifApresDecision, parseChargeKg, pasMaterielExercice, resumerSeance, texteProposition,
} from './bilan'

const serie = (champs: Partial<SerieRealisee>): SerieRealisee => ({
  id: 's', instanceSeanceId: 'i1', exerciceSeanceId: 'e1', numeroSerie: 1, repsRealisees: 10, chargeKg: 60,
  chargeLabel: null, rpe: null, notes: '', isCompleted: true, updatedAt: 'u', ...champs,
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

describe('cible initiale (InstanceExecuteViewModel.cibleDepuis)', () => {
  it('REPS : charge du libellé, reps si entier', () => {
    expect(cibleInitiale({ repsType: 'REPS', repsCibles: '8', chargeCible: '60 kg' })).toEqual({ chargeKg: 60, reps: 8, dureeSec: null })
    expect(cibleInitiale({ repsType: 'REPS', repsCibles: '8-10', chargeCible: '17.5 kg' })).toEqual({ chargeKg: 17.5, reps: null, dureeSec: null })
    expect(cibleInitiale({ repsType: 'REPS', repsCibles: '12', chargeCible: 'PDC' })).toEqual({ chargeKg: null, reps: 12, dureeSec: null })
  })

  it('DURATION : durée seule', () => {
    expect(cibleInitiale({ repsType: 'DURATION', repsCibles: '45', chargeCible: '10 kg' })).toEqual({ chargeKg: null, reps: null, dureeSec: 45 })
  })

  it("l'objectif persisté prime sur le modèle", () => {
    const objectif = {
      id: 'o', seanceId: 's1', exerciseId: 'x1', chargeCible: 50, repsCible: 6, dureeCibleSec: null, compteurEchec: 1,
      derniereMaj: null, nombreSeriesCible: null, updatedAt: 'u',
    }
    expect(cibleDepuis(objectif, { repsType: 'REPS', repsCibles: '8', chargeCible: '60 kg' })).toEqual({ chargeKg: 50, reps: 6, dureeSec: null })
  })

  it('parseChargeKg suit parseChargeKg(parseChargeLabel()) Android', () => {
    expect(parseChargeKg('60 kg')).toBe(60)
    expect(parseChargeKg(' 22.5 kg ')).toBe(22.5)
    expect(parseChargeKg('')).toBeNull()
    expect(parseChargeKg('Poids corps')).toBeNull()
    expect(parseChargeKg('Elastique')).toBeNull()
    // Virgule : non reconnue par toFloatOrNull Kotlin
    expect(parseChargeKg('17,5 kg')).toBeNull()
    expect(parseChargeKg('lourd')).toBeNull()
  })
})

describe('matériel', () => {
  it('lit la liste JSON des équipements, défensivement', () => {
    expect(lireListeEquipement('["Barre","Banc plat"]')).toEqual(['Barre', 'Banc plat'])
    expect(lireListeEquipement('pas du json')).toEqual([])
    expect(lireListeEquipement('{"a":1}')).toEqual([])
  })

  it('pas matériel : plus petit pas des catégories de l’exercice, MACHINE 5 kg par défaut (PAS_DEFAUT)', () => {
    expect(pasMaterielExercice(['Machine guidée'], {})).toBe(5)
    expect(pasMaterielExercice(['Machine guidée'], { MACHINE: 2 })).toBe(2)
    expect(pasMaterielExercice(['Barre', 'Câble'], { BARRE: 2.5, CABLE: 1.25 })).toBe(1.25)
    expect(pasMaterielExercice(['Barre'], {})).toBeNull()
  })

  it('charges atteignables : undefined quand l’inventaire ne compose rien (repli sur le pas)', () => {
    const vide = { halteres: { poidsFixes: [], chargeable: null }, barre: null, kettlebell: null, cable: null }
    expect(chargesAtteignablesExercice(['Barre'], vide)).toBeUndefined()
    expect(chargesAtteignablesExercice(['Barre'], { ...vide, barre: { barreKg: 20, disques: { '1.25': 2 } } })).toEqual([20, 22.5])
  })
})

describe('objectifDejaApplique', () => {
  it('compare horodatages complets', () => {
    expect(objectifDejaApplique('2026-10-24T11:00:00.000Z', '2026-10-24T11:00:00.000Z')).toBe(true)
    expect(objectifDejaApplique('2026-10-24T12:00:00.000Z', '2026-10-24T11:00:00.000Z')).toBe(true)
    expect(objectifDejaApplique('2026-10-24T10:00:00.000Z', '2026-10-24T11:00:00.000Z')).toBe(false)
  })

  it('date seule (objectif importé d’Android, LocalDate) : comparée au jour de fin', () => {
    expect(objectifDejaApplique('2026-10-24', '2026-10-24T11:00:00')).toBe(true)
    expect(objectifDejaApplique('2026-10-23', '2026-10-24T11:00:00')).toBe(false)
  })

  it('sans date : jamais appliqué', () => {
    expect(objectifDejaApplique(null, '2026-10-24T11:00:00.000Z')).toBe(false)
  })
})

describe('objectifApresDecision', () => {
  const ctx = {
    seanceId: 's1', exerciseId: 'x1', completedAt: '2026-10-24T11:00:00.000Z', cible: { chargeKg: 60, reps: 8, dureeSec: null },
  }

  it('Oui : la proposition, charge rendue lisible', () => {
    const o = objectifApresDecision({ type: 'accepter' }, proposition({ nouvelleChargeCible: 17.69999885559082 }), null, ctx, '2026-10-24T12:00:00.000Z')
    expect(o).toEqual({
      seanceId: 's1', exerciseId: 'x1', chargeCible: 17.7, repsCible: 8, dureeCibleSec: null, compteurEchec: 0,
      derniereMaj: '2026-10-24T12:00:00.000Z', nombreSeriesCible: null,
    })
  })

  it('Ajuster : la charge choisie avec le reste de la proposition', () => {
    const o = objectifApresDecision({ type: 'ajuster', chargeKg: 61 }, proposition({ nouveauNombreSeries: 4 }), null, ctx, '2026-10-24T12:00:00.000Z')
    expect(o).toMatchObject({ chargeCible: 61, repsCible: 8, compteurEchec: 0, nombreSeriesCible: 4 })
  })

  it('Non : cible existante conservée, compteur de la proposition (Android), séries cibles effacées', () => {
    const existant = {
      id: 'o', seanceId: 's1', exerciseId: 'x1', chargeCible: 50, repsCible: 6, dureeCibleSec: null, compteurEchec: 2,
      derniereMaj: '2026-10-01', nombreSeriesCible: 4, updatedAt: 'u',
    }
    const o = objectifApresDecision({ type: 'refuser' }, proposition({ deload: true, statut: 'ECHEC_MARQUE', nouvelleChargeCible: 45 }), existant, ctx, '2026-10-24T12:00:00.000Z')
    expect(o).toMatchObject({ chargeCible: 50, repsCible: 6, dureeCibleSec: null, compteurEchec: 0, nombreSeriesCible: null })
  })

  it('Non sans objectif existant : la cible courante (modèle) est conservée', () => {
    const o = objectifApresDecision({ type: 'refuser' }, proposition(), null, ctx, '2026-10-24T12:00:00.000Z')
    expect(o).toMatchObject({ chargeCible: 60, repsCible: 8, dureeCibleSec: null, compteurEchec: 0 })
  })

  it('derniere_maj jamais antérieure à la fin de séance (horloges décalées entre appareils)', () => {
    const o = objectifApresDecision({ type: 'accepter' }, proposition(), null, ctx, '2026-10-24T10:00:00.000Z')
    expect(o.derniereMaj).toBe('2026-10-24T11:00:00.000Z')
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
