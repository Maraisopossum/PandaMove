// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import { useSeanceEdit } from './useSeanceEdit'

async function exercice(db: Db, id: string, name: string, muscles: string[], primary = '') {
  await inserer(db, 'exercises', {
    id, user_id: 'u1', updated_at: 'u', deleted_at: null, name, category: 'OTHER', muscle_groups: JSON.stringify(muscles),
    description: '', is_favorite: 0, is_custom: 0, image_url: null, exercise_type: '', equipment: '[]',
    muscle_primary: primary, is_bodyweight: id === 'pdc' ? 1 : 0,
  })
}

async function catalogue() {
  const db = createTestDb()
  await exercice(db, 'dc', 'Développé couché', ['PECTORAUX', 'TRICEPS'], 'PECTORAUX')
  await exercice(db, 'tr', 'Tractions', ['DOS', 'BICEPS'], 'DOS')
  await exercice(db, 'pdc', 'Pompes', ['PECTORAUX'], 'PECTORAUX')
  return db
}

// Séance modèle s1 : blocs b1[x1,x2] b2[x3] ; plus une instance i1 avec ses propres copies.
async function avecSeance() {
  const db = await catalogue()
  await inserer(db, 'seances', {
    id: 's1', user_id: 'u1', updated_at: 'old', deleted_at: null, nom: 'Pull', groupes_musculaires: '["DOS"]',
    duree_estimee_min: 50, notes: 'n', seance_category: 'STRENGTH', created_at: '2026-01-01T00:00:00Z', is_archived: 0,
  })
  const bloc = (id: string, position: number, instance: string | null, nom: string) =>
    inserer(db, 'blocs_seance', {
      id, user_id: 'u1', updated_at: 'old', deleted_at: null, seance_id: 's1', nom, type: 'ECHAUFFEMENT', position,
      duree_min: null, description: '', temps_repos_inter_sec: 20, temps_repos_fin_round_sec: 120,
      instance_seance_id: instance, bloc_source_id: null,
    })
  const ex = (id: string, blocId: string, position: number, instance: string | null, exoId = 'tr') =>
    inserer(db, 'exercices_seance', {
      id, user_id: 'u1', updated_at: 'old', deleted_at: null, seance_id: 's1', exercise_id: exoId, bloc_id: blocId,
      position, nombre_series_prevues: 3, reps_cibles: '8', charge_cible: '', tempo: '', reps_type: 'REPS',
      temps_repos_sec: 90, consigne_cle: '', equipement: '', avertissement: '', instance_seance_id: instance,
      is_bilateral: 0, progression_activee: 0, increment_duree_sec: 5, seuil_deload: 3, is_bodyweight: 0,
    })
  await bloc('b1', 0, null, 'Bloc 1')
  await bloc('b2', 1, null, 'Bloc 2')
  await ex('x1', 'b1', 0, null)
  await ex('x2', 'b1', 1, null, 'dc')
  await ex('x3', 'b2', 0, null)
  await inserer(db, 'instances_seance', {
    id: 'i1', user_id: 'u1', updated_at: 'old', deleted_at: null, seance_id: 's1', date: '2026-10-01', notes: '',
    is_completed: 0, completed_at: null, duration_seconds: 0, created_at: 'c',
  })
  await bloc('bi1', 0, 'i1', 'Copie bloc 1')
  await bloc('bi2', 1, 'i1', 'Copie bloc 2')
  await ex('xi1', 'bi1', 0, 'i1')
  await ex('xi2', 'bi2', 0, 'i1')
  return db
}

async function monter(db: Db, id: string | null) {
  const rendu = renderHook(() => useSeanceEdit(id, { db }))
  await waitFor(() => expect(rendu.result.current.charge).toBe(true))
  return rendu
}

const instanceRows = async (db: Db) => ({
  blocs: await db.getAll('SELECT * FROM blocs_seance WHERE instance_seance_id IS NOT NULL ORDER BY id'),
  exercices: await db.getAll('SELECT * FROM exercices_seance WHERE instance_seance_id IS NOT NULL ORDER BY id'),
  instances: await db.getAll('SELECT * FROM instances_seance ORDER BY id'),
})

