import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/Db'
import { newId } from '../db/ids'
import { saveSettings } from '../db/repos/settings'
import { parseTimestamp } from '../common/parseTimestamp'
import { applyImportPlan } from '../import/apply'
import exportV32 from '../import/__fixtures__/export-v3.2.json'
import { buildImportPlan, verifierIntegrite } from '../import/plan'
import { analyser, PandaMoveExportSchema } from '../import/schema'
import { createTestDb } from '../../test/sqliteDb'
import { inserer } from '../../test/fixtures'
import { construireExport, ErreurExport } from './construireExport'
import { idLongDepuisUuid } from './ids'

const USER = '11111111-1111-4111-8111-111111111111'
const AUTRE = '22222222-2222-4222-8222-222222222222'
const NOW = '2026-10-24T12:00:00.000Z'
const MAINTENANT = new Date('2026-10-25T08:30:00.000Z')

const TABLES = [
  'exercises', 'seances', 'blocs_seance', 'exercices_seance', 'instances_seance',
  'series_realisees', 'objectifs_progression',
] as const

async function importer(db: Db, fichier: unknown, user = USER) {
  const plan = buildImportPlan(fichier, user, { now: NOW })
  await applyImportPlan(db, plan)
  return plan
}

async function compterVivantes(db: Db): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const t of TABLES) {
    out[t] = (await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t} WHERE deleted_at IS NULL`)).n
  }
  return out
}

// Horodatage comparé en instant (le format peut changer : « Z » retiré, microsecondes tronquées)
const instant = (v: unknown) => (typeof v === 'string' ? parseTimestamp(v) : null)

type L = Record<string, unknown>

/**
 * Vue « métier » d'une base, indépendante des identifiants : chaque ligne est désignée par ses
 * valeurs (nom de séance, date, nom d'exercice, position…). Deux bases équivalentes donnent la même vue.
 */
async function vueMetier(db: Db) {
  const tous = async (sql: string) => db.getAll<L>(sql)
  const exercices = new Map((await tous('SELECT id, name FROM exercises')).map((e) => [e.id, e.name]))
  const seances = new Map((await tous('SELECT * FROM seances WHERE deleted_at IS NULL')).map((s) => [s.id, s]))
  const instances = new Map((await tous('SELECT * FROM instances_seance WHERE deleted_at IS NULL')).map((i) => [i.id, i]))
  const blocs = new Map((await tous('SELECT * FROM blocs_seance WHERE deleted_at IS NULL')).map((b) => [b.id, b]))
  const lignesEx = new Map((await tous('SELECT * FROM exercices_seance WHERE deleted_at IS NULL')).map((e) => [e.id, e]))

  const nomSeance = (id: unknown) => (seances.get(id)?.nom as string | undefined) ?? '?'
  const cleInstance = (id: unknown) => {
    const i = instances.get(id)
    return i ? `${nomSeance(i.seance_id)}@${String(i.date)}` : 'template'
  }
  const cleBloc = (id: unknown) => {
    const b = blocs.get(id)
    return b ? `${String(b.nom)}#${String(b.position)}` : null
  }
  const trier = <T>(xs: T[]) => xs.map((x) => JSON.stringify(x)).sort()

  return {
    exercises: trier(
      (await tous('SELECT * FROM exercises WHERE deleted_at IS NULL')).map((e) => ({
        name: e.name, category: e.category, muscle_groups: e.muscle_groups, description: e.description,
        exercise_type: e.exercise_type, equipment: e.equipment, muscle_primary: e.muscle_primary,
      })),
    ),
    seances: trier(
      [...seances.values()].map((s) => ({
        nom: s.nom, groupes: s.groupes_musculaires, duree: s.duree_estimee_min, notes: s.notes,
        categorie: s.seance_category, cree: instant(s.created_at),
      })),
    ),
    blocs: trier(
      [...blocs.values()].map((b) => ({
        seance: nomSeance(b.seance_id), instance: cleInstance(b.instance_seance_id), nom: b.nom, type: b.type,
        position: b.position, duree: b.duree_min, description: b.description,
        reposInter: b.temps_repos_inter_sec, reposFin: b.temps_repos_fin_round_sec,
      })),
    ),
    exercicesSeance: trier(
      [...lignesEx.values()].map((e) => ({
        seance: nomSeance(e.seance_id), instance: cleInstance(e.instance_seance_id), exercice: exercices.get(e.exercise_id),
        bloc: cleBloc(e.bloc_id), superset: e.superset_groupe, position: e.position, series: e.nombre_series_prevues,
        reps: e.reps_cibles, charge: e.charge_cible, tempo: e.tempo, repsType: e.reps_type, repos: e.temps_repos_sec,
        consigne: e.consigne_cle, equipement: e.equipement, avertissement: e.avertissement, bilateral: e.is_bilateral,
        progression: e.progression_activee, systeme: e.systeme_progression, repsMin: e.reps_min, repsMax: e.reps_max,
        incrementKg: e.increment_kg, incrementDuree: e.increment_duree_sec, seuilDeload: e.seuil_deload,
        type: e.type_exercice, incrementPct: e.increment_pct, pdc: e.is_bodyweight,
      })),
    ),
    instances: trier(
      [...instances.values()].map((i) => ({
        seance: nomSeance(i.seance_id), date: i.date, notes: i.notes, terminee: i.is_completed,
        terminee_le: instant(i.completed_at), duree: i.duration_seconds, cree: instant(i.created_at),
      })),
    ),
    series: trier(
      (await tous('SELECT * FROM series_realisees WHERE deleted_at IS NULL')).map((s) => {
        const ligne = lignesEx.get(s.exercice_seance_id)
        return {
          instance: cleInstance(s.instance_seance_id), exercice: ligne ? exercices.get(ligne.exercise_id) : '?',
          position: ligne?.position, numero: s.numero_serie, reps: s.reps_realisees, charge: s.charge_kg,
          label: s.charge_label, rpe: s.rpe, notes: s.notes, validee: s.is_completed,
        }
      }),
    ),
    objectifs: trier(
      (await tous('SELECT * FROM objectifs_progression WHERE deleted_at IS NULL')).map((o) => ({
        seance: nomSeance(o.seance_id), exercice: exercices.get(o.exercise_id), charge: o.charge_cible,
        reps: o.reps_cible, duree: o.duree_cible_sec, echecs: o.compteur_echec, maj: o.derniere_maj,
      })),
    ),
    materiel: (await db.getOptional<L>('SELECT equipment_json FROM user_settings WHERE deleted_at IS NULL'))?.equipment_json ?? null,
  }
}

