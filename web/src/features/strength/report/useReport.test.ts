// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../../core/db/Db'
import { deterministicId } from '../../../core/db/ids'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'
import { useReport } from './useReport'

// Horloge fixe : les décisions sont datées après la fin de séance (11:00).
const MAINTENANT = Date.parse('2026-10-24T12:00:00.000Z')
const horloge = () => MAINTENANT
const commun = { user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null }
const FIN = '2026-10-24T11:00:00.000Z'
// Instance terminée sur le web : l'évaluation de fin (« Terminer ») a déjà eu lieu
const EVALUEE = '{"evaluee":true,"decisions":{}}'
const JOUR = (() => {
  const d = new Date(MAINTENANT)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})()

let db: Db
let numeroSerie = 0

// Exercice d'instance (ligne déjà copiée : une instance terminée n'est jamais recopiée).
async function exercice(id: string, champs: Record<string, unknown>) {
  await inserer(db, 'exercices_seance', {
    ...commun, id, seance_id: 's1', instance_seance_id: 'i1', bloc_id: null, position: 0, nombre_series_prevues: 3,
    reps_cibles: '8', charge_cible: '60 kg', reps_type: 'REPS', temps_repos_sec: 90, progression_activee: 0,
    systeme_progression: 'LINEAIRE', reps_min: null, reps_max: null, increment_kg: 2.5, increment_duree_sec: 5,
    seuil_deload: 3, type_exercice: null, increment_pct: null, is_bodyweight: 0, is_bilateral: 0,
    ...champs,
  })
}

async function series(exerciceId: string, liste: [reps: number, charge: number | null, terminee?: boolean][]) {
  for (const [reps, charge, terminee = true] of liste) {
    numeroSerie++
    await inserer(db, 'series_realisees', {
      ...commun, id: `serie-${numeroSerie}`, instance_seance_id: 'i1', exercice_seance_id: exerciceId,
      numero_serie: numeroSerie, reps_realisees: reps, charge_kg: charge, rpe: null, notes: '', is_completed: terminee ? 1 : 0,
    })
  }
}

async function objectifStocke(exerciseId: string, champs: Record<string, unknown>) {
  await inserer(db, 'objectifs_progression', {
    ...commun, id: `obj-${exerciseId}`, seance_id: 's1', exercise_id: exerciseId, charge_cible: 50, reps_cible: 8,
    duree_cible_sec: null, compteur_echec: 0, derniere_maj: '2026-10-01', nombre_series_cible: null, ...champs,
  })
}

async function materiel(equipement: unknown) {
  await inserer(db, 'user_settings', {
    ...commun, id: deterministicId('u1', 'user_settings'), equipment_json: JSON.stringify(equipement),
    panda_variant: 'male', dark_mode: null,
  })
}

const marqueur = async () => {
  const l = await db.get<{ progression_json: string | null }>("SELECT progression_json FROM instances_seance WHERE id = 'i1'")
  return l.progression_json === null ? null : (JSON.parse(l.progression_json) as unknown)
}

const objectifs = () =>
  db.getAll<Record<string, unknown>>('SELECT * FROM objectifs_progression WHERE deleted_at IS NULL ORDER BY exercise_id, id')

