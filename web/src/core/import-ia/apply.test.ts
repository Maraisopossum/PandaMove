import { beforeEach, describe, expect, it } from 'vitest'
import { blocsDe, exercicesDe } from '../../features/strength/draft'
import { chargerBrouillon } from '../../features/strength/seanceStore'
import { createTestDb } from '../../test/sqliteDb'
import { installerCatalogueDeBase } from '../catalogue/installerCatalogue'
import type { Db } from '../db/Db'
import { listExercises } from '../db/repos/exercises'
import { getSeanceTree, listSeanceTemplates } from '../db/repos/seances'
import { analyserTexteIA } from './analyser'
import { ErreurImportIA, appliquerImportIA, lireContextePlan } from './apply'
import { planifierImportIA } from './planifier'

const USER = '11111111-1111-4111-8111-111111111111'
let db: Db

beforeEach(async () => {
  db = createTestDb()
  await installerCatalogueDeBase(db, USER)
})

const fichier = (seances: unknown[]) => JSON.stringify({ format: 'pandamove-seances-ia', version: 1, seances })
const SEANCE = {
  nom: 'Pousser',
  notes: 'Lundi',
  blocs: [
    { type: 'ECHAUFFEMENT', exercices: [{ exercice: 'Pompes', series: 2, reps: 10 }] },
    { type: 'LIBRE', exercices: [{ exercice: 'Développé couché barre', series: 4, reps: '6-8', chargeKg: 60, reposSec: 120, progression: { activee: true } }] },
    { type: 'SUPERSET', nom: 'Bras', exercices: [
      { exercice: 'Curl haltères debout', series: 3, reps: 12 },
      { exercice: 'Dips lestés', series: 3, reps: 10, muscles: { principal: 'TRICEPS', secondaires: ['PECTORAUX'] } },
    ] },
    { type: 'CIRCUIT', tours: 3, exercices: [{ exercice: 'Gainage planche', dureeSec: 40, muscles: { principal: 'ABDOMINAUX' } }, { exercice: 'Squat poids du corps', dureeSec: 30 }] },
  ],
}

// Pipeline complet de l'écran : texte -> analyse -> plan (état réel de la base) -> aperçu -> écriture
async function importer(texte: string) {
  const analyse = analyserTexteIA(texte)
  if (!analyse.donnees) return { analyse, plan: null, resultat: null }
  const plan = planifierImportIA(analyse.donnees, await lireContextePlan(db, USER))
  const resultat = plan.erreurs.length === 0 ? await appliquerImportIA(db, plan, USER) : null
  return { analyse, plan, resultat }
}

const instantane = async () => ({
  seances: await db.getAll('SELECT * FROM seances ORDER BY id'),
  blocs: await db.getAll('SELECT * FROM blocs_seance ORDER BY id'),
  exercices: await db.getAll('SELECT * FROM exercices_seance ORDER BY id'),
  exos: await db.getAll('SELECT id, name, deleted_at FROM exercises ORDER BY id'),
})

