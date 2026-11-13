import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/Db'
import { deterministicId } from '../db/ids'
import { enregistrerSeanceMobilite, lireSeancesMobilite } from '../db/repos/mobilite'
import { lireRappelsJson, saveRappelsJson } from '../db/repos/settings'
import { createTestDb } from '../../test/sqliteDb'
import { inserer } from '../../test/fixtures'
import { construireExport } from '../export/construireExport'
import { TABLES_COMPLEMENT } from '../export/complementWeb'
import exportV32 from './__fixtures__/export-v3.2.json'
import { applyImportPlan } from './apply'
import { extraireComplement } from './complementWeb'
import { buildImportPlan } from './plan'
import { analyser, PandaMoveExportSchema } from './schema'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const MAINTENANT = new Date('2026-11-12T10:00:00.000Z')
const commun = { user_id: A, updated_at: '2026-11-01T00:00:00.000Z', deleted_at: null }

async function remplir(db: Db) {
  await inserer(db, 'seances_course', { ...commun, id: 'c1', titre: 'Footing', date: '2026-11-14', created_at: '2026-11-01T10:00:00.000Z', is_validated: 0, optionnelle: 0 })
  await inserer(db, 'seances_velo', { ...commun, id: 'v1', titre: 'Sortie vélo', date: '2026-11-15', created_at: '2026-11-01T10:00:01.000Z', is_validated: 1, optionnelle: 0 })
  await inserer(db, 'sorties', {
    ...commun, id: 's1', sport: 'course', date: '2026-11-12', titre: 'Course', duree_s: 2460, distance_m: 6430, fc_moy: 150, en_salle: 0,
    source: 'manuel', seance_course_id: 'c1', trace: '{"p":[1,2]}', created_at: '2026-11-12T09:00:00.000Z',
  })
  await inserer(db, 'methodes_respiration', { ...commun, id: 'm1', nom: 'Ma méthode', emoji: '🌬', inspire_sec: 4, expire_sec: 6, retention_pleine_sec: 0, retention_vide_sec: 0, cycles_defaut: 10, created_at: '2026-11-01T10:00:00.000Z' })
  await inserer(db, 'seances_respiration', { ...commun, id: 'r1', methode_id: 'm1', methode_nom: 'Ma méthode', cycles: 10, duree_sec: 100, date: '2026-11-11', created_at: '2026-11-11T08:00:00.000Z' })
  await inserer(db, 'seances_respiration', { ...commun, id: 'r2', methode_id: 'coherence_cardiaque', methode_nom: 'Cohérence cardiaque', cycles: 30, duree_sec: 300, date: '2026-11-10', created_at: '2026-11-10T08:00:00.000Z' })
  await enregistrerSeanceMobilite(db, { id: 'mo1', date: '2026-11-12', dureeS: 600, exercices: 8, zones: ['hanches'], sport: 'course' })
  await saveRappelsJson(db, A, JSON.stringify({ veille: false, veilleHeure: '20:15', jour: true, jourHeure: '06:45' }))
}

