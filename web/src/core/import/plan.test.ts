import { describe, expect, it } from 'vitest'
import { deterministicId } from '../db/ids'
import catalogue from './__fixtures__/catalogue.json'
import exportV30 from './__fixtures__/export-v3.0.json'
import exportV32 from './__fixtures__/export-v3.2.json'
import materiel from './__fixtures__/materiel.json'
import { buildImportPlan, detecterTypeExport, ImportError, verifierIntegrite, type ImportPlan, type Row } from './plan'

const USER = '11111111-1111-4111-8111-111111111111'
const AUTRE_USER = '22222222-2222-4222-8222-222222222222'
const NOW = '2026-10-24T12:00:00.000Z'

const plan = (input: unknown, userId = USER): ImportPlan => buildImportPlan(input, userId, { now: NOW })
const idDe = (table: string, legacy: number, userId = USER) => deterministicId(`${userId}:${table}`, String(legacy))
const idExercice = (nomNormalise: string, userId = USER) => deterministicId(`${userId}:exercises`, nomNormalise)
const parId = (rows: Row[], id: string): Row => {
  const r = rows.find((x) => x.id === id)
  if (!r) throw new Error(`ligne ${id} absente`)
  return r
}

// Capture l'ImportError levée (échoue si rien n'est levé ou si c'est une autre erreur).
function erreurDe(fn: () => unknown): ImportError {
  try {
    fn()
  } catch (e) {
    if (e instanceof ImportError) return e
    throw e
  }
  throw new Error('ImportError attendue')
}

