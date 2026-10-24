import { describe, expect, it } from 'vitest'
import {
  ajouterBloc, ajouterExercice, brouillonVide, deplacerBloc, deplacerExercice, deplacerExerciceRelatif,
  groupesMusculaires, modifierBloc, modifierExercice, nouveauBloc, nouvelExercice, renumeroter,
  supprimerBloc, supprimerExercice, validerBrouillon, type ExerciceDraft, type SeanceDraft,
} from './draft'

const CAT = (id: string, muscles: string[] = []) => ({ id, name: `Exo ${id}`, muscles, isBodyweight: false })

// Brouillon A[e1,e2] B[e3] C[] (blocs et exercices dans cet ordre)
function exemple(): SeanceDraft {
  let d = brouillonVide('s1')
  for (const b of ['A', 'B', 'C']) d = ajouterBloc(d, nouveauBloc(b, 'ECHAUFFEMENT'))
  d = ajouterExercice(d, 'A', nouvelExercice('e1', CAT('x1', ['DOS']), 'ECHAUFFEMENT'))
  d = ajouterExercice(d, 'A', nouvelExercice('e2', CAT('x2', ['DOS', 'BICEPS']), 'ECHAUFFEMENT'))
  d = ajouterExercice(d, 'B', nouvelExercice('e3', CAT('x3', ['PECTORAUX']), 'ECHAUFFEMENT'))
  return d
}
const ordre = (d: SeanceDraft) => d.blocs.map((b) => `${b.id}:${b.exercices.map((e) => e.id).join('')}`).join(' ')

describe('draft : construction', () => {
  it('défauts alignés sur Android', () => {
    const d = brouillonVide('s1')
    expect(d).toMatchObject({ id: 's1', nom: '', dureeEstimeeMin: 60, seanceCategory: 'STRENGTH', existante: false, blocs: [] })
    const e = nouvelExercice('e', CAT('x'), 'ECHAUFFEMENT')
    expect(e).toMatchObject({
      nombreSeriesPrevues: 3, tempsReposSec: 90, repsType: 'REPS', incrementDureeSec: 5, seuilDeload: 3,
      typeExercice: null, progressionActivee: false, isBilateral: false,
    })
    expect(nouvelExercice('e', CAT('x'), 'CIRCUIT').repsType).toBe('DURATION')
    expect(nouveauBloc('b', 'SUPERSET')).toMatchObject({ nom: 'Superset', tempsReposInterSec: 20, tempsReposFinRoundSec: 120 })
  })

  it("l'exercice hérite du poids de corps du catalogue", () => {
    expect(nouvelExercice('e', { ...CAT('x'), isBodyweight: true }, 'ECHAUFFEMENT').isBodyweight).toBe(true)
  })
})

describe('draft : déplacement', () => {
  it('déplace dans un bloc', () => {
    expect(ordre(deplacerExercice(exemple(), 'e1', 1))).toBe('A:e2e1 B:e3 C:')
    expect(ordre(deplacerExercice(exemple(), 'e2', 0))).toBe('A:e2e1 B:e3 C:')
  })

  it('déplace vers un autre bloc, y compris vide, à la position demandée', () => {
    expect(ordre(deplacerExercice(exemple(), 'e1', 0, 'B'))).toBe('A:e2 B:e1e3 C:')
    expect(ordre(deplacerExercice(exemple(), 'e1', 1, 'B'))).toBe('A:e2 B:e3e1 C:')
    expect(ordre(deplacerExercice(exemple(), 'e3', 0, 'C'))).toBe('A:e1e2 B: C:e3')
  })

  it('borne les positions hors limites', () => {
    expect(ordre(deplacerExercice(exemple(), 'e1', 99))).toBe('A:e2e1 B:e3 C:')
    expect(ordre(deplacerExercice(exemple(), 'e2', -5))).toBe('A:e2e1 B:e3 C:')
    expect(ordre(deplacerExercice(exemple(), 'e1', 99, 'B'))).toBe('A:e2 B:e3e1 C:')
  })

  it('ignore un exercice ou un bloc inconnu', () => {
    const d = exemple()
    expect(deplacerExercice(d, 'zz', 0)).toBe(d)
    expect(deplacerExercice(d, 'e1', 0, 'zz')).toBe(d)
  })

  it('déplacement relatif : traverse les frontières de blocs', () => {
    expect(ordre(deplacerExerciceRelatif(exemple(), 'e2', 1))).toBe('A:e1 B:e2e3 C:')
    expect(ordre(deplacerExerciceRelatif(exemple(), 'e3', -1))).toBe('A:e1e2e3 B: C:')
    expect(ordre(deplacerExerciceRelatif(exemple(), 'e1', 1))).toBe('A:e2e1 B:e3 C:')
    // Extrémités : rien ne bouge
    expect(ordre(deplacerExerciceRelatif(exemple(), 'e1', -1))).toBe('A:e1e2 B:e3 C:')
    // Descendre depuis B atteint le bloc vide C ; depuis C (dernier bloc) : sans effet
    const dansC = deplacerExerciceRelatif(exemple(), 'e3', 1)
    expect(ordre(dansC)).toBe('A:e1e2 B: C:e3')
    expect(ordre(deplacerExerciceRelatif(dansC, 'e3', 1))).toBe('A:e1e2 B: C:e3')
  })

  it('déplace un bloc (borné)', () => {
    expect(deplacerBloc(exemple(), 'A', 2).blocs.map((b) => b.id)).toEqual(['B', 'C', 'A'])
    expect(deplacerBloc(exemple(), 'C', -3).blocs.map((b) => b.id)).toEqual(['C', 'A', 'B'])
    expect(deplacerBloc(exemple(), 'A', 99).blocs.map((b) => b.id)).toEqual(['B', 'C', 'A'])
  })
})

