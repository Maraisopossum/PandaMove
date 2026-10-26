import { describe, expect, it } from 'vitest'
import type { PropositionProgression } from '../../../core/progression/engine'
import {
  chargesAtteignablesExercice, cibleDepuis, cibleInitiale, dateLocale, lireListeEquipement, objectifApresDecision,
  parseChargeKg, pasMaterielExercice,
} from './cible'

const proposition = (champs: Partial<PropositionProgression> = {}): PropositionProgression => ({
  statut: 'SUCCES', nouvelleChargeCible: 62.5, nouveauRepsCible: 8, nouvelleDureeCible: null, nouveauCompteurEchec: 0,
  deload: false, nouveauNombreSeries: null, ...champs,
})

describe('dateLocale (derniere_maj, LocalDate Android)', () => {
  it('donne la date LOCALE, pas la date UTC, autour de minuit', () => {
    // Construits en heure locale : valables quel que soit le fuseau de la machine de test
    expect(dateLocale(new Date(2026, 9, 20, 23, 30).getTime())).toBe('2026-10-20')
    expect(dateLocale(new Date(2026, 9, 21, 0, 30).getTime())).toBe('2026-10-21')
    expect(dateLocale(new Date(2026, 0, 5, 12, 0).getTime())).toBe('2026-01-05')
  })

  it('diffère de la tranche UTC quand le fuseau franchit minuit', () => {
    const ms = new Date(2026, 9, 21, 0, 30).getTime()
    const decalageMin = new Date(ms).getTimezoneOffset()
    const attenduUtc = decalageMin < -30 ? '2026-10-20' : '2026-10-21'
    expect(new Date(ms).toISOString().slice(0, 10)).toBe(attenduUtc)
    expect(dateLocale(ms)).toBe('2026-10-21')
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


describe('objectifApresDecision', () => {
  const ctx = { seanceId: 's1', exerciseId: 'x1', cible: { chargeKg: 60, reps: 8, dureeSec: null } }

  it('Oui : la proposition, charge rendue lisible', () => {
    const o = objectifApresDecision({ type: 'accepter' }, proposition({ nouvelleChargeCible: 17.69999885559082 }), null, ctx, '2026-10-24')
    expect(o).toEqual({
      seanceId: 's1', exerciseId: 'x1', chargeCible: 17.7, repsCible: 8, dureeCibleSec: null, compteurEchec: 0,
      derniereMaj: '2026-10-24', nombreSeriesCible: null,
    })
  })

  it('Ajuster : la charge choisie avec le reste de la proposition', () => {
    const o = objectifApresDecision({ type: 'ajuster', chargeKg: 61 }, proposition({ nouveauNombreSeries: 4 }), null, ctx, '2026-10-24')
    expect(o).toMatchObject({ chargeCible: 61, repsCible: 8, compteurEchec: 0, nombreSeriesCible: 4 })
  })

  it('Non : cible existante conservée, compteur de la proposition (Android), séries cibles effacées', () => {
    const existant = {
      id: 'o', seanceId: 's1', exerciseId: 'x1', chargeCible: 50, repsCible: 6, dureeCibleSec: null, compteurEchec: 2,
      derniereMaj: '2026-10-01', nombreSeriesCible: 4, updatedAt: 'u',
    }
    const o = objectifApresDecision({ type: 'refuser' }, proposition({ deload: true, statut: 'ECHEC_MARQUE', nouvelleChargeCible: 45 }), existant, ctx, '2026-10-24')
    expect(o).toMatchObject({ chargeCible: 50, repsCible: 6, dureeCibleSec: null, compteurEchec: 0, nombreSeriesCible: null })
  })

  it('Non sans objectif existant : la cible courante (modèle) est conservée', () => {
    const o = objectifApresDecision({ type: 'refuser' }, proposition(), null, ctx, '2026-10-24')
    expect(o).toMatchObject({ chargeCible: 60, repsCible: 8, dureeCibleSec: null, compteurEchec: 0 })
  })
})

