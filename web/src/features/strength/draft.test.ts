import { describe, expect, it } from 'vitest'
import {
  ajouterBloc, ajouterExercice, appliquerSeriesCircuit, blocsDe, brouillonVide, changerTypeBloc, deplacerRelatif,
  dupliquerExercice, exercicesDe, groupesMusculaires, modifierBloc, modifierExercice, nouveauBloc, nouvelExercice,
  peutDeplacer, renumeroter, supprimerBloc, supprimerExercice, transformerExercice, validerBrouillon, type ExerciceDraft, type SeanceDraft,
} from './draft'

const CAT = (id: string, muscles: string[] = []) => ({ id, name: `Exo ${id}`, muscles, equipment: [], isBodyweight: false })

// Liste unifiée : e0 (libre), A[e1,e2], e4 (libre), B[e3]
function exemple(): SeanceDraft {
  let d = brouillonVide('s1')
  d = ajouterExercice(d, null, nouvelExercice('e0', CAT('x0', ['QUADRICEPS']), null))
  d = ajouterBloc(d, nouveauBloc('A', 'ECHAUFFEMENT'))
  d = ajouterExercice(d, 'A', nouvelExercice('e1', CAT('x1', ['DOS']), 'ECHAUFFEMENT'))
  d = ajouterExercice(d, 'A', nouvelExercice('e2', CAT('x2', ['DOS', 'BICEPS']), 'ECHAUFFEMENT'))
  d = ajouterExercice(d, null, nouvelExercice('e4', CAT('x4', ['MOLLETS']), null))
  d = ajouterBloc(d, nouveauBloc('B', 'SUPERSET'))
  d = ajouterExercice(d, 'B', nouvelExercice('e3', CAT('x3', ['PECTORAUX']), 'SUPERSET'))
  return d
}
// « e0 A:e1e2 e4 B:e3 »
const ordre = (d: SeanceDraft) =>
  d.items.map((i) => (i.kind === 'libre' ? i.exercice.id : `${i.bloc.id}:${i.bloc.exercices.map((e) => e.id).join('')}`)).join(' ')

describe('draft : construction', () => {
  it('défauts alignés sur Android', () => {
    const d = brouillonVide('s1')
    expect(d).toMatchObject({ id: 's1', nom: '', dureeEstimeeMin: 60, seanceCategory: 'STRENGTH', existante: false, items: [] })
    const e = nouvelExercice('e', CAT('x'), 'ECHAUFFEMENT')
    expect(e).toMatchObject({
      nombreSeriesPrevues: 3, tempsReposSec: 90, repsType: 'REPS', incrementDureeSec: 5, seuilDeload: 3,
      typeExercice: null, progressionActivee: false, isBilateral: false,
    })
    expect(nouvelExercice('e', CAT('x'), 'CIRCUIT').repsType).toBe('DURATION')
    expect(nouvelExercice('e', CAT('x'), null).repsType).toBe('REPS')
    expect(nouveauBloc('b', 'SUPERSET')).toMatchObject({ nom: 'Superset', tempsReposInterSec: 20, tempsReposFinRoundSec: 120, nombreSeriesPrevues: 3 })
  })

  it("l'exercice hérite du poids de corps et de l'équipement du catalogue", () => {
    const e = nouvelExercice('e', { ...CAT('x'), isBodyweight: true, equipment: ['Haltères'] }, null)
    expect(e.isBodyweight).toBe(true)
    expect(e.equipementCatalogue).toEqual(['Haltères'])
  })

  it('blocsDe et exercicesDe suivent l’ordre d’affichage', () => {
    const d = exemple()
    expect(blocsDe(d).map((b) => b.id)).toEqual(['A', 'B'])
    expect(exercicesDe(d).map((e) => e.id)).toEqual(['e0', 'e1', 'e2', 'e4', 'e3'])
  })
})

describe('draft : ajout et suppression', () => {
  it('ajoute un exercice libre à la fin, un exercice de bloc à la fin du bloc', () => {
    expect(ordre(exemple())).toBe('e0 A:e1e2 e4 B:e3')
    const d = ajouterExercice(exemple(), 'A', nouvelExercice('n', CAT('y'), 'ECHAUFFEMENT'))
    expect(ordre(d)).toBe('e0 A:e1e2n e4 B:e3')
    expect(ordre(ajouterExercice(exemple(), null, nouvelExercice('n', CAT('y'), null)))).toBe('e0 A:e1e2 e4 B:e3 n')
  })

  it('un bloc inconnu ne reçoit rien', () => {
    const d = exemple()
    expect(ajouterExercice(d, 'zz', nouvelExercice('n', CAT('y'), null))).toBe(d)
  })

  it('supprime un exercice libre, un exercice de bloc ou un bloc entier', () => {
    expect(ordre(supprimerExercice(exemple(), 'e0'))).toBe('A:e1e2 e4 B:e3')
    expect(ordre(supprimerExercice(exemple(), 'e2'))).toBe('e0 A:e1 e4 B:e3')
    expect(ordre(supprimerBloc(exemple(), 'A'))).toBe('e0 e4 B:e3')
  })
})