describe('useSeanceEdit : création', () => {
  it('démarre avec les défauts (STRENGTH, 60 min) et un brouillon vide', async () => {
    const { result } = await monter(await catalogue(), null)
    expect(result.current.draft).toMatchObject({ nom: '', dureeEstimeeMin: 60, seanceCategory: 'STRENGTH', existante: false, blocs: [] })
  })

  it("enregistrer renumérote 0..n-1 d'après l'ordre du brouillon malgré des positions périmées", async () => {
    const db = await catalogue()
    const { result } = await monter(db, null)
    act(() => result.current.setNom('  Full body  '))
    act(() => result.current.ajouterBloc())
    act(() => result.current.ajouterBloc('SUPERSET'))
    const [a, b] = result.current.draft.blocs.map((x) => x.id)
    act(() => result.current.ajouterExercice(a, 'dc'))
    act(() => result.current.ajouterExercice(a, 'tr'))
    act(() => result.current.ajouterExercice(b, 'pdc'))
    // Positions périmées volontairement incohérentes, puis déplacement : l'ordre du brouillon fait foi
    act(() => result.current.modifierBloc(a, { position: 40 }))
    act(() => result.current.modifierBloc(b, { position: 3 }))
    for (const e of result.current.draft.blocs.flatMap((x) => x.exercices)) act(() => result.current.modifierExercice(e.id, { position: 99 }))
    const [dc, tr] = result.current.draft.blocs[0].exercices.map((e) => e.id)
    act(() => result.current.deplacer(tr, 0))
    act(() => result.current.deplacerBloc(b, 0))

    let id: string | null = null
    await act(async () => {
      id = await result.current.enregistrer()
    })
    expect(id).toBeTruthy()
    expect(result.current.erreur).toBeNull()

    const blocs = await db.getAll<{ id: string; position: number; seance_id: string; instance_seance_id: string | null }>(
      'SELECT id, position, seance_id, instance_seance_id FROM blocs_seance ORDER BY position',
    )
    expect(blocs.map((x) => [x.id, x.position])).toEqual([[b, 0], [a, 1]])
    expect(blocs.every((x) => x.seance_id === id && x.instance_seance_id === null)).toBe(true)
    const exos = await db.getAll<{ id: string; bloc_id: string; position: number }>(
      'SELECT id, bloc_id, position FROM exercices_seance WHERE bloc_id = ? ORDER BY position', [a],
    )
    expect(exos.map((x) => [x.id, x.position])).toEqual([[tr, 0], [dc, 1]])
    const s = await db.get<Record<string, unknown>>('SELECT * FROM seances WHERE id = ?', [id])
    expect(s).toMatchObject({
      nom: 'Full body', seance_category: 'STRENGTH', duree_estimee_min: 60, is_archived: 0, deleted_at: null,
      groupes_musculaires: '["PECTORAUX","DOS","BICEPS","TRICEPS"]',
    })
    expect(typeof s.created_at).toBe('string')
  })

  it("applique les défauts d'exercice (séries 3, repos 90, REPS, poids de corps hérité)", async () => {
    const db = await catalogue()
    const { result } = await monter(db, null)
    act(() => result.current.setNom('S'))
    act(() => result.current.ajouterBloc())
    act(() => result.current.ajouterExercice(result.current.draft.blocs[0].id, 'pdc'))
    await act(async () => {
      await result.current.enregistrer()
    })
    const e = await db.get<Record<string, unknown>>('SELECT * FROM exercices_seance')
    expect(e).toMatchObject({
      exercise_id: 'pdc', nombre_series_prevues: 3, temps_repos_sec: 90, reps_type: 'REPS', increment_duree_sec: 5,
      seuil_deload: 3, type_exercice: null, is_bodyweight: 1, progression_activee: 0, instance_seance_id: null,
    })
  })

  it('une séance vide mais nommée est enregistrable', async () => {
    const db = await catalogue()
    const { result } = await monter(db, null)
    act(() => result.current.setNom('Vide'))
    await act(async () => {
      expect(await result.current.enregistrer()).toBeTruthy()
    })
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM seances')).n).toBe(1)
  })

  it("renvoie les erreurs de validation dans l'état, sans lancer ni écrire", async () => {
    const db = await catalogue()
    const { result } = await monter(db, null)
    let id: string | null = 'x'
    await act(async () => {
      id = await result.current.enregistrer()
    })
    expect(id).toBeNull()
    expect(result.current.erreur).toBe('Le nom de la séance est obligatoire.')
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM seances')).n).toBe(0)
    // Corrigée : l'erreur disparaît
    act(() => result.current.setNom('OK'))
    await act(async () => {
      id = await result.current.enregistrer()
    })
    expect(id).toBeTruthy()
    expect(result.current.erreur).toBeNull()
  })

  it('ignore un exercice du catalogue inconnu', async () => {
    const { result } = await monter(await catalogue(), null)
    act(() => result.current.ajouterBloc())
    act(() => result.current.ajouterExercice(result.current.draft.blocs[0].id, 'inconnu'))
    expect(result.current.draft.blocs[0].exercices).toEqual([])
  })

  it('la recherche du sélecteur ignore accents et casse', async () => {
    const { result } = await monter(await catalogue(), null)
    expect(result.current.catalogue.map((e) => e.name)).toEqual(['Développé couché', 'Pompes', 'Tractions'])
    act(() => result.current.setRecherche('DEVELOPPE'))
    expect(result.current.catalogue.map((e) => e.id)).toEqual(['dc'])
  })
})