describe('buildImportPlan — export complet v3.2', () => {
  it('(a) produit des séances, blocs et exercices non vides', () => {
    const p = plan(exportV32)
    expect(p.rows.seances).toHaveLength(2)
    expect(p.rows.blocs_seance.length).toBeGreaterThan(0)
    expect(p.rows.exercices_seance.length).toBeGreaterThan(0)
    expect(p.report).toEqual({
      seances: 2,
      instances: 2,
      series: 3,
      exercises: 5,
      exercisesCrees: 3,
      ignores: expect.any(Array),
    })
    // 2 + 2 blocs (template + copie d'instance), 6 + 3 exercices
    expect(p.rows.blocs_seance).toHaveLength(4)
    expect(p.rows.exercices_seance).toHaveLength(9)
    expect(p.rows.series_realisees).toHaveLength(3)
    expect(p.rows.objectifs_progression).toHaveLength(1)
  })

  it('mappe une séance en ligne snake_case avec types base (JSON, 0/1, dates ISO)', () => {
    const p = plan(exportV32)
    const s = parId(p.rows.seances, idDe('seances', 101))
    expect(s).toEqual({
      id: idDe('seances', 101),
      user_id: USER,
      updated_at: '2026-01-12T18:30:00',
      deleted_at: null,
      nom: 'Haut du corps A',
      groupes_musculaires: '["PECTORAUX","DOS"]',
      duree_estimee_min: 50,
      notes: 'Séance synthétique de test',
      seance_category: 'STRENGTH',
      created_at: '2026-01-10T09:00:00',
      is_archived: 0,
    })
  })

  it('mappe les champs de progression, poids de corps, bilatéral et DURATION', () => {
    const p = plan(exportV32)
    const dc = parId(p.rows.exercices_seance, idDe('exercices_seance', 301))
    expect(dc).toMatchObject({
      seance_id: idDe('seances', 101),
      exercise_id: idExercice('developpe couche'),
      bloc_id: idDe('blocs_seance', 202),
      superset_groupe: 'A',
      instance_seance_id: null,
      exercice_source_id: null,
      progression_activee: 1,
      systeme_progression: 'DOUBLE',
      reps_min: 8,
      reps_max: 12,
      increment_kg: 2.5,
      type_exercice: 'COMPOSE_HAUT',
      is_bilateral: 0,
      is_bodyweight: 0,
      user_id: USER,
      updated_at: NOW,
      deleted_at: null,
    })
    expect(parId(p.rows.exercices_seance, idDe('exercices_seance', 302))).toMatchObject({ is_bodyweight: 1, type_exercice: 'PDC' })
    expect(parId(p.rows.exercices_seance, idDe('exercices_seance', 303))).toMatchObject({ is_bilateral: 1, increment_pct: 0.02 })
    expect(parId(p.rows.exercices_seance, idDe('exercices_seance', 304))).toMatchObject({
      reps_type: 'DURATION',
      bloc_id: null,
      increment_duree_sec: 10,
      systeme_progression: 'TEMPORELLE',
    })
  })

  it('(b) deux appels identiques donnent exactement le même plan ; un autre userId change les ids', () => {
    const p1 = plan(exportV32)
    const p2 = plan(structuredClone(exportV32))
    expect(p2).toEqual(p1)
    const p3 = plan(exportV32, AUTRE_USER)
    expect(p3.rows.seances.map((r) => r.id)).not.toEqual(p1.rows.seances.map((r) => r.id))
    expect(p3.rows.exercises.map((r) => r.id)).not.toEqual(p1.rows.exercises.map((r) => r.id))
    expect(p3.rows.seances.every((r) => r.user_id === AUTRE_USER)).toBe(true)
  })

  it('(e) les exercices d\'instance gardent instance_seance_id et pointent leur source template', () => {
    const p = plan(exportV32)
    const inst = idDe('instances_seance', 401)
    const copie = parId(p.rows.exercices_seance, idDe('exercices_seance', 311))
    expect(copie.instance_seance_id).toBe(inst)
    expect(copie.exercice_source_id).toBe(idDe('exercices_seance', 301))
    expect(copie.bloc_id).toBe(idDe('blocs_seance', 212))
    expect(parId(p.rows.exercices_seance, idDe('exercices_seance', 312)).exercice_source_id).toBe(idDe('exercices_seance', 302))
    expect(parId(p.rows.exercices_seance, idDe('exercices_seance', 313)).exercice_source_id).toBe(idDe('exercices_seance', 303))
    const bloc = parId(p.rows.blocs_seance, idDe('blocs_seance', 212))
    expect(bloc).toMatchObject({ instance_seance_id: inst, bloc_source_id: idDe('blocs_seance', 202) })
    // Les templates restent isolés (instance_seance_id NULL)
    expect(parId(p.rows.blocs_seance, idDe('blocs_seance', 202)).instance_seance_id).toBeNull()
  })

  it('les séries pointent la copie d\'instance de l\'exercice et l\'instance', () => {
    const p = plan(exportV32)
    const s = parId(p.rows.series_realisees, idDe('series_realisees', 501))
    expect(s).toEqual({
      id: idDe('series_realisees', 501),
      user_id: USER,
      updated_at: NOW,
      deleted_at: null,
      instance_seance_id: idDe('instances_seance', 401),
      exercice_seance_id: idDe('exercices_seance', 311),
      numero_serie: 1,
      reps_realisees: 10,
      charge_kg: 60,
      charge_label: null,
      rpe: 7.5,
      notes: '',
      is_completed: 1,
    })
  })

  it('mappe les instances (réalisée et planifiée)', () => {
    const p = plan(exportV32)
    expect(parId(p.rows.instances_seance, idDe('instances_seance', 401))).toEqual({
      id: idDe('instances_seance', 401),
      user_id: USER,
      updated_at: '2026-02-03T19:05:00',
      deleted_at: null,
      seance_id: idDe('seances', 101),
      date: '2026-02-03',
      notes: 'Bonne séance',
      is_completed: 1,
      completed_at: '2026-02-03T19:05:00',
      duration_seconds: 3300,
      created_at: '2026-02-01T08:00:00',
      // Instance Android terminée : progression déjà appliquée avant finishInstance -> marquée évaluée
      progression_json: '{"evaluee":true,"decisions":{}}',
    })
    expect(parId(p.rows.instances_seance, idDe('instances_seance', 402))).toMatchObject({
      seance_id: idDe('seances', 102),
      is_completed: 0,
      completed_at: null,
      updated_at: '2026-02-04T12:00:00',
      progression_json: null,
    })
  })

  it('exercice personnalisé, référence de séance et objectif partagent un même id par nom normalisé', () => {
    const p = plan(exportV32)
    const id = idExercice('developpe couche')
    const ex = p.rows.exercises.filter((r) => r.id === id)
    expect(ex).toHaveLength(1)
    expect(ex[0]).toEqual({
      id,
      user_id: USER,
      updated_at: NOW,
      deleted_at: null,
      name: 'Développé couché',
      category: 'CHEST',
      muscle_groups: '["PECTORAUX","TRICEPS"]',
      description: 'Exercice synthétique',
      is_favorite: 0,
      is_custom: 1,
      image_url: null,
      exercise_type: 'Pluri',
      equipment: '["Barre","Banc plat"]',
      muscle_primary: 'PECTORAUX',
      is_bodyweight: 0,
    })
    // Variante accentuée/casse/espaces dans la séance 102
    expect(parId(p.rows.exercices_seance, idDe('exercices_seance', 306)).exercise_id).toBe(id)
    expect(p.rows.objectifs_progression[0]).toEqual({
      id: idDe('objectifs_progression', 601),
      user_id: USER,
      updated_at: NOW,
      deleted_at: null,
      seance_id: idDe('seances', 101),
      exercise_id: id,
      charge_cible: 62.5,
      reps_cible: 8,
      duree_cible_sec: null,
      compteur_echec: 0,
      derniere_maj: '2026-02-03',
      nombre_series_cible: null,
    })
    // Catégorie inconnue -> OTHER (parité Kotlin)
    expect(parId(p.rows.exercises, idExercice('curl haltere')).category).toBe('OTHER')
  })

  it('une séance qui référence un exercice inconnu crée une ligne exercises minimale', () => {
    const p = plan(exportV32)
    const id = idExercice('mouvement inconnu xyz')
    expect(parId(p.rows.exercises, id)).toMatchObject({
      name: 'Mouvement Inconnu XYZ',
      is_custom: 1,
      category: 'OTHER',
      muscle_groups: '[]',
      equipment: '[]',
    })
    expect(parId(p.rows.exercices_seance, idDe('exercices_seance', 305)).exercise_id).toBe(id)
    expect(p.exercisesMinimauxIds).toContain(id)
    expect(p.exercisesMinimauxIds).not.toContain(idExercice('developpe couche'))
    expect(p.exercisesMinimauxIds).toHaveLength(3)
  })

  it('produit un patch matériel (haltères par défaut, clés Float normalisées, absents omis) et aucune ligne user_settings', () => {
    const p = plan(exportV32)
    expect(p.rows.user_settings).toEqual([])
    // kettlebell null dans le fichier -> clé absente du patch (l'existant sera conservé)
    expect(p.equipmentPatch).toEqual({
      selectedCategories: ['HALTERES', 'BARRE', 'MACHINE', 'CABLE'],
      pasParCategorie: { MACHINE: 5 },
      halteres: { poidsFixes: [], chargeable: null },
      barre: { barreKg: 20, disques: { '20': 2, '10': 4, '1.25': 4 } },
      cable: { minKg: 2.5, maxKg: 50, pasKg: 2.5 },
    })
    expect(p.equipmentPatch).not.toHaveProperty('kettlebell')
  })

  it('signale les sections hors périmètre ignorées', () => {
    const p = plan(exportV32)
    expect(p.report.ignores.some((m) => m.includes('runTemplates'))).toBe(true)
    expect(p.report.ignores.some((m) => m.includes('breathingSessions'))).toBe(true)
    expect(p.report.ignores.some((m) => m.includes('runSessions'))).toBe(false)
  })
})

