import { describe, expect, it } from 'vitest'
import type { Db } from '../../../core/db/Db'
import { copyTemplateToInstance, createInstance } from '../../../core/db/repos/instances'
import { addSerie } from '../../../core/db/repos/series'
import { saveSettingsTx } from '../../../core/db/repos/settings'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'
import {
  ajouterBloc, ajouterExercice, brouillonVide, modifierExercice, nouveauBloc, nouvelExercice, transformerExercice,
  type SeanceDraft,
} from '../draft'
import { evaluerInstance } from '../progression/evaluation'
import { chargerBrouillon, enregistrerBrouillon } from '../seanceStore'
import { activerProgression, apercuMontee, choisirSysteme } from './progressionConfig'
import { lireEquipementStocke } from '../../../core/import/equipment'
import { listExercises } from '../../../core/db/repos/exercises'

// Cohérence de bout en bout : champ édité -> ligne exercices_seance -> évaluation en fin de séance.
// L'aperçu affiché à l'édition doit annoncer exactement ce que le moteur proposera.

const HALTERES = { halteres: { poidsFixes: [8, 10, 12, 14], chargeable: null }, selectedCategories: ['HALTERES'] }

async function base() {
  const db = createTestDb()
  await inserer(db, 'exercises', {
    id: 'curl', user_id: 'u1', updated_at: 'u', deleted_at: null, name: 'Curl', category: 'OTHER', muscle_groups: '["BICEPS"]',
    description: '', is_favorite: 0, is_custom: 0, image_url: null, exercise_type: '', equipment: '["Haltères"]',
    muscle_primary: 'BICEPS', is_bodyweight: 0,
  })
  await db.writeTransaction((tx) => saveSettingsTx(tx, 'u1', { equipmentJson: JSON.stringify(HALTERES) }))
  return db
}

async function enregistrerEtRelire(db: Db, d: SeanceDraft) {
  await enregistrerBrouillon(db, d)
  return chargerBrouillon(db, d.id, await listExercises(db))
}

async function realiser(db: Db, seanceId: string, series: { reps: number; chargeKg: number }[]) {
  const instanceId = await createInstance(db, seanceId, '2026-10-24')
  await copyTemplateToInstance(db, instanceId)
  const ligne = await db.get<{ id: string }>('SELECT id FROM exercices_seance WHERE instance_seance_id = ?', [instanceId])
  let n = 0
  for (const s of series) {
    await addSerie(db, {
      instanceSeanceId: instanceId, exerciceSeanceId: ligne.id, numeroSerie: ++n, repsRealisees: s.reps, chargeKg: s.chargeKg,
      chargeLabel: '', rpe: null, notes: '', isCompleted: true,
    })
  }
  return evaluerInstance(db, instanceId, 'u1')
}

describe('surcharge progressive : de l’éditeur au moteur', () => {
  it('linéaire : l’aperçu annonce la charge que le moteur propose après trois séries réussies', async () => {
    const db = await base()
    let d: SeanceDraft = { ...brouillonVide('s1'), nom: 'Bras' }
    d = ajouterBloc(d, nouveauBloc('b', 'SUPERSET'))
    d = ajouterExercice(d, 'b', nouvelExercice('e', { id: 'curl', name: 'Curl', muscles: ['BICEPS'], equipment: ['Haltères'], isBodyweight: false }, 'SUPERSET'))
    d = transformerExercice(d, 'e', (e) => choisirSysteme(activerProgression({ ...e, repsCibles: '8', chargeCible: '10 kg' }), 'LINEAIRE'))
    const relu = (await enregistrerEtRelire(db, d))!
    const exo = relu.items.flatMap((i) => (i.kind === 'bloc' ? i.bloc.exercices : []))[0]

    // Colonnes écrites = ce que lit le moteur
    expect(await db.get('SELECT progression_activee, systeme_progression, increment_kg, reps_min, reps_max, seuil_deload FROM exercices_seance WHERE seance_id = ? AND instance_seance_id IS NULL', ['s1'])).toEqual({
      progression_activee: 1, systeme_progression: 'LINEAIRE', increment_kg: 2.5, reps_min: 8, reps_max: 12, seuil_deload: 3,
    })

    const apercu = apercuMontee(exo, lireEquipementStocke(JSON.stringify(HALTERES)))
    expect(apercu).toContain('10 kg → 12 kg')

    const evaluations = await realiser(db, 's1', [{ reps: 8, chargeKg: 10 }, { reps: 8, chargeKg: 10 }, { reps: 8, chargeKg: 10 }])
    expect(evaluations).toHaveLength(1)
    expect(evaluations[0].proposition).toMatchObject({ statut: 'SUCCES', nouvelleChargeCible: 12 })
  })

  it('double progression : plage 8–12 atteinte -> charge qui monte et retour à 8 répétitions', async () => {
    const db = await base()
    let d: SeanceDraft = { ...brouillonVide('s2'), nom: 'Bras 2' }
    d = ajouterExercice(d, null, nouvelExercice('e', { id: 'curl', name: 'Curl', muscles: [], equipment: ['Haltères'], isBodyweight: false }, null))
    d = transformerExercice(d, 'e', (e) => activerProgression({ ...e, chargeCible: '10 kg' }))
    const relu = (await enregistrerEtRelire(db, d))!
    const exo = relu.items.flatMap((i) => (i.kind === 'libre' ? [i.exercice] : []))[0]
    // Répétitions de départ préremplies avec le bas de plage : sans elles le moteur ne saurait pas évaluer
    expect(exo).toMatchObject({ repsCibles: '8', repsMin: 8, repsMax: 12, systemeProgression: 'DOUBLE' })

    const evaluations = await realiser(db, 's2', [{ reps: 12, chargeKg: 10 }, { reps: 12, chargeKg: 10 }, { reps: 12, chargeKg: 10 }])
    expect(evaluations[0].proposition).toMatchObject({ statut: 'SUCCES', nouvelleChargeCible: 12, nouveauRepsCible: 8 })
    expect(apercuMontee(exo, lireEquipementStocke(JSON.stringify(HALTERES)))).toContain('charge 10 kg → 12 kg et retour à 8 répétitions')
  })

  it('temporelle : la durée cible monte de l’incrément choisi', async () => {
    const db = await base()
    let d: SeanceDraft = { ...brouillonVide('s3'), nom: 'Gainage' }
    d = ajouterExercice(d, null, nouvelExercice('e', { id: 'curl', name: 'Planche', muscles: [], equipment: [], isBodyweight: false }, null))
    d = transformerExercice(d, 'e', (e) => choisirSysteme(activerProgression({ ...e, repsType: 'DURATION', repsCibles: '40' }), 'TEMPORELLE'))
    d = modifierExercice(d, 'e', { incrementDureeSec: 10 })
    const relu = (await enregistrerEtRelire(db, d))!
    const exo = relu.items.flatMap((i) => (i.kind === 'libre' ? [i.exercice] : []))[0]
    expect(apercuMontee(exo, lireEquipementStocke(null))).toBe('Si toutes les séries sont tenues : durée cible 40 s → 50 s.')

    const evaluations = await realiser(db, 's3', [{ reps: 40, chargeKg: 0 }, { reps: 40, chargeKg: 0 }, { reps: 45, chargeKg: 0 }])
    expect(evaluations[0].proposition).toMatchObject({ statut: 'SUCCES', nouvelleDureeCible: 50 })
  })
})
