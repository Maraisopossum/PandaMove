import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../../../core/db/Db'
import { getInstance } from '../../../core/db/repos/instances'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'
import { appliquerDecision, evaluerEtAppliquerSilencieux, evaluerInstance } from './evaluation'
import { reevaluerApresCorrection } from './reevaluation'

// Correction d'une séance terminée : la progression est recalculée À PARTIR DE L'ÉTAT D'AVANT l'évaluation d'origine,
// jamais par-dessus le résultat déjà appliqué (une évaluation ne s'applique pas deux fois).

const commun = { user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null }
const T0 = Date.parse('2026-10-24T11:00:00.000Z')
const T1 = Date.parse('2026-10-25T09:00:00.000Z')

let db: Db
let numero = 0

async function exercice(champs: Record<string, unknown> = {}) {
  await inserer(db, 'exercices_seance', {
    ...commun, id: 'e1', seance_id: 's1', instance_seance_id: 'i1', exercise_id: 'x1', bloc_id: null, position: 0,
    nombre_series_prevues: 3, reps_cibles: '8', charge_cible: '60 kg', reps_type: 'REPS', temps_repos_sec: 90,
    progression_activee: 1, systeme_progression: 'LINEAIRE', reps_min: null, reps_max: null, increment_kg: 2.5,
    increment_duree_sec: 5, seuil_deload: 3, type_exercice: null, increment_pct: null, is_bodyweight: 0, is_bilateral: 0,
    ...champs,
  })
}

async function series(liste: number[], charge: number | null = 60) {
  for (const reps of liste) {
    numero++
    await inserer(db, 'series_realisees', {
      ...commun, id: `serie-${numero}`, instance_seance_id: 'i1', exercice_seance_id: 'e1', numero_serie: numero,
      reps_realisees: reps, charge_kg: charge, rpe: null, notes: '', is_completed: 1,
    })
  }
}

// Correction : toutes les séries de l'exercice prennent ces répétitions
const corrigerReps = (reps: number) => db.execute('UPDATE series_realisees SET reps_realisees = ? WHERE exercice_seance_id = ?', [reps, 'e1'])

async function objectifStocke(champs: Record<string, unknown> = {}) {
  await inserer(db, 'objectifs_progression', {
    ...commun, id: 'obj-1', seance_id: 's1', exercise_id: 'x1', charge_cible: 60, reps_cible: 8, duree_cible_sec: null,
    compteur_echec: 1, derniere_maj: '2026-10-01', nombre_series_cible: null, ...champs,
  })
}

const objectif = () =>
  db.getOptional<{ charge_cible: number | null; reps_cible: number | null; compteur_echec: number; deleted_at: string | null }>(
    'SELECT charge_cible, reps_cible, compteur_echec, deleted_at FROM objectifs_progression WHERE seance_id = ? ORDER BY updated_at DESC LIMIT 1',
    ['s1'],
  )
const objectifVivant = async () => {
  const o = await objectif()
  return o && o.deleted_at === null ? o : null
}
const marqueur = async () => {
  const l = await db.get<{ progression_json: string | null }>("SELECT progression_json FROM instances_seance WHERE id = 'i1'")
  return JSON.parse(l.progression_json ?? 'null') as { evaluee: boolean; decisions: Record<string, string>; bases?: Record<string, unknown> }
}
const seriesPrevues = async () =>
  (await db.get<{ n: number }>("SELECT nombre_series_prevues AS n FROM exercices_seance WHERE id = 'e1'")).n

// « Terminer » : évaluation silencieuse de fin de séance
const terminer = () => db.writeTransaction((tx) => evaluerEtAppliquerSilencieux(tx, 'i1', { userId: 'u1', maintenantMs: T0 }))
// Choix de l'utilisateur au récap
const decider = async (decision: Parameters<typeof appliquerDecision>[3]) => {
  const [e] = await evaluerInstance(db, 'i1', 'u1')
  await db.writeTransaction((tx) => appliquerDecision(tx, 'i1', e, decision, T0))
}
const corriger = () => reevaluerApresCorrection(db, 'i1', { userId: 'u1', maintenantMs: T1 })

