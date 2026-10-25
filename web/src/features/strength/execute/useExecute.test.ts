// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../../core/db/Db'
import { deterministicId } from '../../../core/db/ids'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'
import { useExecute } from './useExecute'

// Horloge injectée : chaque test fait avancer `t` à la main (aucune dépendance au temps réel).
const T0 = Date.parse('2026-10-24T10:00:00.000Z')
const min = (n: number) => n * 60_000
let t = T0
const horloge = () => t

const base = { user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: null }

async function semer(db: Db) {
  await inserer(db, 'seances', { ...base, id: 's1', nom: 'Haut du corps', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
  await inserer(db, 'exercises', { ...base, id: 'x1', name: 'Développé couché', is_bodyweight: 0 })
  await inserer(db, 'exercises', { ...base, id: 'x2', name: 'Gainage planche', is_bodyweight: 1 })
  await inserer(db, 'blocs_seance', {
    ...base, id: 'b1', seance_id: 's1', nom: 'Bloc principal', type: 'SUPERSET', position: 0, instance_seance_id: null,
  })
  await inserer(db, 'exercices_seance', {
    ...base, id: 'e1', seance_id: 's1', exercise_id: 'x1', bloc_id: 'b1', superset_groupe: 'A', position: 0,
    nombre_series_prevues: 3, reps_cibles: '8-10', charge_cible: '60 kg', reps_type: 'REPS', temps_repos_sec: 90,
    instance_seance_id: null,
  })
  await inserer(db, 'exercices_seance', {
    ...base, id: 'e2', seance_id: 's1', exercise_id: 'x2', bloc_id: 'b1', superset_groupe: 'A', position: 1,
    nombre_series_prevues: 2, reps_cibles: '45s', charge_cible: 'PDC', reps_type: 'DURATION', temps_repos_sec: 60,
    instance_seance_id: null,
  })
  // Instance planifiée (non copiée) et instance terminée sans lignes
  await inserer(db, 'instances_seance', {
    ...base, id: 'i1', seance_id: 's1', date: '2026-10-24', notes: '', is_completed: 0, completed_at: null, duration_seconds: 0, created_at: 'c',
  })
  await inserer(db, 'instances_seance', {
    ...base, id: 'i2', seance_id: 's1', date: '2026-10-01', notes: '', is_completed: 1, completed_at: '2026-10-01T11:00:00.000Z',
    duration_seconds: 3000, created_at: 'c',
  })
}

const E1 = deterministicId('i1', 'e1')
const E2 = deterministicId('i1', 'e2')

let db: Db
beforeEach(async () => {
  t = T0
  db = createTestDb()
  await semer(db)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function monter(instanceId = 'i1', d: Db = db, tickMs?: number) {
  const rendu = renderHook(() => useExecute(instanceId, { db: d, nowFn: horloge, tickMs }))
  await waitFor(() => expect(rendu.result.current.chargement).toBe(false))
  return rendu
}

const lignesSeries = (d: Db = db) =>
  d.getAll<{ id: string; exercice_seance_id: string; numero_serie: number; reps_realisees: number; charge_kg: number | null; rpe: number | null; is_completed: number }>(
    'SELECT id, exercice_seance_id, numero_serie, reps_realisees, charge_kg, rpe, is_completed FROM series_realisees ORDER BY numero_serie',
  )
const nbLignesInstance = async (instanceId: string) =>
  (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM exercices_seance WHERE instance_seance_id = ?', [instanceId])).n

describe('useExecute : ouverture et copie', () => {
  it("séance supprimée avec historique gardé : la séance jouée garde le nom de sa séance", async () => {
    await db.execute("UPDATE instances_seance SET is_completed = 1, completed_at = '2026-10-24T11:00:00.000Z' WHERE id = 'i1'")
    await db.execute("UPDATE seances SET deleted_at = '2026-10-25T08:00:00.000Z'")
    const r = await monter()
    expect(r.result.current.nomSeance).toBe('Haut du corps')
  })

  it('copie le modèle à la première ouverture d\'une instance planifiée, sans doublon à la réouverture', async () => {
    const r = await monter()
    expect(r.result.current.erreur).toBeNull()
    expect(r.result.current.nomSeance).toBe('Haut du corps')
    expect(r.result.current.exercices.map((e) => [e.id, e.nom])).toEqual([
      [E1, 'Développé couché'],
      [E2, 'Gainage planche'],
    ])
    expect(r.result.current.exercices[0]).toMatchObject({
      repsCibles: '8-10', chargeCible: '60 kg', nombreSeriesPrevues: 3, tempsReposSec: 90, libelleSuperset: 'Superset A', series: [],
    })
    expect(r.result.current.blocs.map((b) => [b.nom, b.exercices.length])).toEqual([['Bloc principal', 2]])
    expect(await nbLignesInstance('i1')).toBe(2)
    r.unmount()

    await monter()
    expect(await nbLignesInstance('i1')).toBe(2)
    // Le modèle n'est jamais modifié
    expect(await nbLignesInstance('i1')).toBe(2)
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM exercices_seance WHERE instance_seance_id IS NULL')).n).toBe(2)
  })

  it('une instance terminée sans lignes n\'est PAS remplie avec le modèle courant (lecture seule)', async () => {
    const r = await monter('i2')
    expect(r.result.current.terminee).toBe(true)
    expect(r.result.current.exercices).toEqual([])
    expect(await nbLignesInstance('i2')).toBe(0)
  })

  it('une instance introuvable affiche une erreur en français', async () => {
    const r = await monter('absente')
    expect(r.result.current.erreur).toBe('Séance introuvable.')
  })
})

describe('useExecute : chrono', () => {
  it('demarrer est idempotent (le premier démarrage est conservé)', async () => {
    const r = await monter()
    expect(r.result.current.demarre).toBe(false)
    expect(r.result.current.elapsedMs).toBe(0)
    await act(() => r.result.current.demarrer())
    t = T0 + min(5)
    await act(() => r.result.current.demarrer())
    expect(r.result.current.demarre).toBe(true)
    expect(r.result.current.elapsedMs).toBe(min(5))
    const ligne = await db.get<{ started_at: string }>("SELECT started_at FROM instances_seance WHERE id = 'i1'")
    expect(ligne.started_at).toBe('2026-10-24T10:00:00.000Z')
  })

  it('pause / reprendre : le temps en pause est exclu, recalculé à chaque tic', async () => {
    const r = await monter('i1', db, 10)
    await act(() => r.result.current.demarrer())
    t = T0 + min(10)
    await act(() => r.result.current.pause())
    expect(r.result.current.enPause).toBe(true)
    expect(r.result.current.elapsedMs).toBe(min(10))
    t = T0 + min(15)
    await waitFor(() => expect(r.result.current.elapsedMs).toBe(min(10)))
    await act(() => r.result.current.reprendre())
    expect(r.result.current.enPause).toBe(false)
    t = T0 + min(20)
    // Le tic (10 ms ici) relit l'horloge injectée : 20 - 5 min de pause
    await waitFor(() => expect(r.result.current.elapsedMs).toBe(min(15)))
    const ligne = await db.get<{ paused_json: string }>("SELECT paused_json FROM instances_seance WHERE id = 'i1'")
    expect(JSON.parse(ligne.paused_json)).toEqual([{ fromMs: T0 + min(10), toMs: T0 + min(15) }])
  })

  it('terminer ferme la pause ouverte, renseigne les champs de fin et est idempotent', async () => {
    const r = await monter()
    await act(() => r.result.current.demarrer())
    t = T0 + min(5)
    await act(() => r.result.current.pause())
    t = T0 + min(30)
    await act(() => r.result.current.terminer())
    expect(r.result.current.terminee).toBe(true)
    t = T0 + min(40)
    await act(() => r.result.current.terminer())
    const ligne = await db.get<{ is_completed: number; completed_at: string; duration_seconds: number; paused_json: string }>(
      "SELECT is_completed, completed_at, duration_seconds, paused_json FROM instances_seance WHERE id = 'i1'",
    )
    expect(ligne).toMatchObject({ is_completed: 1, completed_at: '2026-10-24T10:30:00.000Z', duration_seconds: 300 })
    expect(JSON.parse(ligne.paused_json)).toEqual([{ fromMs: T0 + min(5), toMs: T0 + min(30) }])
    expect(r.result.current.elapsedMs).toBe(min(5))
    expect(r.result.current.reposRestantMs).toBeNull()
  })
})

describe('useExecute : séries', () => {
  it('validerSerie écrit en base immédiatement (relue sans état React)', async () => {
    const r = await monter()
    await act(() => r.result.current.demarrer())
    await act(() => r.result.current.validerSerie(E1, { reps: 8, chargeKg: 17.5, rpe: 8 }))
    expect(await lignesSeries()).toEqual([
      { id: expect.any(String), exercice_seance_id: E1, numero_serie: 1, reps_realisees: 8, charge_kg: 17.5, rpe: 8, is_completed: 1 },
    ])
    expect(r.result.current.exercices[0].series).toMatchObject([{ numero: 1, reps: 8, chargeKg: 17.5, rpe: 8 }])
  })

  it('valider une série démarre le chrono si on avait oublié « Démarrer »', async () => {
    const r = await monter()
    await act(() => r.result.current.validerSerie(E1, { reps: 8, chargeKg: 60, rpe: null }))
    expect(r.result.current.demarre).toBe(true)
  })

  it('double appui sur « Valider la série » : une seule série enregistrée, le second appui est ignoré', async () => {
    const r = await monter()
    let resultats: boolean[] = []
    await act(async () => {
      resultats = await Promise.all([
        r.result.current.validerSerie(E1, { reps: 10, chargeKg: 60, rpe: null }),
        r.result.current.validerSerie(E1, { reps: 10, chargeKg: 60, rpe: null }),
      ])
    })
    expect(resultats).toEqual([true, false])
    expect((await lignesSeries()).map((l) => [l.numero_serie, l.reps_realisees])).toEqual([[1, 10]])
    expect(r.result.current.validationEnCours(E1)).toBe(false)
  })

  it("validationEnCours vaut vrai pendant l'enregistrement, pour cet exercice seulement", async () => {
    let liberer: () => void = () => {}
    let bloquer = false
    const bloquee: Db = {
      ...db,
      writeTransaction: async (fn) => {
        if (bloquer) await new Promise<void>((ok) => (liberer = ok))
        return db.writeTransaction(fn)
      },
    }
    const r = await monter('i1', bloquee)
    bloquer = true
    let enCours: Promise<boolean> = Promise.resolve(false)
    act(() => {
      enCours = r.result.current.validerSerie(E1, { reps: 8, chargeKg: 60, rpe: null })
    })
    await waitFor(() => expect(r.result.current.validationEnCours(E1)).toBe(true))
    expect(r.result.current.validationEnCours(E2)).toBe(false)
    await act(async () => {
      liberer()
      await enCours
    })
    expect(r.result.current.validationEnCours(E1)).toBe(false)
  })

  it('deux séries successives donnent les numéros 1 et 2 avec des UUID distincts', async () => {
    const r = await monter()
    await act(() => r.result.current.validerSerie(E1, { reps: 10, chargeKg: 60, rpe: null }))
    await act(() => r.result.current.validerSerie(E1, { reps: 9, chargeKg: 60, rpe: null }))
    const lignes = await lignesSeries()
    expect(lignes.map((l) => [l.numero_serie, l.reps_realisees])).toEqual([[1, 10], [2, 9]])
    expect(new Set(lignes.map((l) => l.id)).size).toBe(2)
    expect(r.result.current.exercices[0].series.map((s) => s.numero)).toEqual([1, 2])
  })

  it("le numéro de série (max + 1) et l'insertion sont faits dans UNE transaction", async () => {
    const horsTransaction: string[] = []
    const espion: Db = {
      ...db,
      execute: async (sql, params) => {
        horsTransaction.push(sql)
        return db.execute(sql, params)
      },
      getAll: async (sql, params) => {
        horsTransaction.push(sql)
        return db.getAll(sql, params)
      },
    }
    const r = await monter('i1', espion)
    horsTransaction.length = 0
    await act(() => r.result.current.validerSerie(E1, { reps: 8, chargeKg: 60, rpe: null }))
    expect(await lignesSeries()).toHaveLength(1)
    // Ni la lecture des séries existantes ni l'INSERT ne passent par la base hors transaction
    // (seule la relecture d'affichage, après coup, lit les séries hors transaction)
    const ecritures = horsTransaction.filter((sql) => /INSERT INTO series_realisees/.test(sql))
    expect(ecritures).toEqual([])
  })

  it('corrigerSerie modifie la même ligne (aucune nouvelle ligne)', async () => {
    const r = await monter()
    await act(() => r.result.current.validerSerie(E1, { reps: 8, chargeKg: 60, rpe: null }))
    const [avant] = await lignesSeries()
    await act(() => r.result.current.corrigerSerie(avant.id, { reps: 7, rpe: 9 }))
    const lignes = await lignesSeries()
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({ id: avant.id, numero_serie: 1, reps_realisees: 7, charge_kg: 60, rpe: 9 })
    expect(r.result.current.exercices[0].series).toMatchObject([{ id: avant.id, reps: 7, rpe: 9 }])
  })

  it('corriger une série ne relance pas le décompte du repos (ancre = instant de validation)', async () => {
    const r = await monter()
    await act(() => r.result.current.demarrer())
    // Superset A : E1 puis E2 (dernier du groupe, repos 60 s) avant que le repos ne parte
    await act(() => r.result.current.validerSerie(E1, { reps: 8, chargeKg: 60, rpe: null }))
    t = T0 + 5_000
    await act(() => r.result.current.validerSerie(E2, { reps: 45, chargeKg: null, rpe: null }))
    t = T0 + 30_000
    const serie = (await lignesSeries()).find((l) => l.exercice_seance_id === E2)!
    await act(() => r.result.current.corrigerSerie(serie.id, { reps: 40 }))
    expect(r.result.current.reposRestantMs).toBe(35_000)
  })

  it('DURATION : la valeur saisie est en secondes et le libellé le dit', async () => {
    const r = await monter()
    const gainage = r.result.current.exercices[1]
    expect(gainage.repsType).toBe('DURATION')
    expect(gainage.libelleReps).toBe('Durée (s)')
    expect(r.result.current.exercices[0].libelleReps).toBe('Répétitions')
    await act(() => r.result.current.validerSerie(E2, { reps: 45, chargeKg: null, rpe: null }))
    expect((await lignesSeries())[0]).toMatchObject({ exercice_seance_id: E2, reps_realisees: 45, charge_kg: null })
  })

  it('une saisie invalide est refusée avec un message français, sans écriture', async () => {
    const r = await monter()
    await act(() => r.result.current.validerSerie(E1, { reps: Number.NaN, chargeKg: 60, rpe: null }))
    expect(r.result.current.erreur).toBe('Saisissez un nombre de répétitions entier.')
    await act(() => r.result.current.validerSerie(E2, { reps: 4.5, chargeKg: null, rpe: null }))
    expect(r.result.current.erreur).toBe('Saisissez une durée en secondes (nombre entier).')
    await act(() => r.result.current.validerSerie(E1, { reps: 8, chargeKg: -5, rpe: null }))
    expect(r.result.current.erreur).toBe('La charge doit être un nombre positif (kg).')
    await act(() => r.result.current.validerSerie(E1, { reps: 8, chargeKg: 60, rpe: 11 }))
    expect(r.result.current.erreur).toBe('Le RPE doit être compris entre 1 et 10.')
    expect(await lignesSeries()).toEqual([])
    // Une saisie valide efface l'erreur
    await act(() => r.result.current.validerSerie(E1, { reps: 8, chargeKg: 60, rpe: 8.5 }))
    expect(r.result.current.erreur).toBeNull()
  })

  it('un échec d\'écriture est affiché en français sans planter le hook', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const panne: Db = {
      ...db,
      writeTransaction: (fn) =>
        db.writeTransaction((tx) =>
          fn({
            ...tx,
            execute: async (sql, params) => {
              if (/INTO series_realisees/.test(sql)) throw new Error('disque plein')
              return tx.execute(sql, params)
            },
          }),
        ),
    }
    const r = await monter('i1', panne)
    await act(() => r.result.current.validerSerie(E1, { reps: 8, chargeKg: 60, rpe: null }))
    expect(r.result.current.erreur).toBe("L'enregistrement de la série a échoué. Réessayez.")
    expect(r.result.current.exercices).toHaveLength(2)
    expect(await lignesSeries()).toEqual([])
  })

  it('une séance terminée est en lecture seule (aucune série ajoutée ni corrigée)', async () => {
    const r = await monter()
    await act(() => r.result.current.validerSerie(E1, { reps: 8, chargeKg: 60, rpe: null }))
    const [serie] = await lignesSeries()
    await act(() => r.result.current.terminer())
    await act(() => r.result.current.validerSerie(E1, { reps: 8, chargeKg: 60, rpe: null }))
    expect(r.result.current.erreur).toBe("Cette séance est terminée : elle n'est plus modifiable.")
    await act(() => r.result.current.corrigerSerie(serie.id, { reps: 1 }))
    expect(await lignesSeries()).toMatchObject([{ id: serie.id, reps_realisees: 8 }])
  })
})

describe('useExecute : reprise après rechargement', () => {
  it('un nouveau hook sur la même base restitue séries, temps écoulé et repos', async () => {
    const r = await monter()
    await act(() => r.result.current.demarrer())
    t = T0 + min(1)
    await act(() => r.result.current.validerSerie(E1, { reps: 10, chargeKg: 60, rpe: 7 }))
    // Superset A : E1 n'est pas le dernier du groupe, on enchaîne avec E2 sans repos
    expect(r.result.current.reposRestantMs).toBeNull()
    t = T0 + min(1) + 10_000
    await act(() => r.result.current.validerSerie(E2, { reps: 45, chargeKg: null, rpe: null }))
    t = T0 + min(2)
    await act(() => r.result.current.validerSerie(E1, { reps: 9, chargeKg: 60, rpe: 8 }))
    expect(r.result.current.reposRestantMs).toBeNull()
    await act(() => r.result.current.validerSerie(E2, { reps: 40, chargeKg: null, rpe: null }))
    expect(r.result.current.reposRestantMs).toBe(60_000)
    r.unmount()

    // « Rechargement de la page » 30 s plus tard : aucun état React ne survit
    t = T0 + min(2) + 30_000
    const r2 = await monter()
    expect(r2.result.current.demarre).toBe(true)
    expect(r2.result.current.exercices[0].series).toMatchObject([
      { numero: 1, reps: 10, chargeKg: 60, rpe: 7 },
      { numero: 2, reps: 9, chargeKg: 60, rpe: 8 },
    ])
    expect(r2.result.current.elapsedMs).toBe(min(2) + 30_000)
    expect(r2.result.current.reposRestantMs).toBe(30_000)

    // Le repos est borné à 0 et disparaît en pause
    t = T0 + min(10)
    await act(() => r2.result.current.pause())
    expect(r2.result.current.reposRestantMs).toBeNull()
    await act(() => r2.result.current.reprendre())
    expect(r2.result.current.reposRestantMs).toBe(0)
  })

  it('pas de repos tant qu\'aucune série n\'est saisie', async () => {
    const r = await monter()
    await act(() => r.result.current.demarrer())
    expect(r.result.current.reposRestantMs).toBeNull()
  })
})

describe('useExecute : progression appliquée à « Terminer » (ordre Android)', () => {
  // Séance dédiée : un exercice en progression (cible 8 reps à 50 kg, deload au 3e échec)
  async function semerProgression(d: Db, instances: string[]) {
    await inserer(d, 'seances', { ...base, id: 'sp', nom: 'Progression', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
    await inserer(d, 'exercices_seance', {
      ...base, id: 'ep1', seance_id: 'sp', exercise_id: 'x1', bloc_id: null, position: 0, nombre_series_prevues: 3,
      reps_cibles: '8', charge_cible: '50 kg', reps_type: 'REPS', temps_repos_sec: 90, instance_seance_id: null,
      progression_activee: 1, systeme_progression: 'LINEAIRE', increment_kg: 2.5, increment_duree_sec: 5, seuil_deload: 3,
    })
    for (const id of instances) {
      await inserer(d, 'instances_seance', {
        ...base, id, seance_id: 'sp', date: '2026-10-24', notes: '', is_completed: 0, completed_at: null, duration_seconds: 0, created_at: 'c',
      })
    }
  }

  // Ouvre l'instance (copie du modèle), saisit trois séries puis termine
  async function seanceJouee(instanceId: string, reps: number, d: Db = db) {
    const r = await monter(instanceId, d)
    const ex = deterministicId(instanceId, 'ep1')
    for (let i = 0; i < 3; i++) await act(() => r.result.current.validerSerie(ex, { reps, chargeKg: 50, rpe: null }))
    await act(() => r.result.current.terminer())
    return { r, ex }
  }

  const objectifsSp = () =>
    db.getAll<{ id: string; charge_cible: number; reps_cible: number; compteur_echec: number; derniere_maj: string }>(
      "SELECT id, charge_cible, reps_cible, compteur_echec, derniere_maj FROM objectifs_progression WHERE seance_id = 'sp' AND deleted_at IS NULL",
    )
  const instanceSp = (id: string) =>
    db.get<{ is_completed: number; progression_json: string | null }>(
      'SELECT is_completed, progression_json FROM instances_seance WHERE id = ?',
      [id],
    )
  const jourLocal = () => {
    const d = new Date(T0)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  it("un échec simple incrémente le compteur dans la transaction de fin et marque l'instance évaluée ; un second terminer ne refait rien", async () => {
    await semerProgression(db, ['ia'])
    const { r, ex } = await seanceJouee('ia', 7)
    expect(r.result.current.erreur).toBeNull()
    expect(await objectifsSp()).toEqual([
      { id: deterministicId('sp', 'x1'), charge_cible: 50, reps_cible: 8, compteur_echec: 1, derniere_maj: jourLocal() },
    ])
    const inst = await instanceSp('ia')
    expect(inst.is_completed).toBe(1)
    expect(JSON.parse(inst.progression_json ?? 'null')).toEqual({ evaluee: true, decisions: { [ex]: 'appliquee_auto' } })

    t = T0 + min(10)
    await act(() => r.result.current.terminer())
    expect((await objectifsSp()).map((o) => o.compteur_echec)).toEqual([1])
  })

  it("un succès (à valider) n'écrit rien à la fin : l'instance est seulement marquée évaluée", async () => {
    await semerProgression(db, ['ia'])
    await seanceJouee('ia', 8)
    expect(await objectifsSp()).toEqual([])
    expect(JSON.parse((await instanceSp('ia')).progression_json ?? 'null')).toEqual({ evaluee: true, decisions: {} })
  })

  it("une évaluation qui échoue annule la clôture (instance non terminée, compteur inchangé) avec un message français", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await semerProgression(db, ['ia'])
    const panne: Db = {
      ...db,
      writeTransaction: (fn) =>
        db.writeTransaction((tx) =>
          fn({
            ...tx,
            execute: async (sql, params) => {
              if (/objectifs_progression/.test(sql)) throw new Error('disque plein')
              return tx.execute(sql, params)
            },
          }),
        ),
    }
    const { r } = await seanceJouee('ia', 7, panne)
    expect(r.result.current.erreur).toBe("L'enregistrement de la fin de séance a échoué.")
    expect(r.result.current.terminee).toBe(false)
    expect(await instanceSp('ia')).toEqual({ is_completed: 0, progression_json: null })
    expect(await objectifsSp()).toEqual([])
  })

  it('deux séances terminées dans le désordre sont chacune évaluées à leur propre fin (aucune masquée)', async () => {
    await semerProgression(db, ['ia', 'ib'])
    const b = await seanceJouee('ib', 7)
    b.r.unmount()
    t = T0 + min(60)
    await seanceJouee('ia', 7)
    expect((await objectifsSp()).map((o) => o.compteur_echec)).toEqual([2])
    expect(JSON.parse((await instanceSp('ia')).progression_json ?? 'null').evaluee).toBe(true)
    expect(JSON.parse((await instanceSp('ib')).progression_json ?? 'null').evaluee).toBe(true)
  })

  it("un objectif importé daté du même jour n'empêche pas l'évaluation de la séance web", async () => {
    await semerProgression(db, ['ia'])
    await inserer(db, 'objectifs_progression', {
      ...base, id: 'obj-import', seance_id: 'sp', exercise_id: 'x1', charge_cible: 50, reps_cible: 8, duree_cible_sec: null,
      compteur_echec: 0, derniere_maj: jourLocal(), nombre_series_cible: null,
    })
    await seanceJouee('ia', 7)
    expect(await objectifsSp()).toEqual([expect.objectContaining({ id: 'obj-import', compteur_echec: 1 })])
  })
})

describe('useExecute : tableau de séries (lignes, dé-validation, ajout, suppression)', () => {
  const vivantes = () => db.getAll<{ numero_serie: number; notes: string }>('SELECT numero_serie, notes FROM series_realisees WHERE deleted_at IS NULL ORDER BY numero_serie')
  const prevues = (id: string) => db.get<{ n: number }>('SELECT nombre_series_prevues AS n FROM exercices_seance WHERE id = ?', [id])

  it('valide une ligne à son rang (pas le suivant libre) ; une ligne déjà validée est refusée', async () => {
    const r = await monter()
    await act(() => r.result.current.validerSerie(E1, { reps: 8, chargeKg: 60, rpe: null }, 2))
    expect(await vivantes()).toEqual([{ numero_serie: 2, notes: '' }])
    await act(() => r.result.current.validerSerie(E1, { reps: 9, chargeKg: 60, rpe: null }, 2))
    expect(r.result.current.erreur).toBe('Cette série est déjà validée.')
    expect(await vivantes()).toHaveLength(1)
  })

  it('une ligne laissée non validée est remplacée par la série validée ; le côté est enregistré', async () => {
    await db.execute("INSERT INTO series_realisees (id, user_id, updated_at, instance_seance_id, exercice_seance_id, numero_serie, reps_realisees, is_completed, notes) VALUES ('vieille', 'u1', 'u', 'i1', ?, 1, 5, 0, 'G')", [E1])
    const r = await monter()
    await act(() => r.result.current.validerSerie(E1, { reps: 8, chargeKg: null, rpe: null }, 1, 'G'))
    expect(await vivantes()).toEqual([{ numero_serie: 1, notes: 'G' }])
    expect((await db.get<{ deleted_at: string | null }>("SELECT deleted_at FROM series_realisees WHERE id = 'vieille'")).deleted_at).not.toBeNull()
  })

  it('devaliderSerie masque la série (suppression logique) et la ligne redevient à valider', async () => {
    const r = await monter()
    await act(() => r.result.current.validerSerie(E1, { reps: 8, chargeKg: null, rpe: null }, 1))
    await act(() => r.result.current.devaliderSerie(E1, 1))
    expect(await vivantes()).toEqual([])
    expect(await lignesSeries()).toHaveLength(1)
    expect(r.result.current.exercices[0].series).toEqual([])
  })

  it("ajouterSerie / supprimerSerie : séries prévues de la ligne d'instance, jamais du modèle", async () => {
    const r = await monter()
    await act(() => r.result.current.ajouterSerie(E1))
    expect((await prevues(E1)).n).toBe(4)
    expect((await prevues('e1')).n).toBe(3)
    expect(r.result.current.exercices[0].nombreSeriesPrevues).toBe(4)
    await act(() => r.result.current.validerSerie(E1, { reps: 8, chargeKg: null, rpe: null }, 4))
    await act(() => r.result.current.supprimerSerie(E1))
    expect((await prevues(E1)).n).toBe(3)
    expect(await vivantes()).toEqual([])
    expect(await lignesSeries()).toHaveLength(1)
  })

  it('supprimerSerie garde au moins une série ; en bilatéral retire un tour G+D', async () => {
    const r = await monter()
    await db.execute('UPDATE exercices_seance SET nombre_series_prevues = 1 WHERE id = ?', [E2])
    await act(() => r.result.current.supprimerSerie(E2))
    expect(r.result.current.erreur).toBe('Il faut garder au moins une série.')
    await db.execute('UPDATE exercices_seance SET nombre_series_prevues = 2, is_bilateral = 1 WHERE id = ?', [E2])
    await act(() => r.result.current.validerSerie(E2, { reps: 30, chargeKg: null, rpe: null }, 4, 'D'))
    await act(() => r.result.current.validerSerie(E2, { reps: 30, chargeKg: null, rpe: null }, 3, 'G'))
    await act(() => r.result.current.supprimerSerie(E2))
    expect((await prevues(E2)).n).toBe(1)
    expect(await vivantes()).toEqual([])
  })
})