// Base « native web » : ids aléatoires, horodatages client (« Z ») et serveur (« +00 »), séance
// archivée, marqueur de progression, horloge de séance, série validée horodatée.
async function ajouterDonneesWeb(db: Db) {
  const ex = newId()
  const seance = newId()
  const bloc = newId()
  const ligneTemplate = newId()
  const instance = newId()
  const blocCopie = newId()
  const ligneCopie = newId()
  const sync = { user_id: USER, updated_at: '2026-10-20T10:00:00.000Z', deleted_at: null }
  await inserer(db, 'exercises', {
    id: ex, ...sync, name: 'Fente bulgare', category: 'LEGS', muscle_groups: '["QUADRICEPS","FESSIERS"]',
    description: 'Pied arrière sur banc', is_favorite: 1, is_custom: 1, image_url: null, exercise_type: 'STRENGTH',
    equipment: '["HALTERES"]', muscle_primary: 'QUADRICEPS', is_bodyweight: 0,
  })
  await inserer(db, 'seances', {
    id: seance, ...sync, nom: 'Jambes web', groupes_musculaires: '["QUADRICEPS"]', duree_estimee_min: 45,
    notes: 'Créée sur le web', seance_category: 'STRENGTH', created_at: '2026-10-01 07:15:30.123456+00', is_archived: 1,
  })
  const blocCommun = {
    ...sync, seance_id: seance, nom: 'Principal', type: 'CIRCUIT', position: 0, duree_min: 20, description: 'Circuit',
    temps_repos_inter_sec: 15, temps_repos_fin_round_sec: 90,
  }
  await inserer(db, 'blocs_seance', { id: bloc, ...blocCommun, instance_seance_id: null, bloc_source_id: null })
  const ligne = {
    ...sync, seance_id: seance, exercise_id: ex, superset_groupe: null, position: 0, nombre_series_prevues: 3,
    reps_cibles: '10', charge_cible: '2x12 kg', tempo: '2010', reps_type: 'REPS', temps_repos_sec: 75,
    consigne_cle: 'Genou aligné', equipement: 'Haltères', avertissement: 'Genou fragile', is_bilateral: 1,
    progression_activee: 1, systeme_progression: 'LINEAIRE', reps_min: 8, reps_max: 12, increment_kg: 1.25,
    increment_duree_sec: 10, seuil_deload: 2, type_exercice: 'COMPOSE_BAS', increment_pct: 2.5, is_bodyweight: 0,
  }
  await inserer(db, 'exercices_seance', { id: ligneTemplate, ...ligne, bloc_id: bloc, instance_seance_id: null, exercice_source_id: null })
  await inserer(db, 'instances_seance', {
    id: instance, ...sync, seance_id: seance, date: '2026-10-21', notes: 'Bonnes sensations', is_completed: 1,
    completed_at: '2026-10-21T18:45:12.345Z', duration_seconds: 2710, created_at: '2026-10-19T09:00:00.000Z',
    started_at: '2026-10-21T18:00:00.000Z', paused_json: '[]', progression_json: '{"evaluee":true,"decisions":{"x":"refusee"}}',
  })
  await inserer(db, 'blocs_seance', { id: blocCopie, ...blocCommun, instance_seance_id: instance, bloc_source_id: bloc })
  await inserer(db, 'exercices_seance', {
    id: ligneCopie, ...ligne, bloc_id: blocCopie, instance_seance_id: instance, exercice_source_id: ligneTemplate,
  })
  const serie = {
    ...sync, instance_seance_id: instance, exercice_seance_id: ligneCopie, notes: '', validated_at: '2026-10-21T18:10:00.000Z',
  }
  await inserer(db, 'series_realisees', { id: newId(), ...serie, numero_serie: 1, reps_realisees: 10, charge_kg: 12.5, charge_label: '2x12,5 kg', rpe: 7.5, is_completed: 1 })
  await inserer(db, 'series_realisees', { id: newId(), ...serie, numero_serie: 2, reps_realisees: null, charge_kg: null, charge_label: null, rpe: null, is_completed: 0 })
  await inserer(db, 'objectifs_progression', {
    id: newId(), ...sync, seance_id: seance, exercise_id: ex, charge_cible: 13.75, reps_cible: 10, duree_cible_sec: null,
    compteur_echec: 1, derniere_maj: '2026-10-21', nombre_series_cible: 4,
  })
  return { ex, seance, instance, ligneCopie }
}