describe('draft : déplacement (liste unifiée)', () => {
  it('monte et descend un bloc ou un exercice libre parmi tous les items', () => {
    expect(ordre(deplacerRelatif(exemple(), 'A', 1))).toBe('e0 e4 A:e1e2 B:e3')
    expect(ordre(deplacerRelatif(exemple(), 'A', -1))).toBe('A:e1e2 e0 e4 B:e3')
    expect(ordre(deplacerRelatif(exemple(), 'e4', 1))).toBe('e0 A:e1e2 B:e3 e4')
    expect(ordre(deplacerRelatif(exemple(), 'e4', -1))).toBe('e0 e4 A:e1e2 B:e3')
  })

  it('un exercice de bloc ne change que dans son bloc', () => {
    expect(ordre(deplacerRelatif(exemple(), 'e1', 1))).toBe('e0 A:e2e1 e4 B:e3')
    expect(ordre(deplacerRelatif(exemple(), 'e2', -1))).toBe('e0 A:e2e1 e4 B:e3')
  })

  it('aux extrémités, rien ne bouge', () => {
    const d = exemple()
    expect(deplacerRelatif(d, 'e0', -1)).toBe(d)
    expect(deplacerRelatif(d, 'B', 1)).toBe(d)
    expect(deplacerRelatif(d, 'e1', -1)).toBe(d)
    expect(deplacerRelatif(d, 'e2', 1)).toBe(d)
    expect(deplacerRelatif(d, 'inconnu', 1)).toBe(d)
  })

  it('peutDeplacer reflète les extrémités', () => {
    const d = exemple()
    expect(peutDeplacer(d, 'e0', -1)).toBe(false)
    expect(peutDeplacer(d, 'e0', 1)).toBe(true)
    expect(peutDeplacer(d, 'B', 1)).toBe(false)
    expect(peutDeplacer(d, 'e1', -1)).toBe(false)
    expect(peutDeplacer(d, 'e1', 1)).toBe(true)
    expect(peutDeplacer(d, 'zz', 1)).toBe(false)
  })
})

describe('draft : duplication', () => {
  it('insère la copie juste après l’original (libre ou dans un bloc) avec un nouvel id', () => {
    const libre = dupliquerExercice(exemple(), 'e4', 'copie')
    expect(ordre(libre)).toBe('e0 A:e1e2 e4 copie B:e3')
    const dansBloc = dupliquerExercice(exemple(), 'e1', 'copie')
    expect(ordre(dansBloc)).toBe('e0 A:e1copiee2 e4 B:e3')
    const copie = exercicesDe(dansBloc).find((e) => e.id === 'copie')!
    expect(copie).toMatchObject({ exerciseId: 'x1', exerciseNom: 'Exo x1' })
  })

  it('exercice inconnu : sans effet', () => {
    const d = exemple()
    expect(dupliquerExercice(d, 'zz', 'c')).toBe(d)
  })
})

describe('draft : transformation d’un exercice', () => {
  it('applique une fonction à l’exercice voulu (libre ou en bloc), sans toucher aux autres', () => {
    const f = (e: ExerciceDraft) => ({ ...e, nombreSeriesPrevues: e.nombreSeriesPrevues + 10 })
    expect(exercicesDe(transformerExercice(exemple(), 'e1', f)).map((e) => e.nombreSeriesPrevues)).toEqual([3, 13, 3, 3, 3])
    expect(exercicesDe(transformerExercice(exemple(), 'e0', f)).map((e) => e.nombreSeriesPrevues)).toEqual([13, 3, 3, 3, 3])
  })

  it('exercice inconnu : sans effet', () => {
    const d = exemple()
    expect(transformerExercice(d, 'zz', (e) => ({ ...e, nombreSeriesPrevues: 9 })).items).toEqual(d.items)
  })
})