beforeEach(async () => {
  numeroSerie = 0
  db = createTestDb()
  await inserer(db, 'seances', { ...commun, id: 's1', nom: 'Haut du corps', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
  for (const [id, name, equipement] of [
    ['x1', 'Développé couché', ['Barre', 'Banc plat']],
    ['x2', 'Gainage planche', ['Poids de corps']],
    ['x3', 'Rowing barre', ['Barre']],
    ['x4', 'Presse à cuisses', ['Machine guidée']],
  ] as const) {
    await inserer(db, 'exercises', { ...commun, id, name, equipment: JSON.stringify(equipement), is_bodyweight: 0 })
  }
  await inserer(db, 'instances_seance', {
    ...commun, id: 'i1', seance_id: 's1', date: '2026-10-24', notes: '', is_completed: 1, completed_at: FIN,
    duration_seconds: 2730, created_at: 'c', started_at: '2026-10-24T10:14:30.000Z', progression_json: EVALUEE,
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function monter(instanceId = 'i1', userId: string | undefined = 'u1') {
  const rendu = renderHook(() => useReport(instanceId, { db, userId, nowFn: horloge }))
  await waitFor(() => expect(rendu.result.current.chargement).toBe(false))
  return rendu
}

const propositionDe = (r: Awaited<ReturnType<typeof monter>>, id: string) =>
  r.result.current.propositions.find((p) => p.exerciceId === id)

describe('useReport : résumé', () => {
  it("séance supprimée avec historique gardé : le rapport garde le nom de la séance", async () => {
    await db.execute("UPDATE seances SET deleted_at = '2026-10-25T08:00:00.000Z' WHERE id = 's1'")
    const r = await monter()
    expect(r.result.current.nomSeance).toBe('Haut du corps')
  })

  it('tonnage, séries et durée sur une séance connue (DURATION exclue du tonnage)', async () => {
    await exercice('e1', { exercise_id: 'x1', position: 0 })
    await exercice('e2', { exercise_id: 'x2', position: 1, reps_type: 'DURATION', reps_cibles: '45', charge_cible: '10 kg', nombre_series_prevues: 2 })
    await series('e1', [[10, 60], [8, 62.5], [5, 60, false]])
    // 60 s lestées de 10 kg : 0 au tonnage (les secondes ne sont pas des répétitions)
    await series('e2', [[60, 10]])
    const r = await monter()
    expect(r.result.current.erreur).toBeNull()
    expect(r.result.current.terminee).toBe(true)
    expect(r.result.current.resume).toEqual({ tonnageKg: 1100, seriesTotal: 3, dureeSec: 2730 })
    expect(r.result.current.exercices).toEqual([
      { exerciceId: 'e1', nom: 'Développé couché', seriesPrevues: 3, seriesRealisees: 2, statut: 'partiel' },
      { exerciceId: 'e2', nom: 'Gainage planche', seriesPrevues: 2, seriesRealisees: 1, statut: 'partiel' },
    ])
    // Aucun exercice en progression : aucune proposition, aucune écriture
    expect(r.result.current.propositions).toEqual([])
    expect(await objectifs()).toEqual([])
  })

  it("instance non terminée : pas d'évaluation, pas d'écriture", async () => {
    await db.execute('UPDATE instances_seance SET is_completed = 0, completed_at = NULL WHERE id = ?', ['i1'])
    await exercice('e1', { exercise_id: 'x1', progression_activee: 1 })
    await series('e1', [[8, 60], [8, 60], [8, 60]])
    const r = await monter()
    expect(r.result.current.terminee).toBe(false)
    expect(r.result.current.trouvee).toBe(true)
    expect(r.result.current.propositions).toEqual([])
    expect(await objectifs()).toEqual([])
  })

  it('instance introuvable : message français', async () => {
    const r = await monter('inconnue')
    expect(r.result.current.trouvee).toBe(false)
    expect(r.result.current.erreur).toBe('Séance introuvable.')
  })
})

describe('useReport : propositions', () => {
  it('seuls les exercices en progression_activee reçoivent une proposition', async () => {
    await exercice('e1', { exercise_id: 'x1', progression_activee: 1 })
    await exercice('e3', { exercise_id: 'x3', progression_activee: 0, position: 1 })
    await series('e1', [[8, 60], [8, 60], [8, 60]])
    await series('e3', [[8, 60], [8, 60], [8, 60]])
    const r = await monter()
    expect(r.result.current.propositions.map((p) => p.exerciceId)).toEqual(['e1'])
    expect(propositionDe(r, 'e1')).toMatchObject({ nom: 'Développé couché', aValider: true, etat: 'en_attente' })
  })

  it('sans objectif, la cible initiale vient du modèle (charge_cible / reps_cibles)', async () => {
    await exercice('e1', { exercise_id: 'x1', progression_activee: 1, charge_cible: '60 kg', reps_cibles: '8' })
    await series('e1', [[8, 60], [8, 60], [8, 60]])
    const r = await monter()
    // LINEAIRE, sans inventaire : 60 + pas manuel 2,5
    expect(propositionDe(r, 'e1')?.proposition ?? null).toMatchObject({ statut: 'SUCCES', nouvelleChargeCible: 62.5, nouveauRepsCible: 8 })
  })

  it("sans inventaire, l'incrément retombe sur le pas simple ; avec inventaire il suit les charges composables", async () => {
    await exercice('e1', { exercise_id: 'x1', progression_activee: 1, type_exercice: 'COMPOSE_HAUT' })
    await series('e1', [[8, 60], [8, 60], [8, 60]])
    const sans = await monter()
    expect(propositionDe(sans, 'e1')?.proposition?.nouvelleChargeCible).toBe(62.5)
    sans.unmount()

    // Barre 20 kg + une paire de 1,25 kg : rien de composable au-dessus de 60 kg -> charge maintenue
    await materiel({ barre: { barreKg: 20, disques: { '1.25': 2 } }, selectedCategories: ['BARRE'], pasParCategorie: {} })
    const avec = await monter()
    expect(propositionDe(avec, 'e1')?.proposition?.nouvelleChargeCible).toBe(60)
  })

  it('MACHINE sans pas déclaré : pas par défaut 5 kg (PAS_DEFAUT Android)', async () => {
    await exercice('e4', { exercise_id: 'x4', progression_activee: 1, type_exercice: 'MACHINE', increment_kg: null, charge_cible: '40 kg' })
    await series('e4', [[8, 40], [8, 40], [8, 40]])
    const r = await monter()
    expect(propositionDe(r, 'e4')?.proposition?.nouvelleChargeCible).toBe(45)
  })

  it("un deload (statut d'échec) est à valider et n'écrit RIEN avant accepter", async () => {
    await exercice('e1', { exercise_id: 'x1', progression_activee: 1, seuil_deload: 3 })
    await objectifStocke('x1', { charge_cible: 50, reps_cible: 8, compteur_echec: 2 })
    // 7 reps sur 8 à chaque série : échec, 3e consécutif -> deload proposé
    await series('e1', [[7, 50], [7, 50], [7, 50]])
    const avant = await objectifs()
    const r = await monter()
    const p = propositionDe(r, 'e1')
    expect(p?.proposition?.deload).toBe(true)
    expect(['ECHEC', 'ECHEC_MARQUE']).toContain(p?.proposition?.statut)
    expect(p).toMatchObject({ aValider: true, actionnable: true, etat: 'en_attente' })
    expect(await objectifs()).toEqual(avant)

    await act(() => r.result.current.accepter('e1'))
    expect(propositionDe(r, 'e1')?.etat).toBe('acceptee')
    expect(await objectifs()).toEqual([
      expect.objectContaining({
        id: 'obj-x1', charge_cible: 45, reps_cible: 8, compteur_echec: 0, derniere_maj: JOUR,
      }),
    ])
  })

  it('refuser un deload : cible stockée intacte, compteur remis à 0 comme Android', async () => {
    await exercice('e1', { exercise_id: 'x1', progression_activee: 1, seuil_deload: 3 })
    await objectifStocke('x1', { charge_cible: 50, reps_cible: 8, compteur_echec: 2 })
    await series('e1', [[7, 50], [7, 50], [7, 50]])
    const r = await monter()
    await act(() => r.result.current.refuser('e1'))
    expect(propositionDe(r, 'e1')?.etat).toBe('refusee')
    expect(await objectifs()).toEqual([
      expect.objectContaining({ id: 'obj-x1', charge_cible: 50, reps_cible: 8, duree_cible_sec: null, compteur_echec: 0 }),
    ])
  })

  it('ajuster écrit la charge choisie (et refuse une charge invalide en français)', async () => {
    await exercice('e1', { exercise_id: 'x1', progression_activee: 1 })
    await series('e1', [[8, 60], [8, 60], [8, 60]])
    const r = await monter()

    await act(() => r.result.current.ajuster('e1', 0))
    expect(r.result.current.erreur).toBe('La charge doit être un nombre de kg strictement positif.')
    await act(() => r.result.current.ajuster('e1', Number.NaN))
    expect(r.result.current.erreur).toBe('La charge doit être un nombre de kg strictement positif.')
    expect(await objectifs()).toEqual([])
    expect(propositionDe(r, 'e1')?.etat).toBe('en_attente')

    await act(() => r.result.current.ajuster('e1', 61.25))
    expect(r.result.current.erreur).toBeNull()
    expect(propositionDe(r, 'e1')?.etat).toBe('ajustee')
    expect(await objectifs()).toEqual([
      expect.objectContaining({ id: deterministicId('s1', 'x1'), charge_cible: 61.25, reps_cible: 8, compteur_echec: 0 }),
    ])
  })

  it('accepter écrit charge_cible en décimal lisible (17.7, pas le Float brut)', async () => {
    await exercice('e1', { exercise_id: 'x1', progression_activee: 1, increment_kg: 0.7, charge_cible: '17 kg' })
    await series('e1', [[8, 17], [8, 17], [8, 17]])
    const r = await monter()
    const brute = propositionDe(r, 'e1')?.proposition?.nouvelleChargeCible
    expect(brute).not.toBe(17.7)
    expect(brute).toBeCloseTo(17.7, 5)
    await act(() => r.result.current.accepter('e1'))
    expect((await objectifs())[0].charge_cible).toBe(17.7)
  })

  it('un second accepter est sans effet', async () => {
    await exercice('e1', { exercise_id: 'x1', progression_activee: 1 })
    await series('e1', [[8, 60], [8, 60], [8, 60]])
    const r = await monter()
    await act(() => r.result.current.accepter('e1'))
    // Modification extérieure : un second accepter ne doit pas la réécrire
    await db.execute('UPDATE objectifs_progression SET charge_cible = 99')
    await act(() => r.result.current.accepter('e1'))
    await act(() => r.result.current.refuser('e1'))
    expect(propositionDe(r, 'e1')?.etat).toBe('acceptee')
    expect((await objectifs()).map((o) => o.charge_cible)).toEqual([99])
  })

  it('instance déjà évaluée : un échec simple est affiché sans AUCUNE écriture silencieuse', async () => {
    await exercice('e1', { exercise_id: 'x1', progression_activee: 1, seuil_deload: 3 })
    await objectifStocke('x1', { charge_cible: 50, reps_cible: 8, compteur_echec: 0 })
    await series('e1', [[7, 50], [7, 50], [7, 50]])
    const avant = await objectifs()
    const r = await monter()
    expect(propositionDe(r, 'e1')).toMatchObject({ aValider: false, actionnable: false, etat: 'en_attente' })
    expect(await objectifs()).toEqual(avant)
    expect(await marqueur()).toEqual({ evaluee: true, decisions: {} })
  })

  it('instance web héritée (marqueur NULL) : évaluée une seule fois, même si le bilan est ouvert deux fois', async () => {
    await db.execute("UPDATE instances_seance SET progression_json = NULL WHERE id = 'i1'")
    await exercice('e1', { exercise_id: 'x1', progression_activee: 1, seuil_deload: 3 })
    await objectifStocke('x1', { charge_cible: 50, reps_cible: 8, compteur_echec: 0 })
    await series('e1', [[7, 50], [7, 50], [7, 50]])
    const r = await monter()
    // Échec simple appliqué sans validation : « appliquee_auto », jamais confondu avec un « Oui » explicite
    expect(propositionDe(r, 'e1')).toMatchObject({ etat: 'appliquee_auto', actionnable: false, proposition: null })
    expect(await objectifs()).toEqual([expect.objectContaining({ charge_cible: 50, compteur_echec: 1, derniere_maj: JOUR })])
    expect(await marqueur()).toEqual({ evaluee: true, decisions: { e1: 'appliquee_auto' } })
    r.unmount()
    const bis = await monter()
    expect(propositionDe(bis, 'e1')?.etat).toBe('appliquee_auto')
    expect(await objectifs()).toEqual([expect.objectContaining({ compteur_echec: 1 })])
  })

  it('instance terminée importée d’Android : aucune ré-évaluation ni proposition, même sans marqueur', async () => {
    await db.execute("UPDATE instances_seance SET started_at = NULL WHERE id = 'i1'")
    await exercice('e1', { exercise_id: 'x1', progression_activee: 1, seuil_deload: 3 })
    await objectifStocke('x1', { charge_cible: 50, reps_cible: 8, compteur_echec: 2 })
    await series('e1', [[8, 50], [8, 50], [8, 50]])
    const avant = await objectifs()
    const r = await monter()
    expect(r.result.current.propositions).toEqual([])
    r.unmount()
    // Importée avant la migration 0005 (marqueur absent) : toujours rien
    await db.execute("UPDATE instances_seance SET progression_json = NULL WHERE id = 'i1'")
    const bis = await monter()
    expect(bis.result.current.propositions).toEqual([])
    expect(await objectifs()).toEqual(avant)
    expect(await marqueur()).toBeNull()
  })

  it('un objectif importé daté du même jour ne masque pas la proposition de la séance web', async () => {
    await exercice('e1', { exercise_id: 'x1', progression_activee: 1 })
    await objectifStocke('x1', { charge_cible: 50, reps_cible: 8, compteur_echec: 0, derniere_maj: '2026-10-24' })
    await series('e1', [[8, 50], [8, 50], [8, 50]])
    const r = await monter()
    expect(propositionDe(r, 'e1')).toMatchObject({ actionnable: true, etat: 'en_attente' })
    expect(propositionDe(r, 'e1')?.proposition?.nouvelleChargeCible).toBe(52.5)
  })

  it('les décisions sont enregistrées dans le marqueur et réaffichées à la réouverture', async () => {
    await exercice('e1', { exercise_id: 'x1', progression_activee: 1 })
    await exercice('e3', { exercise_id: 'x3', progression_activee: 1, position: 1 })
    await series('e1', [[8, 60], [8, 60], [8, 60]])
    await series('e3', [[8, 60], [8, 60], [8, 60]])
    const r = await monter()
    await act(() => r.result.current.accepter('e1'))
    await act(() => r.result.current.refuser('e3'))
    expect(await marqueur()).toEqual({ evaluee: true, decisions: { e1: 'acceptee', e3: 'refusee' } })
    r.unmount()
    const bis = await monter()
    expect(bis.result.current.propositions.map((p) => [p.exerciceId, p.etat, p.actionnable])).toEqual([
      ['e1', 'acceptee', false],
      ['e3', 'refusee', false],
    ])
    expect((await objectifs()).map((o) => [o.exercise_id, o.charge_cible])).toEqual([
      ['x1', 62.5],
      ['x3', 60],
    ])
  })

  it('« Déjà décidé » : une décision enregistrée ailleurs entre-temps n’est pas écrasée', async () => {
    await exercice('e1', { exercise_id: 'x1', progression_activee: 1 })
    await series('e1', [[8, 60], [8, 60], [8, 60]])
    const r = await monter()
    // Un autre onglet a refusé pendant que ce bilan était ouvert
    await db.execute('UPDATE instances_seance SET progression_json = ? WHERE id = ?', [
      '{"evaluee":true,"decisions":{"e1":"refusee"}}',
      'i1',
    ])
    await act(() => r.result.current.accepter('e1'))
    expect(propositionDe(r, 'e1')).toMatchObject({ etat: 'refusee', dejaDecide: true, actionnable: false })
    expect(await objectifs()).toEqual([])
    expect(await marqueur()).toEqual({ evaluee: true, decisions: { e1: 'refusee' } })
  })

  it('NON_LOGGE : affiché, non actionnable, rien écrit (comme le récap Android)', async () => {
    await exercice('e1', { exercise_id: 'x1', progression_activee: 1 })
    const r = await monter()
    const p = propositionDe(r, 'e1')
    expect(p?.proposition?.statut).toBe('NON_LOGGE')
    expect(p).toMatchObject({ aValider: true, actionnable: false, etat: 'en_attente' })
    await act(() => r.result.current.accepter('e1'))
    expect(await objectifs()).toEqual([])
  })
})