const compter = async (db: Db, t: string) => (await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t} WHERE deleted_at IS NULL`)).n

async function sauvegarde(db: Db, user = A) {
  return JSON.parse(JSON.stringify(await construireExport(db, MAINTENANT, user)))
}

async function restaurer(db: Db, fichier: unknown, user: string) {
  const plan = buildImportPlan(fichier, user)
  return applyImportPlan(db, plan, extraireComplement(fichier, user))
}

let source: Db
beforeEach(async () => {
  source = createTestDb()
  await remplir(source)
})

describe('complément web de la sauvegarde', () => {
  it('l\'export porte les six tables et les rappels, sans user_id ni updated_at ; il reste un export v3.2 valide', async () => {
    const f = await sauvegarde(source)
    expect(Object.keys(f.pandamoveWeb.tables).sort()).toEqual([...TABLES_COMPLEMENT].sort())
    expect(f.pandamoveWeb.tables.sorties).toHaveLength(1)
    expect(f.pandamoveWeb.tables.sorties[0]).not.toHaveProperty('user_id')
    expect(f.pandamoveWeb.tables.sorties[0]).not.toHaveProperty('updated_at')
    expect(JSON.parse(f.pandamoveWeb.rappelsJson)).toMatchObject({ veille: false, jourHeure: '06:45' })
    expect(analyser(PandaMoveExportSchema, f)).toBeTruthy()
  })

  it('une ligne supprimée n\'est pas exportée', async () => {
    await source.execute("UPDATE sorties SET deleted_at = '2026-11-13T00:00:00.000Z' WHERE id = 's1'")
    expect((await sauvegarde(source)).pandamoveWeb.tables.sorties).toHaveLength(0)
  })

  it('aller-retour dans un appareil vierge, même compte : tout revient, ids conservés, rappels compris', async () => {
    const f = await sauvegarde(source)
    const cible = createTestDb()
    const rapport = await restaurer(cible, f, A)
    expect(rapport.complement).toBe(7)
    for (const t of TABLES_COMPLEMENT) expect(await compter(cible, t), t).toBe(await compter(source, t))
    const sortie = await cible.get<Record<string, unknown>>("SELECT * FROM sorties WHERE id = 's1'")
    expect(sortie).toMatchObject({ distance_m: 6430, seance_course_id: 'c1', trace: '{"p":[1,2]}', created_at: '2026-11-12T09:00:00.000Z' })
    expect(await lireSeancesMobilite(cible)).toHaveLength(1)
    expect(JSON.parse((await lireRappelsJson(cible, A))!)).toEqual({ veille: false, veilleHeure: '20:15', jour: true, jourHeure: '06:45' })
  })

  it('réimporter deux fois ne crée aucun doublon, et une ligne supprimée depuis revient', async () => {
    const f = await sauvegarde(source)
    const cible = createTestDb()
    await restaurer(cible, f, A)
    await cible.execute("UPDATE sorties SET deleted_at = '2026-11-13T00:00:00.000Z' WHERE id = 's1'")
    await restaurer(cible, f, A)
    await restaurer(cible, f, A)
    for (const t of TABLES_COMPLEMENT) expect(await compter(cible, t), t).toBe(await compter(source, t))
  })

  it('autre compte : ids dérivés du compte, liens recalculés, réimport sans doublon', async () => {
    const f = await sauvegarde(source)
    const cible = createTestDb()
    await restaurer(cible, f, B)
    await restaurer(cible, f, B)
    for (const t of TABLES_COMPLEMENT) expect(await compter(cible, t), t).toBe(await compter(source, t))
    const sortie = await cible.get<{ id: string; seance_course_id: string }>('SELECT * FROM sorties')
    expect(sortie.id).toBe(deterministicId(B, 'sorties|s1'))
    expect(sortie.seance_course_id).toBe(deterministicId(B, 'seances_course|c1'))
    // Méthode personnalisée : id recalculé ; méthode intégrée : identifiant inchangé
    const respirations = await cible.getAll<{ methode_id: string }>('SELECT methode_id FROM seances_respiration ORDER BY date')
    expect(respirations.map((r) => r.methode_id)).toEqual(['coherence_cardiaque', deterministicId(B, 'methodes_respiration|m1')])
    const methode = await cible.get<{ id: string }>('SELECT id FROM methodes_respiration')
    expect(methode.id).toBe(deterministicId(B, 'methodes_respiration|m1'))
  })

  it('un export Android ou une ancienne sauvegarde (sans complément) s\'importe comme avant', async () => {
    expect(extraireComplement(exportV32, A)).toBeNull()
    const cible = createTestDb()
    const rapport = await restaurer(cible, exportV32, A)
    expect(rapport.complement).toBe(0)
    expect(await compter(cible, 'sorties')).toBe(0)
  })

  it('lignes invalides ignorées et comptées : colonne inconnue écartée, date, id et valeurs mal formés refusés', () => {
    const fichier = {
      webUserId: A,
      pandamoveWeb: {
        version: 1,
        tables: {
          sorties: [
            { id: 'ok', sport: 'velo', date: '2026-11-12', created_at: 'c', colonne_inconnue: 'x' },
            { id: 'mauvaise-date', sport: 'velo', date: '12/11/2026', created_at: 'c' },
            { sport: 'velo', date: '2026-11-12', created_at: 'c' },
            { id: 'valeur-objet', sport: { x: 1 }, date: '2026-11-12', created_at: 'c' },
            { id: 'booleen', en_salle: true, date: '2026-11-12', created_at: 'c' },
            'pas une ligne',
          ],
          seances_mobilite: 'pas un tableau',
        },
        rappelsJson: JSON.stringify({ veille: 'oui', veilleHeure: '25:99', jour: false }),
      },
    }
    const plan = extraireComplement(fichier, A)!
    expect(plan.resume.sorties).toBe(1)
    expect(plan.lignes).toHaveLength(1)
    expect(plan.lignes[0].valeurs).not.toHaveProperty('colonne_inconnue')
    expect(plan.remarques).toEqual(['5 sortie(s) invalide(s), ignorée(s)'])
    // Rappels : valeurs invalides ramenées aux défauts
    expect(JSON.parse(plan.rappelsJson!)).toEqual({ veille: true, veilleHeure: '19:00', jour: false, jourHeure: '07:30' })
  })

  it('un complément mal formé ne casse rien : table absente, rappels invalides ignorés', () => {
    expect(extraireComplement({ pandamoveWeb: 'texte' }, A)).toBeNull()
    const plan = extraireComplement({ pandamoveWeb: { tables: null, rappelsJson: 42 } }, A)!
    expect(plan.lignes).toEqual([])
    expect(plan.rappelsJson).toBeNull()
  })

  it('tout ou rien : une erreur d\'écriture annule aussi la partie renforcement', async () => {
    const f = await sauvegarde(source)
    const plan = buildImportPlan(exportV32, A)
    const complement = extraireComplement(f, A)!
    // Colonne inexistante : upsertRow lève, la transaction entière doit être annulée
    complement.lignes.push({ table: 'sorties', valeurs: { id: 'x', colonne_absente: 1 } })
    const cible = createTestDb()
    await expect(applyImportPlan(cible, plan, complement)).rejects.toThrow()
    expect(await compter(cible, 'seances')).toBe(0)
    expect(await compter(cible, 'sorties')).toBe(0)
  })
})
