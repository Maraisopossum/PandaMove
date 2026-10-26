import { describe, expect, it } from 'vitest'
import { lireEquipementStocke } from '../../../core/import/equipment'
import { evaluerExercice } from '../../../core/progression/engine'
import { nouvelExercice, type ExerciceDraft } from '../draft'
import {
  activerProgression, apercuMontee, aideSysteme, avertissementsProgression, basculerPoidsDeCorps, choisirSysteme,
  desactiverProgression, indiceCharge, optionsIncrement,
} from './progressionConfig'

const exo = (equipment: string[] = []) => nouvelExercice('e', { id: 'x', name: 'Curl', muscles: [], equipment, isBodyweight: false }, null)
const materiel = (json: object = {}) => lireEquipementStocke(JSON.stringify(json))
const avecHalteres = materiel({ halteres: { poidsFixes: [8, 10, 12, 14], chargeable: null } })

describe('activation de la surcharge progressive (valeurs par défaut Android)', () => {
  it('active en double progression 8–12, incrément 2,5 kg, et préremplit les répétitions de départ', () => {
    const e = activerProgression(exo())
    expect(e).toMatchObject({ progressionActivee: true, systemeProgression: 'DOUBLE', repsMin: 8, repsMax: 12, incrementKg: 2.5, repsCibles: '8' })
  })

  it('conserve ce que l’utilisateur a déjà saisi', () => {
    const e = activerProgression({ ...exo(), repsCibles: '10', systemeProgression: 'LINEAIRE', repsMin: 6, repsMax: 10, incrementKg: 5 })
    expect(e).toMatchObject({ systemeProgression: 'LINEAIRE', repsMin: 6, repsMax: 10, incrementKg: 5, repsCibles: '10' })
  })

  it('ne touche pas aux répétitions d’un exercice en durée', () => {
    expect(activerProgression({ ...exo(), repsType: 'DURATION' }).repsCibles).toBe('')
  })

  it('désactive : la plage de répétitions est effacée, le reste est gardé', () => {
    const e = desactiverProgression({ ...activerProgression(exo()), incrementKg: 5 })
    expect(e).toMatchObject({ progressionActivee: false, repsMin: null, repsMax: null, incrementKg: 5, systemeProgression: 'DOUBLE' })
  })
})

describe('choix du système', () => {
  it('double : pose la plage 8–12 si absente, sans écraser une plage existante', () => {
    expect(choisirSysteme({ ...exo(), progressionActivee: true }, 'DOUBLE')).toMatchObject({ systemeProgression: 'DOUBLE', repsMin: 8, repsMax: 12 })
    expect(choisirSysteme({ ...exo(), repsMin: 5, repsMax: 7, repsCibles: '5' }, 'DOUBLE')).toMatchObject({ repsMin: 5, repsMax: 7, repsCibles: '5' })
  })

  it('linéaire et temporelle : changent seulement le système', () => {
    const e = { ...exo(), repsMin: 8, repsMax: 12 }
    expect(choisirSysteme(e, 'LINEAIRE')).toMatchObject({ systemeProgression: 'LINEAIRE', repsMin: 8, repsMax: 12 })
    expect(choisirSysteme(e, 'TEMPORELLE').systemeProgression).toBe('TEMPORELLE')
  })

  it('poids de corps : coché => type PDC ; décoché => le type reste', () => {
    const coche = basculerPoidsDeCorps({ ...exo(), typeExercice: 'ISOLATION' }, true)
    expect(coche).toMatchObject({ isBodyweight: true, typeExercice: 'PDC' })
    expect(basculerPoidsDeCorps(coche, false)).toMatchObject({ isBodyweight: false, typeExercice: 'PDC' })
  })
})

describe('options affichées selon le système', () => {
  it('type d’exercice masqué en poids de corps ou en temporelle ; incrément kg / durée / aucun', () => {
    const e = { ...exo(), progressionActivee: true, systemeProgression: 'DOUBLE' }
    expect(optionsIncrement(e)).toEqual({ plage: true, typeExercice: true, increment: 'charge' })
    expect(optionsIncrement({ ...e, systemeProgression: 'LINEAIRE' })).toEqual({ plage: false, typeExercice: true, increment: 'charge' })
    expect(optionsIncrement({ ...e, systemeProgression: 'TEMPORELLE' })).toEqual({ plage: false, typeExercice: false, increment: 'duree' })
    expect(optionsIncrement({ ...e, isBodyweight: true })).toEqual({ plage: true, typeExercice: false, increment: 'aucun' })
  })

  it('une aide courte par système', () => {
    for (const s of ['LINEAIRE', 'DOUBLE', 'TEMPORELLE']) expect(aideSysteme(s).length).toBeGreaterThan(20)
    expect(aideSysteme('DOUBLE')).toMatch(/plage/i)
    expect(aideSysteme(null)).toBe(aideSysteme('DOUBLE'))
  })
})