describe('buildImportPlan — export v3.0', () => {
  it('(c) passe sans equipmentConfig ni objectifsProgression, avec les défauts Kotlin', () => {
    const p = plan(exportV30)
    expect(p.rows.user_settings).toEqual([])
    expect(p.rows.objectifs_progression).toEqual([])
    expect(p.report).toMatchObject({ seances: 1, instances: 1, series: 1, exercises: 1, exercisesCrees: 1 })
    expect(parId(p.rows.seances, idDe('seances', 11))).toMatchObject({
      duree_estimee_min: 60,
      notes: '',
      seance_category: 'STRENGTH',
      created_at: '2025-05-01T10:00:00',
      updated_at: NOW,
    })
    expect(parId(p.rows.blocs_seance, idDe('blocs_seance', 21))).toMatchObject({
      duree_min: null,
      description: '',
      temps_repos_inter_sec: 20,
      temps_repos_fin_round_sec: 120,
    })
    expect(parId(p.rows.exercices_seance, idDe('exercices_seance', 31))).toMatchObject({
      progression_activee: 0,
      systeme_progression: null,
      reps_min: null,
      reps_max: null,
      increment_kg: null,
      increment_duree_sec: 5,
      seuil_deload: 3,
      type_exercice: null,
      increment_pct: null,
      is_bodyweight: 0,
      superset_groupe: null,
    })
    const copie = parId(p.rows.exercices_seance, idDe('exercices_seance', 32))
    expect(copie).toMatchObject({
      instance_seance_id: idDe('instances_seance', 41),
      exercice_source_id: idDe('exercices_seance', 31),
      reps_type: 'REPS',
      temps_repos_sec: 90,
    })
    expect(parId(p.rows.instances_seance, idDe('instances_seance', 41))).toMatchObject({ notes: '' })
    expect(parId(p.rows.series_realisees, idDe('series_realisees', 51))).toMatchObject({
      exercice_seance_id: idDe('exercices_seance', 32),
      rpe: null,
      charge_label: null,
      notes: '',
    })
  })

  it('remplace les valeurs d\'énumération inconnues comme le Kotlin (runCatching valueOf)', () => {
    const e = structuredClone(exportV30)
    const ex = e.strengthTemplates[0].exercices[0] as Record<string, unknown>
    ex.repsType = 'FOO'
    ex.typeExercice = 'BAR'
    ex.systemeProgression = 'BAZ'
    const bloc = e.strengthTemplates[0].blocs[0] as Record<string, unknown>
    bloc.type = 'INCONNU'
    ;(e.strengthTemplates[0].seance as Record<string, unknown>).seanceCategory = 'NOPE'
    const p = plan(e)
    expect(parId(p.rows.exercices_seance, idDe('exercices_seance', 31))).toMatchObject({
      reps_type: 'REPS',
      type_exercice: null,
      systeme_progression: null,
    })
    expect(parId(p.rows.blocs_seance, idDe('blocs_seance', 21)).type).toBe('ECHAUFFEMENT')
    expect(parId(p.rows.seances, idDe('seances', 11)).seance_category).toBe('STRENGTH')
  })
})