describe('useSeanceEdit : modification d\'un modèle', () => {
  it('charge le modèle (sans les lignes d\'instance) dans le brouillon', async () => {
    const { result } = await monter(await avecSeance(), 's1')
    const d = result.current.draft
    expect(d).toMatchObject({ id: 's1', nom: 'Pull', existante: true, dureeEstimeeMin: 50 })
    expect(d.blocs.map((b) => [b.id, b.exercices.map((e) => e.id)])).toEqual([['b1', ['x1', 'x2']], ['b2', ['x3']]])
    expect(d.blocs[0].exercices[0].exerciseNom).toBe('Tractions')
  })

  it('séance inconnue : erreur française, rien à enregistrer', async () => {
    const { result } = await monter(await avecSeance(), 'nope')
    expect(result.current.erreur).toMatch(/introuvable/i)
    let id: string | null = 'x'
    await act(async () => {
      id = await result.current.enregistrer()
    })
    expect(id).toBeNull()
  })

  it('retire un bloc : ses lignes sont supprimées logiquement, les autres mises à jour, les instances intactes', async () => {
    const db = await avecSeance()
    const avant = await instanceRows(db)
    const { result } = await monter(db, 's1')
    act(() => result.current.supprimerBloc('b2'))
    act(() => result.current.modifierExercice('x1', { nombreSeriesPrevues: 5 }))
    act(() => result.current.supprimerExercice('x2'))
    await act(async () => {
      expect(await result.current.enregistrer()).toBe('s1')
    })

    const ligne = (table: string, id: string) =>
      db.get<{ deleted_at: string | null; updated_at: string; nombre_series_prevues?: number }>(`SELECT * FROM ${table} WHERE id = ?`, [id])
    for (const [table, id] of [['blocs_seance', 'b2'], ['exercices_seance', 'x2'], ['exercices_seance', 'x3']] as const) {
      const l = await ligne(table, id)
      expect(l.deleted_at, id).not.toBeNull()
      expect(l.updated_at, id).not.toBe('old')
    }
    const x1 = await ligne('exercices_seance', 'x1')
    expect(x1).toMatchObject({ deleted_at: null, nombre_series_prevues: 5 })
    expect(x1.updated_at).not.toBe('old')
    expect((await ligne('blocs_seance', 'b1')).deleted_at).toBeNull()
    // Aucune ligne dupliquée
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM blocs_seance WHERE instance_seance_id IS NULL')).n).toBe(2)
    // Instances : strictement inchangées (y compris updated_at)
    expect(await instanceRows(db)).toEqual(avant)
    // Séance : même ligne, created_at et archivage conservés
    const s = await db.get<Record<string, unknown>>('SELECT * FROM seances WHERE id = ?', ['s1'])
    expect(s).toMatchObject({ created_at: '2026-01-01T00:00:00Z', is_archived: 0, notes: 'n' })
    expect(s.groupes_musculaires).toBe('["DOS","BICEPS"]')
  })

  it("un enregistrement sans changement ne touche pas aux lignes d'instance", async () => {
    const db = await avecSeance()
    const avant = await instanceRows(db)
    const { result } = await monter(db, 's1')
    act(() => result.current.setNom('Pull renommé'))
    await act(async () => {
      await result.current.enregistrer()
    })
    expect(await instanceRows(db)).toEqual(avant)
    expect((await db.get<{ nom: string }>('SELECT nom FROM seances WHERE id = ?', ['s1'])).nom).toBe('Pull renommé')
  })

  it('déplacer un exercice vers un autre bloc met à jour son bloc_id et renumérote', async () => {
    const db = await avecSeance()
    const { result } = await monter(db, 's1')
    act(() => result.current.deplacer('x1', 0, 'b2'))
    await act(async () => {
      await result.current.enregistrer()
    })
    const l = await db.getAll<{ id: string; bloc_id: string; position: number }>(
      'SELECT id, bloc_id, position FROM exercices_seance WHERE instance_seance_id IS NULL AND deleted_at IS NULL ORDER BY bloc_id, position',
    )
    expect(l.map((x) => [x.id, x.bloc_id, x.position])).toEqual([['x2', 'b1', 0], ['x1', 'b2', 0], ['x3', 'b2', 1]])
  })

  it('un exercice sans bloc est regroupé dans un bloc sans perte', async () => {
    const db = await avecSeance()
    await db.execute("UPDATE exercices_seance SET bloc_id = NULL WHERE id = 'x3'")
    const { result } = await monter(db, 's1')
    expect(result.current.draft.blocs.flatMap((b) => b.exercices.map((e) => e.id)).sort()).toEqual(['x1', 'x2', 'x3'])
  })

  it("l'échec d'écriture est signalé sans lancer", async () => {
    const db = await avecSeance()
    const { result } = await monter(db, 's1')
    const erreurConsole = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const casse: Db = { ...db, writeTransaction: () => Promise.reject(new Error('boum')) }
    const rendu = renderHook(() => useSeanceEdit('s1', { db: casse }))
    await waitFor(() => expect(rendu.result.current.charge).toBe(true))
    let id: string | null = 'x'
    await act(async () => {
      id = await rendu.result.current.enregistrer()
    })
    expect(id).toBeNull()
    expect(rendu.result.current.erreur).toBe("L'enregistrement a échoué.")
    expect(erreurConsole).toHaveBeenCalled()
    erreurConsole.mockRestore()
    expect(result.current.erreur).toBeNull()
  })
})
