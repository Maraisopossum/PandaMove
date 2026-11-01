import { describe, expect, it } from 'vitest'
import { blocsDe, exercicesDe } from '../../features/strength/draft'
import type { Exercise } from '../db/types'
import { FORMAT_ID, validerFichierIA, type FichierIA } from './format'
import { planifierImportIA, type ContextePlan } from './planifier'

const USER = '11111111-1111-4111-8111-111111111111'

const exo = (id: string, name: string, extra: Partial<Exercise> = {}): Exercise => ({
  id, name, category: 'OTHER', muscleGroups: '["PECTORAUX","TRICEPS"]', description: '', isFavorite: false, isCustom: false,
  imageUrl: null, exerciseType: '', equipment: '["Barre"]', musclePrimary: 'PECTORAUX', isBodyweight: false, updatedAt: '', ...extra,
})
const CATALOGUE = [
  exo('e-dc', 'Développé couché barre'),
  exo('e-sq', 'Squat barre', { muscleGroups: '["QUADRICEPS","FESSIERS"]', musclePrimary: 'QUADRICEPS' }),
  exo('e-tr', 'Tractions', { muscleGroups: '["DOS","BICEPS"]', musclePrimary: 'DOS', isBodyweight: true, equipment: '[]' }),
  exo('e-ga', 'Gainage planche', { muscleGroups: '["ABDOMINAUX"]', musclePrimary: 'ABDOMINAUX', isBodyweight: true, equipment: '[]' }),
  exo('e-pu', 'Pompes', { muscleGroups: '["PECTORAUX"]', isBodyweight: true, equipment: '[]' }),
]
const ctx = (extra: Partial<ContextePlan> = {}): ContextePlan => ({ userId: USER, catalogue: CATALOGUE, seancesExistantes: [], ...extra })

function fichier(seances: unknown[]): FichierIA {
  const r = validerFichierIA({ format: FORMAT_ID, version: 1, seances })
  if (!r.donnees) throw new Error(r.erreurs.map((e) => e.texte).join('\n'))
  return r.donnees
}
const seanceBase = {
  nom: 'Haut du corps',
  notes: 'Objectif force',
  blocs: [
    { type: 'ECHAUFFEMENT', exercices: [{ exercice: 'Pompes', series: 2, reps: 10 }] },
    { type: 'LIBRE', exercices: [{ exercice: 'Développé couché barre', series: 4, reps: '6-8', chargeKg: 62.5, reposSec: 120 }] },
    { type: 'SUPERSET', nom: 'Dos / abdos', reposInterExercicesSec: 10, exercices: [
      { exercice: 'Tractions', series: 3, reps: '8', charge: 'PDC' },
      { exercice: 'Gainage planche', series: 3, dureeSec: 45, bilateral: true },
    ] },
    { type: 'CIRCUIT', tours: 4, reposFinTourSec: 60, exercices: [
      { exercice: 'Pompes', dureeSec: 30 },
      { exercice: 'Squat barre', dureeSec: 40 },
    ] },
  ],
}