let db: Db
beforeEach(() => {
  db = createTestDb()
})

describe('construireExport', () => {
  it('base vide : export v3.2 valide, listes vides et sans matériel', async () => {
    const exp = await construireExport(db, MAINTENANT)
    expect(exp.version).toBe('3.2')
    expect(exp.exportDate).toBe('2026-10-25T08:30:00.000')
    expect(exp.strengthTemplates).toEqual([])
    expect(exp.strengthSessions).toEqual({ completed: [], planned: [] })
    expect(exp.customExercises).toEqual([])
    expect(exp.objectifsProgression).toEqual([])
    expect(exp.equipmentConfig).toBeNull()
    // Sections hors phase 1 présentes (format Android complet), vides
    expect(exp.runSessions).toEqual({ completed: [], planned: [] })
    expect(exp.breathingSessions).toEqual([])
    const relu = analyser(PandaMoveExportSchema, JSON.parse(JSON.stringify(exp)))
    expect(relu.strengthTemplates).toEqual([])
    const plan = buildImportPlan(JSON.parse(JSON.stringify(exp)), USER, { now: NOW })
    expect(plan.report.ignores).toEqual([])
    expect(plan.equipmentPatch).toBeNull()
  })

  it('aller-retour : export → schéma Zod → plan → nouvelle base = mêmes comptes et mêmes valeurs métier', async () => {
    await importer(db, exportV32)
    await ajouterDonneesWeb(db)

    const exp = await construireExport(db, MAINTENANT)
    const json = JSON.parse(JSON.stringify(exp)) as unknown
    analyser(PandaMoveExportSchema, json) // ne lève pas
    const plan = buildImportPlan(json, AUTRE, { now: NOW })
    expect(verifierIntegrite(plan)).toEqual([])
    expect(plan.report.ignores).toEqual([])
    expect(plan.report.exercisesCrees).toBe(0) // chaque exercice référencé est dans customExercises

    const cible = createTestDb()
    await applyImportPlan(cible, plan)
    expect(await compterVivantes(cible)).toEqual(await compterVivantes(db))
    const avant = await vueMetier(db)
    const apres = await vueMetier(cible)
    expect(apres.exercises).toEqual(avant.exercises)
    expect(apres.seances).toEqual(avant.seances)
    expect(apres.blocs).toEqual(avant.blocs)
    expect(apres.exercicesSeance).toEqual(avant.exercicesSeance)
    expect(apres.instances).toEqual(avant.instances)
    expect(apres.series).toEqual(avant.series)
    expect(apres.objectifs).toEqual(avant.objectifs)
    expect(avant.materiel).not.toBeNull()
    expect(JSON.parse(String(apres.materiel))).toEqual(JSON.parse(String(avant.materiel)))
  })

  it('aller-retour du matériel « Mon matériel »', async () => {
    const inventaire = {
      halteres: { poidsFixes: [2, 4.5], chargeable: { barreKg: 2, disques: { '1.25': 4, '5': 2 } } },
      barre: { barreKg: 20, disques: { '20': 2, '10': 2, '2.5': 4 } },
      kettlebell: { minKg: 8, maxKg: 24, pasKg: 4 },
      cable: null,
      selectedCategories: ['HALTERES', 'BARRE', 'KETTLEBELL'],
      pasParCategorie: { MACHINE: 5 },
    }
    await saveSettings(db, USER, { equipmentJson: JSON.stringify(inventaire) })
    const exp = await construireExport(db, MAINTENANT)
    expect(exp.equipmentConfig).toEqual(inventaire)

    const cible = createTestDb()
    await importer(cible, JSON.parse(JSON.stringify(exp)), AUTRE)
    const relu = await cible.get<{ equipment_json: string }>('SELECT equipment_json FROM user_settings')
    expect(JSON.parse(relu.equipment_json)).toEqual(inventaire)
  })

  it('conserve séries, réglages et horodatages ; ids Long dérivés des UUID ; UUID et champs web en plus', async () => {
    const web = await ajouterDonneesWeb(db)
    const exp = await construireExport(db, MAINTENANT)

    const t = exp.strengthTemplates[0]
    expect(t.seance.id).toBe(idLongDepuisUuid(web.seance))
    expect(t.seance.uuid).toBe(web.seance)
    expect(t.seance.isArchived).toBe(true)
    // timestamptz serveur -> date-heure UTC sans fuseau (lue comme UTC par l'app web)
    expect(t.seance.createdAt).toBe('2026-10-01T07:15:30.123')
    expect(t.exercices[0]).toMatchObject({
      exerciceId: idLongDepuisUuid(web.ex), exerciceName: 'Fente bulgare', instanceSeanceId: null,
      progressionActivee: true, systemeProgression: 'LINEAIRE', repsMin: 8, repsMax: 12, incrementKg: 1.25,
      incrementDureeSec: 10, seuilDeload: 2, typeExercice: 'COMPOSE_BAS', incrementPct: 2.5, isBilateral: true,
    })

    expect(exp.strengthSessions.planned).toEqual([])
    const s = exp.strengthSessions.completed[0]
    expect(s.instance).toMatchObject({
      id: idLongDepuisUuid(web.instance), seanceId: idLongDepuisUuid(web.seance), date: '2026-10-21',
      isCompleted: true, completedAt: '2026-10-21T18:45:12.345', durationSeconds: 2710, createdAt: '2026-10-19T09:00:00.000',
      uuid: web.instance, startedAt: '2026-10-21T18:00:00.000Z', pausedJson: '[]',
      progressionJson: '{"evaluee":true,"decisions":{"x":"refusee"}}',
    })
    expect(s.blocs[0].instanceSeanceId).toBe(idLongDepuisUuid(web.instance))
    expect(s.exercices[0].id).toBe(idLongDepuisUuid(web.ligneCopie))
    expect(s.series).toEqual([
      expect.objectContaining({
        numeroSerie: 1, repsRealisees: 10, chargeKg: 12.5, chargeLabel: '2x12,5 kg', rpe: 7.5, isCompleted: true,
        exerciceSeanceId: idLongDepuisUuid(web.ligneCopie), instanceSeanceId: idLongDepuisUuid(web.instance),
        validatedAt: '2026-10-21T18:10:00.000Z',
      }),
      expect.objectContaining({ numeroSerie: 2, repsRealisees: null, chargeKg: null, chargeLabel: null, rpe: null, isCompleted: false }),
    ])
    expect(exp.customExercises[0]).toMatchObject({
      id: idLongDepuisUuid(web.ex), name: 'Fente bulgare', category: 'LEGS', muscleGroups: ['QUADRICEPS', 'FESSIERS'],
      equipment: ['HALTERES'], isFavorite: true,
    })
    expect(exp.objectifsProgression[0]).toMatchObject({
      exerciceName: 'Fente bulgare', chargeCible: 13.75, repsCible: 10, compteurEchec: 1, derniereMaj: '2026-10-21',
      nombreSeriesCible: 4,
    })
  })

  it('exclut les lignes supprimées (tombstones) à tous les niveaux', async () => {
    const web = await ajouterDonneesWeb(db)
    const mort = { deleted_at: '2026-10-22T10:00:00.000Z' }
    const sync = { user_id: USER, updated_at: '2026-10-22T10:00:00.000Z' }
    // Séance supprimée avec ses enfants, exercice supprimé, série supprimée, objectif supprimé
    const seanceMorte = newId()
    await inserer(db, 'seances', { id: seanceMorte, ...sync, ...mort, nom: 'Supprimée', is_archived: 0 })
    await inserer(db, 'exercises', { id: newId(), ...sync, ...mort, name: 'Exercice supprimé' })
    await inserer(db, 'series_realisees', {
      id: newId(), ...sync, ...mort, instance_seance_id: web.instance, exercice_seance_id: web.ligneCopie, numero_serie: 3,
    })
    await inserer(db, 'blocs_seance', { id: newId(), ...sync, ...mort, seance_id: web.seance, nom: 'Bloc supprimé', instance_seance_id: null })
    await inserer(db, 'objectifs_progression', { id: newId(), ...sync, ...mort, seance_id: web.seance, exercise_id: web.ex })
    await inserer(db, 'instances_seance', { id: newId(), ...sync, ...mort, seance_id: web.seance, date: '2026-10-23', is_completed: 0 })

    const exp = await construireExport(db, MAINTENANT)
    expect(exp.strengthTemplates.map((t) => t.seance.nom)).toEqual(['Jambes web'])
    expect(exp.strengthTemplates[0].blocs.map((b) => b.nom)).toEqual(['Principal'])
    expect(exp.customExercises.map((e) => e.name)).toEqual(['Fente bulgare'])
    expect(exp.strengthSessions.completed[0].series.map((s) => s.numeroSerie)).toEqual([1, 2])
    expect(exp.strengthSessions.planned).toEqual([])
    expect(exp.objectifsProgression).toHaveLength(1)
  })

  it("séance supprimée avec historique gardé : exportée archivée, sans blocs, et ses séances jouées restent importables", async () => {
    const web = await ajouterDonneesWeb(db)
    await db.execute("UPDATE seances SET deleted_at = '2026-10-22T10:00:00.000Z' WHERE id = ?", [web.seance])
    await db.execute("UPDATE blocs_seance SET deleted_at = '2026-10-22T10:00:00.000Z' WHERE instance_seance_id IS NULL")
    await db.execute("UPDATE exercices_seance SET deleted_at = '2026-10-22T10:00:00.000Z' WHERE instance_seance_id IS NULL")
    const exp = await construireExport(db, MAINTENANT)
    expect(exp.strengthTemplates).toHaveLength(1)
    expect(exp.strengthTemplates[0]).toMatchObject({
      seance: { uuid: web.seance, nom: 'Jambes web', isArchived: true, deletedAt: '2026-10-22T10:00:00.000Z' },
      blocs: [],
      exercices: [],
    })
    expect(exp.strengthSessions.completed).toHaveLength(1)

    const plan = buildImportPlan(JSON.parse(JSON.stringify(exp)), AUTRE, { now: NOW })
    expect(plan.report.ignores).toEqual([])
    expect(verifierIntegrite(plan)).toEqual([])
    const cible = createTestDb()
    await applyImportPlan(cible, plan)
    // La séance revient comme suppression logique (nom lisible), l'historique est intact
    const seance = await cible.get<{ nom: string; deleted_at: string | null; is_archived: number }>('SELECT * FROM seances')
    expect(seance).toMatchObject({ nom: 'Jambes web', deleted_at: '2026-10-22T10:00:00.000Z', is_archived: 1 })
    expect((await compterVivantes(cible)).instances_seance).toBe(1)
    expect((await compterVivantes(cible)).series_realisees).toBe(2)
  })

  it('exercice supprimé encore référencé : exporté avec deletedAt, non recréé en fiche minimale', async () => {
    const web = await ajouterDonneesWeb(db)
    await db.execute("UPDATE exercises SET deleted_at = '2026-10-22T10:00:00.000Z' WHERE id = ?", [web.ex])
    const exp = await construireExport(db, MAINTENANT)
    expect(exp.customExercises).toEqual([
      expect.objectContaining({ uuid: web.ex, name: 'Fente bulgare', deletedAt: '2026-10-22T10:00:00.000Z' }),
    ])
    const plan = buildImportPlan(JSON.parse(JSON.stringify(exp)), AUTRE, { now: NOW })
    expect(plan.report.exercisesCrees).toBe(0)
    expect(plan.rows.exercises[0].deleted_at).toBe('2026-10-22T10:00:00.000Z')
  })

  it("refuse l'export si l'appareil contient des lignes d'un autre compte (aucune donnée d'autrui dans le fichier)", async () => {
    await ajouterDonneesWeb(db) // lignes de USER
    await expect(construireExport(db, MAINTENANT, AUTRE)).rejects.toThrow(ErreurExport)
    await expect(construireExport(db, MAINTENANT, AUTRE)).rejects.toThrow(/autre compte/)
    // Lignes non encore synchronisées (user_id vide) : acceptées, ce sont celles de l'appareil
    await db.execute('UPDATE seances SET user_id = NULL')
    await db.execute("UPDATE exercises SET user_id = NULL")
    await db.execute("UPDATE blocs_seance SET user_id = NULL")
    await db.execute("UPDATE exercices_seance SET user_id = NULL")
    await db.execute("UPDATE instances_seance SET user_id = NULL")
    await db.execute("UPDATE series_realisees SET user_id = NULL")
    await db.execute("UPDATE objectifs_progression SET user_id = NULL")
    await expect(construireExport(db, MAINTENANT, AUTRE)).resolves.toMatchObject({ webUserId: AUTRE })
    expect((await construireExport(db, MAINTENANT, USER)).strengthTemplates).toHaveLength(1)
  })

  it('porte le compte exportateur (webUserId) quand il est connu', async () => {
    expect((await construireExport(db, MAINTENANT, USER)).webUserId).toBe(USER)
    expect('webUserId' in (await construireExport(db, MAINTENANT))).toBe(false)
  })

  it('stable : deux exports successifs donnent les mêmes ids (réimports successifs sans mélange)', async () => {
    await importer(db, exportV32)
    const a = await construireExport(db, MAINTENANT)
    const b = await construireExport(db, new Date('2026-11-01T00:00:00.000Z'))
    expect({ ...b, exportDate: '' }).toEqual({ ...a, exportDate: '' })
  })

  it("réimporter deux fois le même fichier ne duplique rien (ids déterministes de l'import)", async () => {
    await importer(db, exportV32)
    const json = JSON.parse(JSON.stringify(await construireExport(db, MAINTENANT))) as unknown
    const cible = createTestDb()
    await importer(cible, json, AUTRE)
    const apres1 = await compterVivantes(cible)
    await importer(cible, json, AUTRE)
    expect(await compterVivantes(cible)).toEqual(apres1)
  })
})