describe('draft : changement de type de bloc', () => {
  it('renomme le bloc quand son nom était celui de l’ancien type, le conserve sinon', () => {
    expect(blocsDe(changerTypeBloc(exemple(), 'B', 'CIRCUIT'))[1]).toMatchObject({ type: 'CIRCUIT', nom: 'Circuit' })
    const perso = modifierBloc(exemple(), 'B', { nom: 'Mon finisher' })
    expect(blocsDe(changerTypeBloc(perso, 'B', 'CIRCUIT'))[1]).toMatchObject({ type: 'CIRCUIT', nom: 'Mon finisher' })
    const vide = modifierBloc(exemple(), 'B', { nom: '  ' })
    expect(blocsDe(changerTypeBloc(vide, 'B', 'RECUPERATION'))[1].nom).toBe('Récupération')
  })

  it('vers un circuit : exercices en durée ; séries communes reprises du premier exercice', () => {
    let d = modifierExercice(exemple(), 'e3', { nombreSeriesPrevues: 4 })
    d = changerTypeBloc(d, 'B', 'CIRCUIT')
    expect(exercicesDe(d).find((e) => e.id === 'e3')!.repsType).toBe('DURATION')
    expect(blocsDe(d)[1].nombreSeriesPrevues).toBe(4)
  })

  it('vers échauffement ou activation : la surcharge progressive est désactivée sur ses exercices', () => {
    let d = modifierExercice(exemple(), 'e3', { progressionActivee: true, systemeProgression: 'DOUBLE' })
    d = changerTypeBloc(d, 'B', 'ACTIVATION')
    expect(exercicesDe(d).find((e) => e.id === 'e3')!.progressionActivee).toBe(false)
    d = modifierExercice(d, 'e3', { progressionActivee: true })
    expect(exercicesDe(changerTypeBloc(d, 'B', 'SUPERSET')).find((e) => e.id === 'e3')!.progressionActivee).toBe(true)
  })

  it('même type ou bloc inconnu : sans effet', () => {
    const d = exemple()
    expect(changerTypeBloc(d, 'B', 'SUPERSET')).toBe(d)
    expect(changerTypeBloc(d, 'zz', 'CIRCUIT')).toBe(d)
  })
})

describe('draft : séries communes du circuit', () => {
  it('propage le nombre de séries du bloc aux exercices et force la durée', () => {
    let d = changerTypeBloc(exemple(), 'B', 'CIRCUIT')
    d = ajouterExercice(d, 'B', nouvelExercice('e5', CAT('x5'), 'CIRCUIT'))
    d = modifierBloc(d, 'B', { nombreSeriesPrevues: 5 })
    d = modifierExercice(d, 'e5', { repsType: 'REPS' })
    const r = appliquerSeriesCircuit(d)
    expect(exercicesDe(r).filter((e) => ['e3', 'e5'].includes(e.id)).map((e) => [e.nombreSeriesPrevues, e.repsType])).toEqual([[5, 'DURATION'], [5, 'DURATION']])
    // Les autres blocs ne sont pas touchés
    expect(exercicesDe(r).find((e) => e.id === 'e1')!.nombreSeriesPrevues).toBe(3)
  })
})

describe('draft : renumérotation', () => {
  it("renumérote 0..n-1 depuis l'ordre unifié, ignorant les positions périmées", () => {
    let d = exemple()
    d = modifierExercice(d, 'e1', { position: 42 })
    d = modifierExercice(d, 'e0', { position: 42 })
    d = modifierBloc(d, 'A', { position: 9 })
    const r = renumeroter(deplacerRelatif(d, 'A', 1))
    // e0=0, e4=1, A=2, B=3 : libres et blocs entrelacés sur la même échelle
    expect(r.items.map((i) => (i.kind === 'libre' ? [i.exercice.id, i.exercice.position] : [i.bloc.id, i.bloc.position]))).toEqual([
      ['e0', 0], ['e4', 1], ['A', 2], ['B', 3],
    ])
    expect(blocsDe(r)[0].exercices.map((e) => [e.id, e.position])).toEqual([['e1', 0], ['e2', 1]])
  })
})

describe('draft : immutabilité', () => {
  it('aucune fonction ne modifie son entrée', () => {
    const d = exemple()
    const copie = structuredClone(d)
    deplacerRelatif(d, 'e1', 1)
    deplacerRelatif(d, 'A', 1)
    modifierExercice(d, 'e1', { nombreSeriesPrevues: 9 })
    modifierBloc(d, 'A', { nom: 'Z' })
    changerTypeBloc(d, 'A', 'CIRCUIT')
    dupliquerExercice(d, 'e1', 'c')
    appliquerSeriesCircuit(changerTypeBloc(d, 'A', 'CIRCUIT'))
    supprimerBloc(d, 'A')
    supprimerExercice(d, 'e1')
    ajouterBloc(d, nouveauBloc('N', 'CIRCUIT'))
    ajouterExercice(d, 'B', nouvelExercice('n', CAT('y'), 'CIRCUIT'))
    renumeroter(d)
    expect(d).toEqual(copie)
  })
})

