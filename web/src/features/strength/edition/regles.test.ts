import { describe, expect, it } from 'vitest'
import { TYPES_BLOC } from '../draft'
import { couleursBloc } from '../execute/navExercices'
import { DESCRIPTIONS_BLOC, ICONES_BLOC, reglesBloc, reglesExercice, textesPas } from './regles'

describe('réglages propres à chaque type de bloc (Android BlocCard)', () => {
  it('repos inter-exercices et fin de tour : superset et circuit seulement ; séries communes : circuit seulement', () => {
    expect(reglesBloc('SUPERSET')).toMatchObject({ reposBloc: true, seriesCommunes: false })
    expect(reglesBloc('CIRCUIT')).toMatchObject({ reposBloc: true, seriesCommunes: true })
    for (const t of ['ECHAUFFEMENT', 'ACTIVATION', 'RECUPERATION'] as const) {
      expect(reglesBloc(t)).toMatchObject({ reposBloc: false, seriesCommunes: false })
    }
  })
})

describe('champs de l’exercice selon son contexte', () => {
  it('exercice libre : séries, repos, type reps/durée, bilatéral, progression', () => {
    expect(reglesExercice(null)).toEqual({ series: true, repos: true, typeRepsVerrouille: false, bilateral: true, progression: true })
  })

  it('échauffement / activation : repos par exercice mais pas de progression ; récupération : progression possible', () => {
    expect(reglesExercice('ECHAUFFEMENT')).toMatchObject({ series: true, repos: true, progression: false })
    expect(reglesExercice('ACTIVATION')).toMatchObject({ repos: true, progression: false })
    expect(reglesExercice('RECUPERATION')).toMatchObject({ repos: true, progression: true })
  })

  it('superset : repos géré par le bloc ; circuit : séries par le bloc, durée verrouillée, pas de bilatéral', () => {
    expect(reglesExercice('SUPERSET')).toMatchObject({ series: true, repos: false, typeRepsVerrouille: false, bilateral: true })
    expect(reglesExercice('CIRCUIT')).toEqual({ series: false, repos: false, typeRepsVerrouille: true, bilateral: false, progression: true })
  })
})

describe('apparence des blocs', () => {
  it('une icône par type, les teintes sont celles de la barre d’exercices (contraste AA déjà vérifié)', () => {
    for (const t of TYPES_BLOC) {
      expect(ICONES_BLOC[t]).toBeTruthy()
      expect(couleursBloc(t).clair).toMatch(/^#[0-9A-F]{6}$/i)
    }
    // Android : Whatshot, SelfImprovement, Bolt, FitnessCenter, SelfImprovement
    expect(ICONES_BLOC.ECHAUFFEMENT).toBe('🔥')
    expect(ICONES_BLOC.SUPERSET).toBe('⚡')
  })
})

describe('aide sur chaque type de bloc', () => {
  it('une phrase courte par type, pour choisir sans deviner', () => {
    for (const t of TYPES_BLOC) expect(DESCRIPTIONS_BLOC[t].length).toBeGreaterThan(15)
  })
})

describe('pas des champs numériques (Android)', () => {
  it('repos entre exercices 5 s, fin de tour 15 s, repos d’un exercice 15 s', () => {
    expect(textesPas).toEqual({ reposInter: 5, reposFinTour: 15, reposExercice: 15 })
  })
})