describe('buildImportPlan — erreurs', () => {
  it('(d) un champ de mauvais type lève ImportError avec le chemin du champ', () => {
    const e = structuredClone(exportV32) as Record<string, unknown>
    ;((e.strengthTemplates as Record<string, Record<string, unknown>>[])[0].seance).nom = 42
    const err = erreurDe(() => plan(e))
    expect(err.chemin).toBe('strengthTemplates.0.seance.nom')
    expect(err.message).toContain('strengthTemplates.0.seance.nom')
  })

  it('(d) un objet tronqué (champ obligatoire manquant) lève ImportError', () => {
    const e = structuredClone(exportV32)
    delete (e.strengthSessions.completed[0].series[1] as Record<string, unknown>).numeroSerie
    const err = erreurDe(() => plan(e))
    expect(err.chemin).toBe('strengthSessions.completed.0.series.1.numeroSerie')
  })

  it('(d) une entrée qui n\'est pas un objet lève ImportError', () => {
    expect(erreurDe(() => plan(null)).chemin).toBe('')
    expect(erreurDe(() => plan('{"version":"3.2"')).chemin).toBe('')
    expect(erreurDe(() => plan([1, 2])).chemin).toBe('')
  })

  it('une version 2.0 (strengthSessions en liste) est refusée', () => {
    const err = erreurDe(() => plan({ version: '2.0', strengthTemplates: [], strengthSessions: [] }))
    expect(err.message).toContain("version d'export non prise en charge")
    expect(err.chemin).toBe('version')
  })

  it('un export sans version est lu comme v3.0 (défaut Kotlin)', () => {
    const p = plan({ strengthTemplates: [] })
    expect(p.report.seances).toBe(0)
  })
})