// Instantané complet d'une base (toutes les colonnes, tombstones compris), hors updated_at ; les
// horodatages sont comparés en instants (le format peut changer, pas l'instant).
const HORODATAGES = ['created_at', 'completed_at', 'started_at', 'validated_at', 'deleted_at']
async function instantane(base: Db) {
  const out: Record<string, unknown> = {}
  for (const t of TABLES) {
    out[t] = (await base.getAll<L>(`SELECT * FROM ${t} ORDER BY id`)).map((ligne) => {
      const copie: L = { ...ligne }
      delete copie.updated_at
      for (const h of HORODATAGES) if (h in copie) copie[h] = instant(copie[h])
      return copie
    })
  }
  const reglages = await base.getOptional<{ equipment_json: string }>('SELECT equipment_json FROM user_settings')
  out.materiel = reglages ? JSON.parse(reglages.equipment_json) : null
  return out
}

describe('réimport d’une sauvegarde web', () => {
  async function scenario() {
    await importer(db, exportV32)
    const web = await ajouterDonneesWeb(db)
    return web
  }
  const fichier = async (user?: string) => JSON.parse(JSON.stringify(await construireExport(db, MAINTENANT, user))) as unknown

  it('dans le même compte : mise à jour exacte, aucun doublon, valeurs inchangées', async () => {
    await scenario()
    const avant = await instantane(db)
    const plan = buildImportPlan(await fichier(USER), USER, { now: NOW })
    expect(plan.report.ignores).toEqual([])
    await applyImportPlan(db, plan)
    expect(await instantane(db)).toEqual(avant)
  })

  it('dans le même compte après une suppression par erreur : la séance revient, rien n’est dupliqué', async () => {
    const web = await scenario()
    const json = await fichier(USER)
    const avant = await instantane(db)
    await db.execute("UPDATE seances SET deleted_at = '2026-10-26T10:00:00.000Z' WHERE id = ?", [web.seance])
    await applyImportPlan(db, buildImportPlan(json, USER, { now: NOW }))
    expect(await instantane(db)).toEqual(avant)
  })

  it('dans le même compte, séance supprimée avec historique : aucun doublon', async () => {
    const web = await scenario()
    await db.execute("UPDATE seances SET deleted_at = '2026-10-22T10:00:00.000Z' WHERE id = ?", [web.seance])
    const avant = await compterVivantes(db)
    const total = async () => (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM exercices_seance')).n
    const totalAvant = await total()
    await applyImportPlan(db, buildImportPlan(await fichier(USER), USER, { now: NOW }))
    expect(await compterVivantes(db)).toEqual(avant)
    expect(await total()).toBe(totalAvant)
  })

  it('dans un compte vide (même utilisateur, appareil effacé) : base identique', async () => {
    await scenario()
    const avant = await instantane(db)
    const cible = createTestDb()
    await applyImportPlan(cible, buildImportPlan(await fichier(USER), USER, { now: NOW }))
    expect(await instantane(cible)).toEqual(avant)
  })

  it('fichier d’un autre compte : les uuid ne sont pas repris (ids propres au compte importateur)', async () => {
    const web = await scenario()
    const plan = buildImportPlan(await fichier(USER), AUTRE, { now: NOW })
    const ids = new Set(Object.values(plan.rows).flat().map((l) => l.id))
    expect(ids.has(web.seance)).toBe(false)
    expect(ids.has(web.instance)).toBe(false)
    expect(ids.has(web.ex)).toBe(false)
  })

  it('fichier web sans webUserId : traité comme un fichier étranger (uuid ignorés)', async () => {
    const web = await scenario()
    const plan = buildImportPlan(await fichier(), USER, { now: NOW })
    expect(plan.rows.seances.some((l) => l.id === web.seance)).toBe(false)
  })
})
