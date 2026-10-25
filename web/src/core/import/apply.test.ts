import { beforeEach, describe, expect, it } from 'vitest'
import type { Db, DbTx } from '../db/Db'
import { deterministicId } from '../db/ids'
import { copyTemplateToInstance } from '../db/repos/instances'
import { getSettings, saveSettings } from '../db/repos/settings'
import { createTestDb } from '../../test/sqliteDb'
import { applyImportPlan } from './apply'
import catalogue from './__fixtures__/catalogue.json'
import exportV32 from './__fixtures__/export-v3.2.json'
import materiel from './__fixtures__/materiel.json'
import { parseImportFile } from './parseFile'
import { buildImportPlan, ImportError, type ImportPlan } from './plan'

const USER = '11111111-1111-4111-8111-111111111111'
const NOW = '2026-10-24T12:00:00.000Z'
const TABLES = [
  'exercises', 'seances', 'blocs_seance', 'exercices_seance', 'instances_seance',
  'series_realisees', 'objectifs_progression',
] as const

const plan = (input: unknown): ImportPlan => buildImportPlan(input, USER, { now: NOW })
async function compter(db: Db): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const t of TABLES) out[t] = (await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`)).n
  return out
}
const zeros = Object.fromEntries(TABLES.map((t) => [t, 0]))

let db: Db
beforeEach(() => {
  db = createTestDb()
})

describe('applyImportPlan', () => {
  it("applique le plan de l'export v3.2 : les comptes de lignes correspondent au plan", async () => {
    const p = plan(exportV32)
    const rapport = await applyImportPlan(db, p)
    const comptes = await compter(db)
    for (const t of TABLES) expect(comptes[t]).toBe(p.rows[t].length)
    expect(rapport).toEqual({
      seances: p.rows.seances.length,
      instances: p.rows.instances_seance.length,
      series: p.rows.series_realisees.length,
      exercises: p.rows.exercises.length,
      objectifs: p.rows.objectifs_progression.length,
      ignores: p.report.ignores,
    })
    expect(comptes.seances).toBeGreaterThan(0)
  })

  it('appliquer deux fois le même plan laisse les mêmes comptes (la seconde met à jour)', async () => {
    const p = plan(exportV32)
    await applyImportPlan(db, p)
    const apres1 = await compter(db)
    const rapport2 = await applyImportPlan(db, p)
    expect(await compter(db)).toEqual(apres1)
    expect(rapport2.seances).toBe(p.rows.seances.length)
    expect(rapport2.series).toBe(p.rows.series_realisees.length)
  })

  it("réimport : un marqueur de progression local (décisions déjà prises) n'est jamais écrasé", async () => {
    const p = plan(exportV32)
    await applyImportPlan(db, p)
    const [planifiee] = p.rows.instances_seance.filter((l) => l.progression_json === null)
    const [terminee] = p.rows.instances_seance.filter((l) => l.progression_json !== null)
    expect(planifiee && terminee).toBeTruthy()
    const local = JSON.stringify({ evaluee: true, decisions: { e1: 'acceptee' } })
    for (const id of [planifiee.id, terminee.id]) {
      await db.execute('UPDATE instances_seance SET progression_json = ? WHERE id = ?', [local, id])
    }
    await applyImportPlan(db, p)
    for (const id of [planifiee.id, terminee.id]) {
      const l = await db.get<{ progression_json: string | null }>('SELECT progression_json FROM instances_seance WHERE id = ?', [id])
      expect(l.progression_json).toBe(local)
    }
  })

  it("l'export gagne : une ligne locale de même id est remplacée par le contenu du fichier", async () => {
    const p = plan(exportV32)
    await applyImportPlan(db, p)
    const id = p.rows.seances[0].id as string
    await db.execute('UPDATE seances SET nom = ? WHERE id = ?', ['Modifiée localement', id])
    await applyImportPlan(db, p)
    const ligne = await db.get<{ nom: string }>('SELECT nom FROM seances WHERE id = ?', [id])
    expect(ligne.nom).toBe(p.rows.seances[0].nom)
  })

  it("atomicité : une ligne invalide en milieu de plan annule tout et relance l'erreur", async () => {
    const p = plan(exportV32)
    const casse: ImportPlan = {
      ...p,
      rows: { ...p.rows, blocs_seance: [{ ...p.rows.blocs_seance[0], colonne_fantome: 1 }, ...p.rows.blocs_seance.slice(1)] },
    }
    await expect(applyImportPlan(db, casse)).rejects.toThrow(/Colonne inconnue/)
    expect(await compter(db)).toEqual(zeros)
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM user_settings')).n).toBe(0)
  })

  it('atomicité : un échec à la 3e table (tx simulée) annule les écritures déjà faites', async () => {
    const p = plan(exportV32)
    let echec = false
    const enveloppe: Db = {
      ...db,
      writeTransaction: <T,>(fn: (tx: DbTx) => Promise<T>) =>
        db.writeTransaction((tx) =>
          fn({
            ...tx,
            execute: async (sql, params) => {
              if (/INSERT INTO blocs_seance/.test(sql)) {
                echec = true
                throw new Error('panne simulée')
              }
              return tx.execute(sql, params)
            },
          }),
        ),
    }
    await expect(applyImportPlan(enveloppe, p)).rejects.toThrow('panne simulée')
    expect(echec).toBe(true)
    expect(await compter(db)).toEqual(zeros)
  })

  it('une ligne exercice minimale ne remplace jamais une fiche existante', async () => {
    const p = plan(exportV32)
    expect(p.exercisesMinimauxIds.length).toBeGreaterThan(0)
    const id = p.exercisesMinimauxIds[0]
    await db.execute(
      'INSERT INTO exercises (id, user_id, updated_at, name, description) VALUES (?, ?, ?, ?, ?)',
      [id, USER, NOW, 'Fiche riche', 'Description détaillée'],
    )
    await applyImportPlan(db, p)
    const ligne = await db.get<{ name: string; description: string }>(
      'SELECT name, description FROM exercises WHERE id = ?',
      [id],
    )
    expect(ligne).toEqual({ name: 'Fiche riche', description: 'Description détaillée' })
    for (const autre of p.exercisesMinimauxIds.slice(1)) {
      expect(await db.getOptional('SELECT 1 FROM exercises WHERE id = ?', [autre])).not.toBeNull()
    }
  })

  it('un exercice complet du fichier remplace la fiche locale de même id', async () => {
    const p = plan(catalogue)
    await applyImportPlan(db, p)
    const id = p.rows.exercises[0].id as string
    await db.execute('UPDATE exercises SET name = ? WHERE id = ?', ['Autre', id])
    await applyImportPlan(db, p)
    const ligne = await db.get<{ name: string }>('SELECT name FROM exercises WHERE id = ?', [id])
    expect(ligne.name).toBe(p.rows.exercises[0].name)
  })

  it("matériel : le patch garde la barre existante quand le fichier n'en a pas (aller-retour par le dépôt)", async () => {
    const barre = { barreKg: 20, disques: { "20": 4, "10": 2 } }
    await saveSettings(db, USER, { equipmentJson: JSON.stringify({ barre }) })
    await applyImportPlan(db, plan(materiel))
    const reglages = await getSettings(db, USER)
    const stocke = JSON.parse(reglages.equipmentJson) as Record<string, unknown>
    expect(stocke.barre).toEqual(barre)
    expect(stocke.selectedCategories).toEqual(['HALTERES', 'KETTLEBELL'])
    expect(stocke.kettlebell).toBeTruthy()
  })

  it("matériel : l'import laisse dark_mode à NULL (aucun faux choix de thème)", async () => {
    await applyImportPlan(db, plan(materiel))
    expect((await getSettings(db, USER)).darkMode).toBeNull()
  })

  it("matériel : l'échec d'une table annule aussi l'écriture des réglages", async () => {
    const p = plan(exportV32)
    expect(p.equipmentPatch).not.toBeNull()
    const casse: ImportPlan = { ...p, rows: { ...p.rows, series_realisees: [{ id: 'x', inconnue: 1 }] } }
    await expect(applyImportPlan(db, casse)).rejects.toThrow()
    expect((await getSettings(db, USER)).equipmentJson).toBe('{}')
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM user_settings')).n).toBe(0)
  })
})

describe('parseImportFile', () => {
  it("reconnaît le type d'un export complet, catalogue ou matériel", () => {
    expect(parseImportFile(JSON.stringify(exportV32)).type).toBe('complet')
    expect(parseImportFile(JSON.stringify(catalogue)).type).toBe('catalogue')
    expect(parseImportFile(JSON.stringify(materiel)).type).toBe('materiel')
  })

  it("JSON tronqué : ImportError française, sans fuite de pile, et rien n'est écrit", async () => {
    const tronque = JSON.stringify(exportV32).slice(0, 200)
    let erreur: unknown
    try {
      parseImportFile(tronque)
    } catch (e) {
      erreur = e
    }
    expect(erreur).toBeInstanceOf(ImportError)
    expect((erreur as ImportError).message).toBe('Fichier JSON invalide ou tronqué')
    expect(await compter(db)).toEqual(zeros)
  })

  it("un JSON qui n'est pas un objet est refusé", () => {
    expect(() => parseImportFile('[1,2]')).toThrow(ImportError)
    expect(() => parseImportFile('42')).toThrow(ImportError)
    expect(() => parseImportFile('null')).toThrow(ImportError)
  })
})

describe("applyImportPlan : lignes d'instance déjà copiées sur le web", () => {
  const seance = { id: 1, nom: 'Jambes', createdAt: '2026-01-01T10:00:00' }
  const blocT = { id: 10, seanceId: 1, nom: 'Principal', position: 0 }
  const exT = { id: 20, seanceId: 1, exerciceId: 5, exerciceName: 'Squat', blocId: 10, position: 0 }
  const instance = { id: 100, seanceId: 1, date: '2026-02-01', isCompleted: false }
  const fichier = (lignes: boolean) => ({
    version: '3.2',
    strengthTemplates: [{ seance, blocs: [blocT], exercices: [exT] }],
    strengthSessions: {
      completed: [],
      planned: [{
        instance,
        blocs: lignes ? [{ ...blocT, id: 11, instanceSeanceId: 100 }] : [],
        exercices: lignes ? [{ ...exT, id: 21, blocId: 11, instanceSeanceId: 100 }] : [],
      }],
    },
  })
  const vivantes = (table: string, instanceId: string) =>
    db.getAll<Record<string, unknown>>(`SELECT * FROM ${table} WHERE instance_seance_id = ? AND deleted_at IS NULL`, [instanceId])

  it("le fichier gagne : les copies web absentes du plan passent en suppression logique (jamais de DELETE)", async () => {
    await applyImportPlan(db, plan(fichier(false)))
    const instanceId = deterministicId(`${USER}:instances_seance`, '100')
    await copyTemplateToInstance(db, instanceId)
    expect(await vivantes('exercices_seance', instanceId)).toHaveLength(1)

    const p = plan(fichier(true))
    await applyImportPlan(db, p)

    const exercices = await vivantes('exercices_seance', instanceId)
    const blocs = await vivantes('blocs_seance', instanceId)
    expect(exercices.map((e) => e.id)).toEqual([deterministicId(`${USER}:exercices_seance`, '21')])
    expect(blocs.map((b) => b.id)).toEqual([deterministicId(`${USER}:blocs_seance`, '11')])
    // Une seule ligne vivante par (instance, source) : l'index unique serveur 0006 est respecté
    expect(new Set(exercices.map((e) => e.exercice_source_id)).size).toBe(exercices.length)
    // Les copies web restent en base, marquées supprimées
    const toutes = await db.getAll<{ deleted_at: string | null }>('SELECT deleted_at FROM exercices_seance WHERE instance_seance_id = ?', [instanceId])
    expect(toutes).toHaveLength(2)
    expect(toutes.filter((l) => l.deleted_at !== null)).toHaveLength(1)
  })

  it("une instance du fichier sans lignes ne touche pas aux copies locales", async () => {
    await applyImportPlan(db, plan(fichier(false)))
    const instanceId = deterministicId(`${USER}:instances_seance`, '100')
    await copyTemplateToInstance(db, instanceId)
    await applyImportPlan(db, plan(fichier(false)))
    expect(await vivantes('exercices_seance', instanceId)).toHaveLength(1)
    expect(await vivantes('blocs_seance', instanceId)).toHaveLength(1)
  })
})