describe('import de séances IA de bout en bout', () => {
  it('fichier -> aperçu -> import : séances lisibles par les dépôts et par l\'éditeur', async () => {
    const { plan, resultat } = await importer(fichier([SEANCE, { nom: 'Tirer', blocs: [{ type: 'LIBRE', exercices: [{ exercice: 'Traction neutre', series: 3, reps: 8, charge: 'PDC' }] }] }]))
    expect(plan!.erreurs).toEqual([])
    expect(plan!.seances.map((s) => s.statut)).toEqual(['nouvelle', 'nouvelle'])
    expect(plan!.seances[0].aCreer.map((a) => a.nom)).toEqual(['Dips lestés', 'Gainage planche', 'Squat poids du corps'])
    expect(resultat).toEqual({ seances: 2, ignorees: 0, exercicesCrees: 3 })

    const modeles = await listSeanceTemplates(db)
    expect(modeles.map((s) => s.nom)).toEqual(['Pousser', 'Tirer'])
    const pousser = modeles.find((s) => s.nom === 'Pousser')!
    expect(pousser.dureeEstimeeMin).toBe(plan!.seances[0].dureeMin)
    expect(pousser.dureeEstimeeMin).toBeGreaterThan(0)
    expect(JSON.parse(pousser.groupesMusculaires)).toContain('TRICEPS')

    // L'éditeur relit exactement ce qui a été écrit
    const catalogue = await listExercises(db)
    const d = (await chargerBrouillon(db, pousser.id, catalogue))!
    expect(d.nom).toBe('Pousser')
    expect(d.notes).toBe('Lundi')
    expect(d.items.map((i) => (i.kind === 'libre' ? 'libre' : i.bloc.type))).toEqual(['ECHAUFFEMENT', 'libre', 'SUPERSET', 'CIRCUIT'])
    expect(exercicesDe(d).map((e) => e.exerciseNom)).toEqual([
      'Pompes', 'Développé couché barre', 'Curl haltères debout', 'Dips lestés', 'Gainage planche', 'Squat poids du corps',
    ])
    const circuit = blocsDe(d).find((b) => b.type === 'CIRCUIT')!
    expect(circuit.exercices.map((e) => [e.nombreSeriesPrevues, e.repsType, e.repsCibles])).toEqual([[3, 'DURATION', '40'], [3, 'DURATION', '30']])
    const dc = exercicesDe(d).find((e) => e.exerciseNom === 'Développé couché barre')!
    expect(dc).toMatchObject({ progressionActivee: true, systemeProgression: 'DOUBLE', repsMin: 6, repsMax: 8, chargeCible: '60 kg', tempsReposSec: 120 })
  })

  it('on ne crée que des MODÈLES, sans user_id sur les séances ; exercices créés personnalisés', async () => {
    await importer(fichier([SEANCE]))
    const [{ n: instancesLignes }] = await db.getAll<{ n: number }>(
      "SELECT (SELECT COUNT(*) FROM blocs_seance WHERE instance_seance_id IS NOT NULL) + (SELECT COUNT(*) FROM exercices_seance WHERE instance_seance_id IS NOT NULL) AS n",
    )
    expect(instancesLignes).toBe(0)
    expect((await db.getAll('SELECT id FROM instances_seance')).length).toBe(0)
    const [s] = await db.getAll<Record<string, unknown>>('SELECT * FROM seances')
    expect(s.user_id ?? null).toBeNull()
    const dips = await db.getAll<Record<string, unknown>>("SELECT * FROM exercises WHERE name = 'Dips lestés'")
    expect(dips).toHaveLength(1)
    expect(dips[0]).toMatchObject({ is_custom: 1, user_id: USER, muscle_primary: 'TRICEPS', deleted_at: null })
    expect(JSON.parse(dips[0].muscle_groups as string)).toEqual(['TRICEPS', 'PECTORAUX'])
    const [{ id }] = await db.getAll<{ id: string }>('SELECT id FROM seances')
    const arbre = await getSeanceTree(db, id, null)
    expect(arbre.blocs).toHaveLength(3)
    expect(arbre.exercices).toHaveLength(6)
  })

  it('idempotent : réimporter le même fichier ne change rien à la base', async () => {
    await importer(fichier([SEANCE]))
    const avant = await instantane()
    const { plan, resultat } = await importer(fichier([SEANCE]))
    expect(plan!.seances[0].statut).toBe('deja-presente')
    expect(plan!.exercicesACreer).toEqual([])
    expect(resultat).toEqual({ seances: 0, ignorees: 1, exercicesCrees: 0 })
    expect(await instantane()).toEqual(avant)
  })

  it('même nom, contenu différent : (2), puis (3) ; chacun reste idempotent', async () => {
    await importer(fichier([SEANCE]))
    const v2 = { ...SEANCE, notes: 'v2' }
    const v3 = { ...SEANCE, notes: 'v3' }
    const r2 = await importer(fichier([v2]))
    expect(r2.plan!.seances[0]).toMatchObject({ nom: 'Pousser (2)', renommee: true })
    await importer(fichier([v3]))
    expect((await listSeanceTemplates(db)).map((s) => s.nom).sort()).toEqual(['Pousser', 'Pousser (2)', 'Pousser (3)'])
    const avant = await instantane()
    await importer(fichier([SEANCE, v2, v3]))
    expect(await instantane()).toEqual(avant)
  })

  it('une séance supprimée logiquement est restaurée par un nouvel import (mêmes lignes)', async () => {
    await importer(fichier([SEANCE]))
    const [{ id }] = await db.getAll<{ id: string }>('SELECT id FROM seances')
    await db.execute("UPDATE seances SET deleted_at = '2026-01-01T00:00:00Z' WHERE id = ?", [id])
    const { resultat } = await importer(fichier([SEANCE]))
    expect(resultat).toMatchObject({ seances: 1 })
    expect((await listSeanceTemplates(db)).map((s) => s.id)).toEqual([id])
    expect((await getSeanceTree(db, id, null)).exercices).toHaveLength(6)
  })

  it('un exercice déjà créé par un import précédent est reconnu (pas de doublon)', async () => {
    await importer(fichier([SEANCE]))
    const autre = { nom: 'Autre', blocs: [{ type: 'LIBRE', exercices: [{ exercice: 'dips lestes', series: 3 }] }] }
    const { plan } = await importer(fichier([autre]))
    expect(plan!.exercicesACreer).toEqual([])
    expect(plan!.seances[0].reconnus[0]).toMatchObject({ nomCatalogue: 'Dips lestés', via: 'exact' })
    const noms = (await listExercises(db)).filter((e) => e.name === 'Dips lestés')
    expect(noms).toHaveLength(1)
  })
})