describe('planifierImportIA : conversion en brouillons', () => {
  const plan = planifierImportIA(fichier([seanceBase]), ctx())
  const [d] = plan.brouillons

  it('un brouillon par séance, sans erreur', () => {
    expect(plan.erreurs).toEqual([])
    expect(plan.brouillons).toHaveLength(1)
    expect(d.nom).toBe('Haut du corps')
    expect(d.notes).toBe('Objectif force')
    expect(d.existante).toBe(false)
    expect(d.seanceCategory).toBe('STRENGTH')
  })

  it('ordre unifié : bloc, exercice libre, blocs ; positions entrelacées', () => {
    expect(d.items.map((i) => (i.kind === 'libre' ? `libre:${i.exercice.exerciseNom}` : `bloc:${i.bloc.type}`))).toEqual([
      'bloc:ECHAUFFEMENT', 'libre:Développé couché barre', 'bloc:SUPERSET', 'bloc:CIRCUIT',
    ])
    expect(d.items.map((i) => (i.kind === 'libre' ? i.exercice.position : i.bloc.position))).toEqual([0, 1, 2, 3])
  })

  it('exercice libre : champs reportés', () => {
    const e = exercicesDe(d).find((x) => x.exerciseNom === 'Développé couché barre')!
    expect(e).toMatchObject({ exerciseId: 'e-dc', nombreSeriesPrevues: 4, repsCibles: '6-8', chargeCible: '62.5 kg', tempsReposSec: 120, repsType: 'REPS' })
  })

  it('défauts alignés sur l\'éditeur', () => {
    const e = exercicesDe(d).find((x) => x.exerciseNom === 'Pompes' && x.nombreSeriesPrevues === 2)!
    expect(e).toMatchObject({ tempsReposSec: 90, repsCibles: '10', progressionActivee: false, isBilateral: false })
    const sup = blocsDe(d).find((b) => b.type === 'SUPERSET')!
    expect(sup).toMatchObject({ nom: 'Dos / abdos', tempsReposInterSec: 10, tempsReposFinRoundSec: 120 })
  })

  it('poids de corps, durée et bilatéral', () => {
    const tractions = exercicesDe(d).find((x) => x.exerciseNom === 'Tractions')!
    expect(tractions).toMatchObject({ isBodyweight: true, chargeCible: 'PDC', typeExercice: 'PDC' })
    const gainage = exercicesDe(d).find((x) => x.exerciseNom === 'Gainage planche')!
    expect(gainage).toMatchObject({ repsType: 'DURATION', repsCibles: '45', isBilateral: true })
  })

  it('circuit : tours propagés aux exercices, tous en durée', () => {
    const circuit = blocsDe(d).find((b) => b.type === 'CIRCUIT')!
    expect(circuit).toMatchObject({ nom: 'Circuit', nombreSeriesPrevues: 4, tempsReposInterSec: 20, tempsReposFinRoundSec: 60 })
    expect(circuit.exercices.map((e) => [e.nombreSeriesPrevues, e.repsType, e.repsCibles])).toEqual([[4, 'DURATION', '30'], [4, 'DURATION', '40']])
  })

  it('muscles de la séance et durée estimée calculées', () => {
    expect(plan.seances[0].dureeMin).toBeGreaterThan(10)
    expect(plan.seances[0]).toMatchObject({ nbBlocs: 4, nbExercices: 6, nbSeries: 2 + 4 + 3 + 3 + 8 })
  })

  it('identifiants déterministes (même fichier, même utilisateur) et propres à chaque utilisateur', () => {
    const encore = planifierImportIA(fichier([seanceBase]), ctx())
    expect(encore.brouillons[0].id).toBe(d.id)
    expect(exercicesDe(encore.brouillons[0]).map((e) => e.id)).toEqual(exercicesDe(d).map((e) => e.id))
    expect(blocsDe(encore.brouillons[0]).map((b) => b.id)).toEqual(blocsDe(d).map((b) => b.id))
    const autre = planifierImportIA(fichier([seanceBase]), ctx({ userId: '22222222-2222-4222-8222-222222222222' }))
    expect(autre.brouillons[0].id).not.toBe(d.id)
    expect(new Set(exercicesDe(d).map((e) => e.id)).size).toBe(exercicesDe(d).length)
  })

  it("l'id ne dépend pas de la casse ni de reps 10 / \"10\"", () => {
    const a = planifierImportIA(fichier([{ nom: 'X', blocs: [{ type: 'LIBRE', exercices: [{ exercice: 'Pompes', series: 3, reps: 10 }] }] }]), ctx())
    const b = planifierImportIA(fichier([{ nom: 'x', blocs: [{ type: 'LIBRE', exercices: [{ exercice: 'POMPES', series: 3, reps: '10' }] }] }]), ctx())
    expect(a.brouillons[0].id).toBe(b.brouillons[0].id)
  })
})