describe('exports autonomes', () => {
  it('detecterTypeExport reconnaît les trois formats', () => {
    expect(detecterTypeExport(exportV32)).toBe('complet')
    expect(detecterTypeExport(exportV30)).toBe('complet')
    expect(detecterTypeExport(catalogue)).toBe('catalogue')
    expect(detecterTypeExport(materiel)).toBe('materiel')
    expect(erreurDe(() => detecterTypeExport({ foo: 1 })).message).toContain('non reconnu')
    expect(() => detecterTypeExport(42)).toThrow(ImportError)
  })

  it('un export catalogue produit des lignes exercises partageant l\'id du même nom dans un export complet', () => {
    const p = plan(catalogue)
    expect(p.rows.exercises).toHaveLength(3)
    expect(p.rows.seances).toEqual([])
    expect(p.report).toMatchObject({ exercises: 3, exercisesCrees: 0, seances: 0 })
    const dc = parId(p.rows.exercises, idExercice('developpe couche'))
    expect(dc).toMatchObject({ name: 'DÉVELOPPÉ Couché', is_custom: 1, muscle_groups: '["PECTORAUX","TRICEPS","EPAULES"]' })
    // Même id que l'exercice personnalisé et la référence de séance de l'export complet
    const complet = plan(exportV32)
    expect(parId(complet.rows.exercices_seance, idDe('exercices_seance', 301)).exercise_id).toBe(dc.id)
    // Squat barre : même id que l'exercice minimal créé par l'export v3.0
    expect(plan(exportV30).rows.exercises[0].id).toBe(parId(p.rows.exercises, idExercice('squat barre')).id)
  })

  it('un export matériel autonome produit uniquement un patch matériel', () => {
    expect(detecterTypeExport(materiel)).toBe('materiel')
    const p = plan(materiel)
    for (const lignes of Object.values(p.rows)) expect(lignes).toEqual([])
    expect(p.equipmentPatch).toEqual({
      selectedCategories: ['HALTERES', 'KETTLEBELL'],
      pasParCategorie: {},
      halteres: { poidsFixes: [5, 7.5], chargeable: null },
      kettlebell: { minKg: 8, maxKg: 24, pasKg: 4 },
    })
  })

  it('le patch matériel ne contient que les clés non nulles et des haltères par défaut si null', () => {
    const m = structuredClone(materiel) as { config: Record<string, unknown> }
    m.config.halteres = null
    m.config.kettlebell = null
    expect(plan(m).equipmentPatch).toEqual({
      selectedCategories: ['HALTERES', 'KETTLEBELL'],
      pasParCategorie: {},
      halteres: { poidsFixes: [], chargeable: null },
    })
  })

  it('un export complet sans equipmentConfig donne un patch null', () => {
    expect(plan(exportV30).equipmentPatch).toBeNull()
    expect(plan(catalogue).equipmentPatch).toBeNull()
  })

  it('une clé de disque non numérique est refusée avec son chemin', () => {
    const m = structuredClone(materiel)
    ;(m.config as Record<string, unknown>).barre = { barreKg: 20, disques: { abc: 2 } }
    expect(erreurDe(() => plan(m)).chemin).toBe('config.barre.disques.abc')
  })
})