beforeEach(async () => {
  numero = 0
  db = createTestDb()
  await inserer(db, 'seances', { ...commun, id: 's1', nom: 'Haut du corps', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
  await inserer(db, 'exercises', { ...commun, id: 'x1', name: 'Développé couché', equipment: '["Barre"]', is_bodyweight: 0 })
  await inserer(db, 'instances_seance', {
    ...commun, id: 'i1', seance_id: 's1', date: '2026-10-24', notes: '', is_completed: 1, completed_at: '2026-10-24T11:00:00.000Z',
    duration_seconds: 2730, created_at: 'c', started_at: '2026-10-24T10:14:30.000Z', progression_json: null,
  })
})

describe('Terminer : enregistrement de la base d’évaluation', () => {
  it('un échec simple appliqué sans validation enregistre l’objectif d’avant, celui écrit et la proposition', async () => {
    await exercice()
    await objectifStocke({ compteur_echec: 1 })
    await series([7, 7, 7])
    await terminer()
    const m = await marqueur()
    expect(m.decisions).toEqual({ e1: 'appliquee_auto' })
    expect(m.bases?.e1).toMatchObject({
      cible: { chargeKg: 60, reps: 8, dureeSec: null },
      avant: { chargeCible: 60, repsCible: 8, compteurEchec: 1, derniereMaj: '2026-10-01' },
      ecrit: { chargeCible: 60, repsCible: 8, compteurEchec: 2 },
      proposition: { statut: expect.stringMatching(/^ECHEC/) as string, compteurEchec: 2 },
      seriesAvant: null,
      seriesApres: null,
    })
  })

  it('sans objectif existant, « avant » vaut null ; une décision du récap enregistre aussi sa base', async () => {
    await exercice()
    await series([8, 8, 8])
    await terminer()
    expect((await marqueur()).bases).toBeUndefined()
    await decider({ type: 'accepter' })
    const m = await marqueur()
    expect(m.decisions).toEqual({ e1: 'acceptee' })
    expect(m.bases?.e1).toMatchObject({ avant: null, ecrit: { chargeCible: 62.5, compteurEchec: 0 } })
  })
})

describe('Correction d’une séance terminée : recalcul de la progression', () => {
  it('échec simple devenu réussite : l’objectif revient à l’avant, la décision auto est annulée, la proposition est redemandée', async () => {
    await exercice()
    await objectifStocke({ compteur_echec: 1 })
    await series([7, 7, 7])
    await terminer()
    expect(await objectifVivant()).toMatchObject({ charge_cible: 60, compteur_echec: 2 })

    await corrigerReps(8)
    const changements = await corriger()

    expect(changements).toEqual([{ exerciceId: 'e1', nom: 'Développé couché', effet: 'a_redecider' }])
    // Objectif d'avant restauré (compteur 1, pas 2) : le récap évalue de nouveau depuis l'état d'origine
    expect(await objectifVivant()).toMatchObject({ charge_cible: 60, reps_cible: 8, compteur_echec: 1 })
    const m = await marqueur()
    expect(m.decisions).toEqual({})
    expect(m.bases).toBeUndefined()
    expect(m.evaluee).toBe(true)
    const [e] = await evaluerInstance(db, 'i1', 'u1')
    expect(e.aValider).toBe(true)
    expect(e.proposition).toMatchObject({ statut: 'SUCCES', nouvelleChargeCible: 62.5 })
    // Idempotent : un second passage ne fait plus rien
    expect(await corriger()).toEqual([])
  })

  it('réussite acceptée devenue échec : l’objectif accepté est annulé et l’échec simple est appliqué une fois', async () => {
    await exercice()
    await series([8, 8, 8])
    await terminer()
    await decider({ type: 'accepter' })
    expect(await objectifVivant()).toMatchObject({ charge_cible: 62.5, compteur_echec: 0 })

    await corrigerReps(7)
    const changements = await corriger()

    expect(changements).toEqual([{ exerciceId: 'e1', nom: 'Développé couché', effet: 'recalculee' }])
    // Pas d'objectif avant la séance : celui de la correction part de la cible du modèle (60 kg), compteur 1 — pas 62,5
    expect(await objectifVivant()).toMatchObject({ charge_cible: 60, reps_cible: 8, compteur_echec: 1 })
    const m = await marqueur()
    expect(m.decisions).toEqual({ e1: 'appliquee_auto' })
    expect(m.bases?.e1).toMatchObject({ avant: null, ecrit: { compteurEchec: 1 } })
    expect(await corriger()).toEqual([])
    expect(await objectifVivant()).toMatchObject({ compteur_echec: 1 })
  })

  it('correction sans effet sur le résultat : rien n’est réécrit et la décision de l’utilisateur est gardée', async () => {
    await exercice()
    await series([8, 8, 8])
    await terminer()
    await decider({ type: 'ajuster', chargeKg: 61.25 })
    const avant = await db.getAll('SELECT * FROM objectifs_progression')
    const marqueurAvant = await marqueur()

    // Une série de plus : le résultat (réussite, même proposition) ne change pas
    await series([8])
    expect(await corriger()).toEqual([])

    expect(await db.getAll('SELECT * FROM objectifs_progression')).toEqual(avant)
    expect(await marqueur()).toEqual(marqueurAvant)
    expect((await marqueur()).decisions).toEqual({ e1: 'ajustee' })
  })

  it('refus pris par l’utilisateur : gardé tant que la proposition ne change pas, redemandé si elle change', async () => {
    await exercice()
    await objectifStocke({ compteur_echec: 2 })
    await series([7, 7, 7]) // 3e échec consécutif : deload proposé
    await terminer()
    await decider({ type: 'refuser' })
    expect((await marqueur()).decisions).toEqual({ e1: 'refusee' })

    await series([7])
    expect(await corriger()).toEqual([])
    expect((await marqueur()).decisions).toEqual({ e1: 'refusee' })

    await corrigerReps(8) // devient une réussite
    expect(await corriger()).toEqual([{ exerciceId: 'e1', nom: 'Développé couché', effet: 'a_redecider' }])
    expect((await marqueur()).decisions).toEqual({})
    expect(await objectifVivant()).toMatchObject({ charge_cible: 60, reps_cible: 8, compteur_echec: 2 })
  })

  it('une séance plus récente a déjà fait évoluer l’objectif : il n’est pas touché, et le signalement ne revient pas', async () => {
    await exercice()
    await objectifStocke({ compteur_echec: 1 })
    await series([7, 7, 7])
    await terminer()
    // Séance suivante : l'objectif a de nouveau changé
    await db.execute("UPDATE objectifs_progression SET charge_cible = 70, derniere_maj = '2026-10-30', updated_at = '2026-10-30T10:00:00.000Z'")

    await corrigerReps(8)
    expect(await corriger()).toEqual([{ exerciceId: 'e1', nom: 'Développé couché', effet: 'objectif_deja_evolue' }])
    expect(await objectifVivant()).toMatchObject({ charge_cible: 70 })
    expect((await marqueur()).decisions).toEqual({ e1: 'appliquee_auto' })
    expect(await corriger()).toEqual([])
  })

  it('« +1 série » annulé par la correction : le nombre de séries prévues de l’instance revient à sa valeur d’avant', async () => {
    await exercice({
      systeme_progression: 'DOUBLE_PROGRESSION', reps_min: 8, reps_max: 12, reps_cibles: '12', charge_cible: 'PDC', is_bodyweight: 1,
    })
    await series([12, 12, 12], null)
    await terminer()
    await decider({ type: 'accepter' })
    expect(await seriesPrevues()).toBe(4)

    await corrigerReps(9) // plus de plafond atteint : plus de série ajoutée
    const changements = await corriger()
    expect(changements.map((c) => c.exerciceId)).toEqual(['e1'])
    expect(await seriesPrevues()).toBe(3)
  })

  it('séance évaluée avant ce lot (marqueur sans base) : jamais recalculée', async () => {
    await exercice()
    await objectifStocke({ compteur_echec: 2 })
    await series([7, 7, 7])
    await db.execute(`UPDATE instances_seance SET progression_json = '{"evaluee":true,"decisions":{"e1":"appliquee_auto"}}' WHERE id = 'i1'`)
    await corrigerReps(8)
    expect(await corriger()).toEqual([])
    expect(await objectifVivant()).toMatchObject({ compteur_echec: 2 })
  })

  it('séance non terminée, importée ou introuvable : rien', async () => {
    await exercice()
    await series([8, 8, 8])
    await terminer()
    await db.execute('UPDATE instances_seance SET is_completed = 0 WHERE id = ?', ['i1'])
    expect(await corriger()).toEqual([])
    expect(await reevaluerApresCorrection(db, 'inconnue', { userId: 'u1', maintenantMs: T1 })).toEqual([])
    expect((await getInstance(db, 'i1'))?.progression?.decisions).toEqual({})
  })

  it('exercice retiré par la correction : sa base est ignorée, rien ne casse', async () => {
    await exercice()
    await objectifStocke({ compteur_echec: 1 })
    await series([7, 7, 7])
    await terminer()
    await db.execute("UPDATE exercices_seance SET deleted_at = '2026-10-25T00:00:00.000Z' WHERE id = 'e1'")
    expect(await corriger()).toEqual([])
    expect(await objectifVivant()).toMatchObject({ compteur_echec: 2 })
  })
})