describe('draft : renumérotation', () => {
  it("renumérote 0..n-1 depuis l'ordre, ignorant les positions périmées", () => {
    let d = exemple()
    d = modifierExercice(d, 'e1', { position: 42 })
    d = modifierExercice(d, 'e2', { position: 42 })
    d = modifierBloc(d, 'A', { position: 9 })
    d = modifierBloc(d, 'C', { position: 9 })
    const r = renumeroter(deplacerExercice(d, 'e1', 1))
    expect(r.blocs.map((b) => b.position)).toEqual([0, 1, 2])
    expect(r.blocs[0].exercices.map((e) => [e.id, e.position])).toEqual([['e2', 0], ['e1', 1]])
    expect(r.blocs[1].exercices.map((e) => e.position)).toEqual([0])
  })

  it('les mutations renvoient des positions cohérentes sans appel explicite', () => {
    const d = supprimerExercice(exemple(), 'e1')
    expect(d.blocs[0].exercices.map((e) => [e.id, e.position])).toEqual([['e2', 0]])
    expect(supprimerBloc(exemple(), 'A').blocs.map((b) => [b.id, b.position])).toEqual([['B', 0], ['C', 1]])
  })
})

describe('draft : immutabilité', () => {
  it('aucune fonction ne modifie son entrée', () => {
    const d = exemple()
    const copie = structuredClone(d)
    deplacerExercice(d, 'e1', 1, 'B')
    deplacerExerciceRelatif(d, 'e2', 1)
    deplacerBloc(d, 'A', 2)
    modifierExercice(d, 'e1', { nombreSeriesPrevues: 9 })
    modifierBloc(d, 'A', { nom: 'Z' })
    supprimerBloc(d, 'A')
    supprimerExercice(d, 'e1')
    ajouterBloc(d, nouveauBloc('N', 'CIRCUIT'))
    ajouterExercice(d, 'C', nouvelExercice('n', CAT('y'), 'CIRCUIT'))
    renumeroter(d)
    expect(d).toEqual(copie)
  })
})

describe('draft : groupes musculaires', () => {
  it("union sans doublon dans l'ordre d'apparition", () => {
    expect(groupesMusculaires(exemple())).toEqual(['DOS', 'BICEPS', 'PECTORAUX'])
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

  it("borne les champs numériques des exercices et nomme l'exercice", () => {
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
      const erreurs = validerBrouillon(modifierExercice(valide(), 'e1', patch))
      expect(erreurs.length, JSON.stringify(patch)).toBe(1)
      expect(erreurs[0], JSON.stringify(patch)).toMatch(motif)
      expect(erreurs[0]).toContain('Exo x1')
    }
  })

  it('refuse les durées de repos de bloc invalides', () => {
    expect(validerBrouillon(modifierBloc(valide(), 'A', { tempsReposInterSec: -1 }))[0]).toMatch(/repos/)
    expect(validerBrouillon(modifierBloc(valide(), 'A', { dureeMin: 0 }))[0]).toMatch(/durée du bloc/i)
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