describe('draft : groupes musculaires', () => {
  it("union sans doublon dans l'ordre d'apparition (libres et blocs)", () => {
    expect(groupesMusculaires(exemple())).toEqual(['QUADRICEPS', 'DOS', 'BICEPS', 'MOLLETS', 'PECTORAUX'])
  })
})

describe('draft : validation', () => {
  const valide = () => ({ ...exemple(), nom: 'Push' })

  it('un brouillon correct, même vide, ne donne aucune erreur', () => {
    expect(validerBrouillon(valide())).toEqual([])
    expect(validerBrouillon({ ...brouillonVide('s'), nom: 'Vide' })).toEqual([])
  })

  it('refuse un nom vide ou blanc', () => {
    expect(validerBrouillon({ ...valide(), nom: '   ' })).toContain('Le nom de la séance est obligatoire.')
  })

  it('borne la durée estimée', () => {
    expect(validerBrouillon({ ...valide(), dureeEstimeeMin: 0 })[0]).toMatch(/durée estimée/i)
    expect(validerBrouillon({ ...valide(), dureeEstimeeMin: 601 })[0]).toMatch(/durée estimée/i)
    expect(validerBrouillon({ ...valide(), dureeEstimeeMin: 12.5 })[0]).toMatch(/durée estimée/i)
    expect(validerBrouillon({ ...valide(), dureeEstimeeMin: Number.NaN })[0]).toMatch(/durée estimée/i)
  })

  it("borne les champs numériques des exercices (libres ou en bloc) et nomme l'exercice", () => {
    const cas: [Partial<ExerciceDraft>, RegExp][] = [
      [{ nombreSeriesPrevues: 0 }, /séries/],
      [{ nombreSeriesPrevues: 21 }, /séries/],
      [{ tempsReposSec: -1 }, /repos/],
      [{ tempsReposSec: 3601 }, /repos/],
      [{ repsMin: 0 }, /répétitions minimales/],
      [{ repsMin: 12, repsMax: 8 }, /minimum.*maximum/],
      [{ incrementKg: -2 }, /incrément en kg/],
      [{ incrementKg: 501 }, /incrément en kg/],
      [{ incrementPct: 101 }, /pourcentage/],
      [{ seuilDeload: 0 }, /deload/],
      [{ incrementDureeSec: 0 }, /incrément de durée/],
    ]
    for (const [patch, motif] of cas) {
      for (const [id, nom] of [['e1', 'Exo x1'], ['e0', 'Exo x0']] as const) {
        const erreurs = validerBrouillon(modifierExercice(valide(), id, patch))
        expect(erreurs.length, JSON.stringify(patch)).toBe(1)
        expect(erreurs[0], JSON.stringify(patch)).toMatch(motif)
        expect(erreurs[0]).toContain(nom)
      }
    }
  })

  it('refuse les durées de repos de bloc invalides et un nombre de séries de circuit hors bornes', () => {
    expect(validerBrouillon(modifierBloc(valide(), 'A', { tempsReposInterSec: -1 }))[0]).toMatch(/repos/)
    expect(validerBrouillon(modifierBloc(valide(), 'A', { dureeMin: 0 }))[0]).toMatch(/durée du bloc/i)
    const circuit = changerTypeBloc(valide(), 'B', 'CIRCUIT')
    const c = modifierExercice(modifierBloc(circuit, 'B', { nombreSeriesPrevues: 0 }), 'e3', { repsCibles: '30' })
    expect(validerBrouillon(c)[0]).toMatch(/séries du circuit/)
  })

  it('circuit : durée obligatoire (comme Android)', () => {
    let d = { ...brouillonVide('s'), nom: 'C' }
    d = ajouterBloc(d, nouveauBloc('K', 'CIRCUIT'))
    d = ajouterExercice(d, 'K', nouvelExercice('c1', CAT('x1'), 'CIRCUIT'))
    expect(validerBrouillon(d)[0]).toMatch(/Durée manquante pour : Exo x1/)
    expect(validerBrouillon(modifierExercice(d, 'c1', { repsCibles: '40' }))).toEqual([])
  })

  it('accumule plusieurs erreurs', () => {
    const d = modifierExercice({ ...valide(), nom: '' }, 'e1', { nombreSeriesPrevues: 0 })
    expect(validerBrouillon(d)).toHaveLength(2)
  })
})