describe('fichiers invalides : rien n\'est écrit', () => {
  const casse = async (texte: string) => {
    const avant = await instantane()
    const r = await importer(texte)
    expect(r.resultat).toBeNull()
    expect(await instantane()).toEqual(avant)
    return r.analyse.erreurs
  }

  it('JSON cassé', async () => {
    expect((await casse('{"format": "pandamove-seances-ia", "seances": [')) [0]).toMatch(/^JSON invalide ou tronqué/)
  })

  it('texte sans JSON', async () => {
    expect(await casse("Désolé, je n'ai pas compris.")).toEqual(["Aucun JSON trouvé dans le texte. Collez uniquement la réponse JSON de l'IA."])
  })

  it('enum inconnue, série 0, bloc sans exercice : toutes les erreurs listées avec leur chemin', async () => {
    const erreurs = await casse(
      fichier([
        { nom: 'A', blocs: [{ type: 'PYRAMIDE', exercices: [{ exercice: 'Pompes', series: 3 }] }] },
        { nom: 'B', blocs: [{ type: 'LIBRE', exercices: [{ exercice: 'Pompes', series: 0 }] }, { type: 'SUPERSET', exercices: [] }] },
      ]),
    )
    expect(erreurs).toEqual([
      "seances[0].blocs[0].type : doit valoir l'une de ces valeurs : LIBRE, ECHAUFFEMENT, ACTIVATION, SUPERSET, CIRCUIT, RECUPERATION",
      'seances[1].blocs[0].exercices[0].series : doit être un entier entre 1 et 20',
      'seances[1].blocs[1].exercices : doit contenir au moins 1 élément',
    ])
  })

  it('séance vide', async () => {
    expect(await casse(fichier([{ nom: 'Vide', blocs: [] }]))).toEqual(['seances[0].blocs : doit contenir au moins 1 élément'])
  })

  it('plan avec erreur de conversion : refus avant toute écriture', async () => {
    const analyse = analyserTexteIA(fichier([SEANCE]))
    const plan = planifierImportIA(analyse.donnees!, await lireContextePlan(db, USER))
    const avant = await instantane()
    await expect(appliquerImportIA(db, { ...plan, erreurs: ['Séance « X » : problème'] }, USER)).rejects.toBeInstanceOf(ErreurImportIA)
    expect(await instantane()).toEqual(avant)
  })

  it('exercice inconnu : pas une erreur, créé et signalé avec une suggestion', async () => {
    const r = await importer(fichier([{ nom: 'Z', blocs: [{ type: 'LIBRE', exercices: [{ exercice: 'Developpe couche barr', series: 3 }] }] }]))
    expect(r.analyse.erreurs).toEqual([])
    expect(r.plan!.seances[0].avertissements.join()).toMatch(/Développé couché barre/)
    expect(r.resultat).toMatchObject({ seances: 1, exercicesCrees: 1 })
  })

  it('texte d\'IA bavard avec ```json, guillemets typographiques et virgule finale', async () => {
    const json = fichier([{ nom: 'Bavard', blocs: [{ type: 'LIBRE', exercices: [{ exercice: 'Pompes', series: 3 }] }] }])
    const joli = json.replace(/"/g, '“').replace(/\]\}$/, ',]}')
    const texte = `Bien sûr ! Voici :
\`\`\`json
${joli}
\`\`\`
Bonne séance !`
    const r = await importer(texte)
    expect(r.analyse.erreurs).toEqual([])
    expect(r.analyse.notes).toContain('Virgules finales supprimées.')
    expect(r.resultat).toMatchObject({ seances: 1 })
  })
})