describe('intégrité référentielle (orphelins : écartés et signalés)', () => {
  it('verifierIntegrite ne signale rien sur les plans de toutes les fixtures', () => {
    for (const f of [exportV32, exportV30, catalogue, materiel]) expect(verifierIntegrite(plan(f))).toEqual([])
  })

  it('verifierIntegrite détecte une référence non résolue', () => {
    const p = plan(exportV32)
    p.rows.series_realisees[0] = { ...p.rows.series_realisees[0], exercice_seance_id: 'inexistant' }
    p.rows.exercices_seance[0] = { ...p.rows.exercices_seance[0], bloc_id: 'bloc-fantome' }
    const v = verifierIntegrite(p)
    expect(v).toHaveLength(2)
    expect(v.some((m) => m.includes('series_realisees') && m.includes('exercice_seance_id'))).toBe(true)
    expect(v.some((m) => m.includes('exercices_seance') && m.includes('bloc_id'))).toBe(true)
  })

  it('écarte séries, blocs, exercices, instances et objectifs orphelins et le signale', () => {
    const e = structuredClone(exportV32) as unknown as {
      strengthTemplates: { blocs: object[]; exercices: object[] }[]
      strengthSessions: { completed: { series: object[] }[]; planned: object[] }
      objectifsProgression: object[]
    }
    const serie = (id: number, inst: number, ex: number) => ({ id, instanceSeanceId: inst, exerciceSeanceId: ex, numeroSerie: 9 })
    // Séries : exercice de séance inconnu, instance inconnue
    e.strengthSessions.completed[0].series.push(serie(599, 401, 9999), serie(598, 4999, 311))
    // Bloc et exercice dont la séance est absente
    e.strengthTemplates[0].blocs.push({ id: 299, seanceId: 777, nom: 'Orphelin' })
    e.strengthTemplates[0].exercices.push({ id: 399, seanceId: 777, exerciceId: 1, exerciceName: 'Exercice Fantôme' })
    // Exercice dont le bloc (facultatif) est inconnu : conservé, bloc_id remis à null
    e.strengthTemplates[1].exercices.push({ id: 307, seanceId: 102, exerciceId: 9003, exerciceName: 'Planche', blocId: 2999, position: 3 })
    // Instance sans template (et sa copie d'exercice + sa série)
    e.strengthSessions.planned.push({
      instance: { id: 499, seanceId: 888, date: '2026-03-01' },
      exercices: [{ id: 398, seanceId: 888, exerciceId: 9002, exerciceName: 'Tractions', instanceSeanceId: 499 }],
      series: [serie(597, 499, 398)],
    })
    // Objectifs : exercice inconnu, séance inconnue
    e.objectifsProgression.push(
      { id: 699, seanceId: 101, exerciceId: 5, exerciceName: 'Inexistant' },
      { id: 698, seanceId: 999, exerciceId: 9001, exerciceName: 'Développé couché' },
    )

    const p = plan(e)
    const ids = (rows: Row[]) => rows.map((r) => r.id)
    for (const legacy of [599, 598, 597]) expect(ids(p.rows.series_realisees)).not.toContain(idDe('series_realisees', legacy))
    expect(ids(p.rows.blocs_seance)).not.toContain(idDe('blocs_seance', 299))
    expect(ids(p.rows.exercices_seance)).not.toContain(idDe('exercices_seance', 399))
    expect(ids(p.rows.exercices_seance)).not.toContain(idDe('exercices_seance', 398))
    expect(ids(p.rows.instances_seance)).not.toContain(idDe('instances_seance', 499))
    expect(ids(p.rows.objectifs_progression)).toEqual([idDe('objectifs_progression', 601)])
    expect(parId(p.rows.exercices_seance, idDe('exercices_seance', 307)).bloc_id).toBeNull()
    // L'exercice minimal créé uniquement par une ligne écartée ne subsiste pas
    expect(ids(p.rows.exercises)).not.toContain(idExercice('exercice fantome'))
    expect(ids(p.rows.exercises)).not.toContain(idExercice('inexistant'))
    expect(p.report).toMatchObject({ seances: 2, instances: 2, series: 3, exercises: 5, exercisesCrees: 3 })

    const ig = p.report.ignores.join('\n')
    expect(ig).toMatch(/3 série\(s\) ignorée\(s\)/)
    expect(ig).toMatch(/1 bloc\(s\) ignoré\(s\)/)
    expect(ig).toMatch(/2 exercice\(s\) de séance ignoré\(s\)/)
    expect(ig).toMatch(/1 instance\(s\) ignorée\(s\)/)
    expect(ig).toMatch(/2 objectif\(s\) de progression ignoré\(s\)/)
    expect(ig).toMatch(/1 référence\(s\) facultative\(s\)/)
    expect(verifierIntegrite(p)).toEqual([])
  })
})