describe('progression', () => {
  const prog = (type: string, p: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    planifierImportIA(fichier([{ nom: 'P', blocs: [{ type, exercices: [{ exercice: 'Squat barre', series: 3, reps: '8-12', ...extra, progression: p }] }] }]), ctx())

  it('double progression : plage tirée de « 8-12 », départ numérique, signalé', () => {
    const plan = prog('LIBRE', { activee: true })
    const e = exercicesDe(plan.brouillons[0])[0]
    expect(e).toMatchObject({ progressionActivee: true, systemeProgression: 'DOUBLE', repsMin: 8, repsMax: 12, repsCibles: '8', incrementKg: 2.5, seuilDeload: 3 })
    expect(plan.seances[0].avertissements.join('\n')).toMatch(/« 8-12 ».*plage 8–12/)
  })

  it('valeurs explicites conservées', () => {
    const e = exercicesDe(prog('SUPERSET', { activee: true, systeme: 'LINEAIRE', incrementKg: 5, seuilDeload: 2 }, { reps: 5 }).brouillons[0])[0]
    expect(e).toMatchObject({ systemeProgression: 'LINEAIRE', incrementKg: 5, seuilDeload: 2, repsCibles: '5' })
  })

  it('ignorée (avertissement) en échauffement et activation', () => {
    const plan = prog('ECHAUFFEMENT', { activee: true })
    expect(exercicesDe(plan.brouillons[0])[0].progressionActivee).toBe(false)
    expect(plan.seances[0].avertissements.join('\n')).toMatch(/progression ignorée/)
  })

  it('désactivée : rien n\'est activé', () => {
    expect(exercicesDe(prog('LIBRE', { activee: false }).brouillons[0])[0].progressionActivee).toBe(false)
  })
})

describe('exercices inconnus', () => {
  const inconnu = (nom: string, extra: Record<string, unknown> = {}) =>
    planifierImportIA(fichier([{ nom: 'S', blocs: [{ type: 'LIBRE', exercices: [{ exercice: nom, series: 3, ...extra }] }] }]), ctx())

  it('créé avec les muscles de l\'IA, is_custom, id déterministe', () => {
    const plan = inconnu('Dips lestés', { muscles: { principal: 'TRICEPS', secondaires: ['PECTORAUX', 'EPAULES'] } })
    expect(plan.exercicesACreer).toHaveLength(1)
    expect(plan.exercicesACreer[0]).toMatchObject({ nom: 'Dips lestés', musclePrimary: 'TRICEPS', muscleGroups: ['TRICEPS', 'PECTORAUX', 'EPAULES'], origineMuscles: 'ia' })
    expect(exercicesDe(plan.brouillons[0])[0].exerciseId).toBe(plan.exercicesACreer[0].id)
    expect(exercicesDe(plan.brouillons[0])[0].muscles).toEqual(['TRICEPS', 'PECTORAUX', 'EPAULES'])
    expect(plan.seances[0].aCreer.map((a) => a.nom)).toEqual(['Dips lestés'])
    expect(plan.seances[0].reconnus).toEqual([])
  })

  it('sans muscles : dérivés du nom, sinon AUTRE', () => {
    expect(inconnu('Biceps curl marteau').exercicesACreer[0]).toMatchObject({ musclePrimary: 'BICEPS', origineMuscles: 'deduits' })
    expect(inconnu('Burpees').exercicesACreer[0]).toMatchObject({ musclePrimary: 'AUTRE', muscleGroups: ['AUTRE'], origineMuscles: 'autre' })
  })

  it('un même exercice inconnu cité deux fois n\'est créé qu\'une fois', () => {
    const plan = planifierImportIA(
      fichier([
        { nom: 'A', blocs: [{ type: 'LIBRE', exercices: [{ exercice: 'Burpees', series: 3 }, { exercice: 'burpees', series: 2 }] }] },
        { nom: 'B', blocs: [{ type: 'LIBRE', exercices: [{ exercice: 'BURPEES', series: 1 }] }] },
      ]),
      ctx(),
    )
    expect(plan.exercicesACreer).toHaveLength(1)
    expect(new Set(plan.brouillons.flatMap((b) => exercicesDe(b).map((e) => e.exerciseId))).size).toBe(1)
  })

  it('nom proche : suggestion en avertissement, jamais de substitution', () => {
    const plan = inconnu('Traction')
    expect(plan.exercicesACreer).toHaveLength(0) // alias : reconnu
    const p2 = inconnu('Tracsions')
    expect(p2.exercicesACreer.map((e) => e.nom)).toEqual(['Tracsions'])
    expect(p2.seances[0].avertissements.join('\n')).toMatch(/« Tracsions » .* « Tractions »/)
    expect(exercicesDe(p2.brouillons[0])[0].exerciseId).not.toBe('e-tr')
  })

  it('alias reconnu : indiqué comme tel', () => {
    const plan = inconnu('Squat (barre)')
    expect(plan.seances[0].reconnus).toEqual([{ nomFichier: 'Squat (barre)', nomCatalogue: 'Squat barre', via: 'alias' }])
    expect(exercicesDe(plan.brouillons[0])[0].exerciseId).toBe('e-sq')
  })
})

describe('idempotence et noms', () => {
  const une = fichier([seanceBase])

  it('séance déjà importée (même contenu) : ignorée, aucun brouillon', () => {
    const premier = planifierImportIA(une, ctx())
    const id = premier.brouillons[0].id
    const plan = planifierImportIA(une, ctx({ seancesExistantes: [{ id, nom: 'Haut du corps' }] }))
    expect(plan.brouillons).toHaveLength(0)
    expect(plan.seances[0]).toMatchObject({ statut: 'deja-presente', nom: 'Haut du corps' })
  })

  it('même nom mais contenu différent : suffixe (2), signalé', () => {
    const autre = fichier([{ ...seanceBase, notes: 'Autre contenu' }])
    const plan = planifierImportIA(autre, ctx({ seancesExistantes: [{ id: 'autre-id', nom: 'haut du CORPS' }] }))
    expect(plan.brouillons[0].nom).toBe('Haut du corps (2)')
    expect(plan.seances[0]).toMatchObject({ renommee: true, nom: 'Haut du corps (2)', nomFichier: 'Haut du corps' })
    expect(plan.seances[0].avertissements.join('\n')).toMatch(/« Haut du corps \(2\) »/)
  })

  it('le suffixe est stable : réimporter donne le même identifiant', () => {
    const autre = fichier([{ ...seanceBase, notes: 'Autre contenu' }])
    const a = planifierImportIA(autre, ctx({ seancesExistantes: [{ id: 'x', nom: 'Haut du corps' }] }))
    const b = planifierImportIA(autre, ctx({ seancesExistantes: [{ id: 'x', nom: 'Haut du corps' }, { id: 'y', nom: 'Haut du corps (2)' }] }))
    expect(b.brouillons[0].nom).toBe('Haut du corps (3)')
    expect(b.brouillons[0].id).toBe(a.brouillons[0].id)
  })

  it('deux séances du fichier de même nom : la seconde reçoit (2) ; doublon exact ignoré', () => {
    const f = fichier([seanceBase, { ...seanceBase, notes: 'v2' }, seanceBase])
    const plan = planifierImportIA(f, ctx())
    expect(plan.brouillons.map((b) => b.nom)).toEqual(['Haut du corps', 'Haut du corps (2)'])
    expect(plan.seances.map((s) => s.statut)).toEqual(['nouvelle', 'nouvelle', 'doublon-fichier'])
  })

  it('exercices à créer : listés une fois même si la séance est déjà présente', () => {
    const f = fichier([{ nom: 'N', blocs: [{ type: 'LIBRE', exercices: [{ exercice: 'Burpees', series: 3 }] }] }])
    const id = planifierImportIA(f, ctx()).brouillons[0].id
    const plan = planifierImportIA(f, ctx({ seancesExistantes: [{ id, nom: 'N' }] }))
    expect(plan.exercicesACreer).toEqual([])
  })
})