describe('aperçu de l’incrément réellement atteignable', () => {
  const lineaire = (extra: Partial<ExerciceDraft>): ExerciceDraft => ({
    ...exo(['Haltères']), progressionActivee: true, systemeProgression: 'LINEAIRE', incrementKg: 2.5, chargeCible: '10 kg', ...extra,
  })

  it('inventaire structuré : snapping sur la charge réellement composable', () => {
    // 10 -> 12 kg avec des haltères de 8, 10, 12, 14 kg (et non 12,5 kg)
    expect(apercuMontee(lineaire({}), avecHalteres)).toBe('Si toutes les séries sont réussies : 10 kg → 12 kg (+2 kg), avec les charges de votre matériel.')
  })

  it('pas simple (machine) : arrondi au pas déclaré', () => {
    const e = lineaire({ equipementCatalogue: ['Machine guidée'], typeExercice: 'MACHINE', chargeCible: '40 kg' })
    expect(apercuMontee(e, materiel())).toBe('Si toutes les séries sont réussies : 40 kg → 45 kg (+5 kg), avec le pas de votre matériel (5 kg).')
    const e2 = materiel({ pasParCategorie: { MACHINE: 2.5 } })
    expect(apercuMontee(e, e2)).toContain('40 kg → 42,5 kg')
  })

  it('sans matériel ni type : incrément manuel', () => {
    const e = lineaire({ equipementCatalogue: [], incrementKg: 2.5, chargeCible: '20 kg' })
    expect(apercuMontee(e, materiel())).toBe('Si toutes les séries sont réussies : 20 kg → 22,5 kg (+2,5 kg), avec l’incrément choisi.')
  })

  it('charge cible absente ou illisible : consigne claire', () => {
    expect(apercuMontee(lineaire({ chargeCible: '' }), avecHalteres)).toMatch(/Indiquez une charge cible/)
    expect(apercuMontee(lineaire({ chargeCible: 'lourd' }), avecHalteres)).toMatch(/Indiquez une charge cible/)
  })

  it('double progression : plage puis charge', () => {
    const e = lineaire({ systemeProgression: 'DOUBLE', repsMin: 8, repsMax: 12, repsCibles: '8', chargeCible: '10 kg' })
    expect(apercuMontee(e, avecHalteres)).toBe(
      'Tant que toutes les séries n’atteignent pas 12 répétitions : +1 répétition par séance. Puis charge 10 kg → 12 kg et retour à 8 répétitions.',
    )
  })

  it('double progression au poids de corps : une série de plus', () => {
    const e = lineaire({ systemeProgression: 'DOUBLE', repsMin: 8, repsMax: 12, isBodyweight: true, typeExercice: 'PDC' })
    expect(apercuMontee(e, avecHalteres)).toBe(
      'Tant que toutes les séries n’atteignent pas 12 répétitions : +1 répétition par séance. Puis retour à 8 répétitions avec une série de plus.',
    )
  })

  it('temporelle : durée cible + incrément', () => {
    const e = lineaire({ systemeProgression: 'TEMPORELLE', repsType: 'DURATION', repsCibles: '40', incrementDureeSec: 5 })
    expect(apercuMontee(e, avecHalteres)).toBe('Si toutes les séries sont tenues : durée cible 40 s → 45 s.')
    expect(apercuMontee({ ...e, repsCibles: '' }, avecHalteres)).toMatch(/Indiquez une durée cible/)
  })

  it('l’aperçu est celui que le moteur calcule en fin de séance (même fonction, mêmes entrées)', () => {
    const e = lineaire({})
    const serie = { repsRealisees: 8, chargeKg: 10, rpe: null, notes: '' }
    const p = evaluerExercice(e, { chargeKg: 10, reps: null, dureeSec: null }, 0, [serie, serie, serie], false, null, [8, 10, 12, 14])
    expect(p.nouvelleChargeCible).toBe(12)
    expect(apercuMontee(e, avecHalteres)).toContain('10 kg → 12 kg')
  })
})

describe('indice de charge composable', () => {
  it('propose la charge composable la plus proche avec le matériel déclaré', () => {
    const e = { ...exo(['Haltères']), chargeCible: '11 kg' }
    expect(indiceCharge(e, avecHalteres)).toEqual({
      texte: 'Charge non composable avec votre matériel : la plus proche est 10 kg.',
      chargeProche: '10 kg',
    })
    expect(indiceCharge({ ...e, chargeCible: '12,5 kg' }, avecHalteres)?.chargeProche).toBe('12 kg')
  })

  it('aucun indice : charge composable, charge non numérique, matériel sans inventaire', () => {
    expect(indiceCharge({ ...exo(['Haltères']), chargeCible: '12 kg' }, avecHalteres)).toBeNull()
    expect(indiceCharge({ ...exo(['Haltères']), chargeCible: 'PDC' }, avecHalteres)).toBeNull()
    expect(indiceCharge({ ...exo(['Machine guidée']), chargeCible: '11 kg' }, avecHalteres)).toBeNull()
    expect(indiceCharge({ ...exo(['Haltères']), chargeCible: '11 kg' }, materiel())).toBeNull()
  })
})

describe('avertissements de cohérence (ce que le moteur ne pourrait pas évaluer)', () => {
  const actif = (extra: Partial<ExerciceDraft>): ExerciceDraft => ({ ...exo(), progressionActivee: true, systemeProgression: 'DOUBLE', ...extra })

  it('répétitions de départ non numériques ou vides', () => {
    expect(avertissementsProgression(actif({ repsCibles: '8-12' }))).toEqual([
      'Les répétitions cibles « 8-12 » ne sont pas un nombre : indiquez le nombre de départ (ex. 8) pour que la fin de séance puisse évaluer chaque série.',
    ])
    expect(avertissementsProgression(actif({ repsCibles: '' }))[0]).toMatch(/Indiquez les répétitions cibles de départ/)
    expect(avertissementsProgression(actif({ repsCibles: '8' }))).toEqual([])
  })

  it('progression temporelle sur un exercice en répétitions', () => {
    expect(avertissementsProgression(actif({ systemeProgression: 'TEMPORELLE', repsType: 'REPS' }))[0]).toMatch(/exercice en durée/)
    expect(avertissementsProgression(actif({ systemeProgression: 'TEMPORELLE', repsType: 'DURATION', repsCibles: '40' }))).toEqual([])
  })

  it('rien quand la progression est désactivée', () => {
    expect(avertissementsProgression({ ...exo(), repsCibles: '8-12' })).toEqual([])
  })
})