describe('sauvegarde web : uuid et exercices supprimés', () => {
  const U1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const seance = (id: number, uuid: string, nom: string) => ({ seance: { id, nom, uuid }, blocs: [], exercices: [] })

  it("un uuid invalide n'est jamais repris : repli sur l'id dérivé du numéro", () => {
    const p = buildImportPlan({ version: '3.2', webUserId: USER, strengthTemplates: [seance(1, 'pas-un-uuid', 'A')] }, USER, { now: NOW })
    expect(p.rows.seances.map((r) => r.id)).toEqual([deterministicId(`${USER}:seances`, '1')])
  })

  it('un même uuid sur deux numéros : seul le premier le garde, aucune fusion silencieuse', () => {
    const p = buildImportPlan(
      { version: '3.2', webUserId: USER, strengthTemplates: [seance(1, U1, 'A'), seance(2, U1, 'B')] },
      USER,
      { now: NOW },
    )
    expect(p.rows.seances.map((r) => [r.nom, r.id])).toEqual([
      ['A', U1],
      ['B', deterministicId(`${USER}:seances`, '2')],
    ])
  })

  it("un exercice marqué supprimé n'écrase jamais une fiche vivante de même id, quel que soit l'ordre", () => {
    const vivant = { id: 1, name: 'Squat', category: 'LEGS' }
    const supprime = { id: 2, name: 'squat', category: 'OTHER', deletedAt: '2026-10-01T00:00:00.000Z' }
    for (const liste of [[vivant, supprime], [supprime, vivant]]) {
      const p = buildImportPlan({ version: '3.2', customExercises: liste }, USER, { now: NOW })
      expect(p.rows.exercises).toHaveLength(1)
      expect(p.rows.exercises[0]).toMatchObject({ name: 'Squat', category: 'LEGS', deleted_at: null })
    }
  })
})

describe('buildImportPlan — groupes musculaires corrigés', () => {
  const exo = (id: number, name: string, extra: Record<string, unknown>) => ({
    id, name, description: '', category: 'OTHER', muscleGroups: [], exerciseType: '', equipment: [], musclePrimary: '', ...extra,
  })
  const importer = (liste: unknown[]) => buildImportPlan({ version: '3.2', customExercises: liste }, USER, { now: NOW }).rows.exercises

  it('exercice du catalogue de base : principal et groupes du catalogue', () => {
    const [l] = importer([exo(1, 'Développé couché barre', { muscleGroups: ['Pectoraux (chef sternal)'] })])
    expect(l.muscle_primary).toBe('PECTORAUX')
    expect(JSON.parse(l.muscle_groups as string)).toEqual(['PECTORAUX', 'TRICEPS', 'EPAULES'])
  })

  it('exercice perso : principal vide dérivé, principal renseigné intact', () => {
    const [a, b] = importer([
      exo(1, 'Mon exo A', { muscleGroups: ['Grand dorsal'] }),
      exo(2, 'Mon exo B', { muscleGroups: ['Grand dorsal'], musclePrimary: 'Biceps brachial' }),
    ])
    expect(a.muscle_primary).toBe('DOS')
    expect(JSON.parse(a.muscle_groups as string)).toEqual(['DOS'])
    expect(b.muscle_primary).toBe('Biceps brachial')
  })
})
