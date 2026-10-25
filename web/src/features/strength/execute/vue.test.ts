import { describe, expect, it, vi } from 'vitest'
import { mapBloc, mapExerciceSeance, mapSerie } from '../../../core/db/repos/mappers'
import { construireVue, formaterDuree, libelleDureeAccessible, reposRestant } from './vue'

describe('formats de durée', () => {
  it('mm:ss sous une heure, h:mm:ss au-delà', () => {
    expect(formaterDuree(0)).toBe('00:00')
    expect(formaterDuree(65_400)).toBe('01:05')
    expect(formaterDuree(3_725_000)).toBe('1:02:05')
    expect(formaterDuree(-5)).toBe('00:00')
  })

  it('libellé accessible à la minute', () => {
    expect(libelleDureeAccessible(30_000)).toBe('Temps écoulé : moins d’une minute')
    expect(libelleDureeAccessible(12 * 60_000 + 59_000)).toBe('Temps écoulé : 12 min')
    expect(libelleDureeAccessible(62 * 60_000)).toBe('Temps écoulé : 1 h 2 min')
  })
})

describe('construireVue', () => {
  it('ordonne blocs et exercices par position, regroupe les exercices hors bloc à la fin', () => {
    const blocs = [mapBloc({ id: 'b2', nom: 'Fin', position: 5 }), mapBloc({ id: 'b1', nom: 'Début', position: 1 })]
    const exercices = [
      mapExerciceSeance({ id: 'e3', exercise_id: 'x', bloc_id: null, position: 0 }),
      mapExerciceSeance({ id: 'e2', exercise_id: 'x', bloc_id: 'b1', position: 2 }),
      mapExerciceSeance({ id: 'e1', exercise_id: 'x', bloc_id: 'b1', position: 1 }),
      mapExerciceSeance({ id: 'e4', exercise_id: 'inconnu', bloc_id: 'b2', position: 0 }),
    ]
    const series = [
      mapSerie({ is_completed: 1, id: 's2', exercice_seance_id: 'e1', numero_serie: 2 }),
      mapSerie({ is_completed: 1, id: 's1', exercice_seance_id: 'e1', numero_serie: 1 }),
    ]
    const vue = construireVue(blocs, exercices, series, new Map([['x', 'Squat']]))
    expect(vue.blocs.map((b) => [b.nom, b.exercices.map((e) => e.id)])).toEqual([
      ['Début', ['e1', 'e2']],
      ['Fin', ['e4']],
      ['Exercices', ['e3']],
    ])
    expect(vue.exercices.map((e) => e.id)).toEqual(['e1', 'e2', 'e4', 'e3'])
    expect(vue.exercices[0].series.map((s) => s.id)).toEqual(['s1', 's2'])
    expect(vue.exercices[2].nom).toBe('Exercice inconnu')
  })
})

describe('reposRestant', () => {
  it('part de la série la plus récente et de son exercice', () => {
    const vue = construireVue(
      [],
      [
        mapExerciceSeance({ id: 'a', temps_repos_sec: 60 }),
        mapExerciceSeance({ id: 'b', temps_repos_sec: 120 }),
      ],
      [
        mapSerie({ is_completed: 1, id: '1', exercice_seance_id: 'a', numero_serie: 1, updated_at: '2026-10-24T10:00:00.000Z' }),
        mapSerie({ is_completed: 1, id: '2', exercice_seance_id: 'b', numero_serie: 1, updated_at: '2026-10-24T10:01:00.000Z' }),
      ],
      new Map(),
    )
    const t = Date.parse('2026-10-24T10:01:30.000Z')
    expect(reposRestant(vue.exercices, t)).toBe(90_000)
    expect(reposRestant(vue.exercices, t + 600_000)).toBe(0)
    expect(reposRestant([], t)).toBeNull()
  })

  it("l'ancre est validated_at (instant de validation), pas updated_at réécrit par une correction ou le serveur", () => {
    const vue = construireVue(
      [],
      [mapExerciceSeance({ id: 'a', temps_repos_sec: 60 })],
      [
        mapSerie({ is_completed: 1,
          id: '1', exercice_seance_id: 'a', numero_serie: 1,
          validated_at: '2026-10-24T10:00:00.000Z', updated_at: '2026-10-24 10:00:40+00',
        }),
      ],
      new Map(),
    )
    expect(reposRestant(vue.exercices, Date.parse('2026-10-24T10:00:50.000Z'))).toBe(10_000)
  })

  it('série sans validated_at (antérieure à la migration 0006) : repli sur updated_at', () => {
    const vue = construireVue(
      [],
      [mapExerciceSeance({ id: 'a', temps_repos_sec: 60 })],
      [mapSerie({ is_completed: 1, id: '1', exercice_seance_id: 'a', numero_serie: 1, validated_at: null, updated_at: '2026-10-24T10:00:00.000Z' })],
      new Map(),
    )
    expect(reposRestant(vue.exercices, Date.parse('2026-10-24T10:00:50.000Z'))).toBe(10_000)
  })

  it('formats mélangés (série synchronisée « 2026-10-24 10:02:00+00 » et série locale ISO) : la plus récente gagne', () => {
    const vue = construireVue(
      [],
      [mapExerciceSeance({ id: 'a', temps_repos_sec: 60 }), mapExerciceSeance({ id: 'b', temps_repos_sec: 120 })],
      [
        mapSerie({ is_completed: 1, id: '1', exercice_seance_id: 'a', numero_serie: 1, updated_at: '2026-10-24 10:02:00+00' }),
        mapSerie({ is_completed: 1, id: '2', exercice_seance_id: 'b', numero_serie: 1, updated_at: '2026-10-24T10:01:00.000Z' }),
      ],
      new Map(),
    )
    const t = Date.parse('2026-10-24T10:02:30.000Z')
    // Safari / iOS : Date.parse du format Postgres renvoie NaN
    const safari = vi.spyOn(Date, 'parse').mockReturnValue(Number.NaN)
    try {
      expect(reposRestant(vue.exercices, t)).toBe(30_000)
    } finally {
      safari.mockRestore()
    }
  })
})

describe('reposRestant : superset (repos après le DERNIER exercice du groupe)', () => {
  const T = Date.parse('2026-10-24T10:00:00.000Z')
  const a = (sec: number) => new Date(T + sec * 1000).toISOString()

  // Exercice du bloc b1 ; `groupe` null = hors superset
  const exo = (id: string, position: number, groupe: string | null, extra: Record<string, unknown> = {}) =>
    mapExerciceSeance({
      id, exercise_id: id, bloc_id: 'b1', position, superset_groupe: groupe, temps_repos_sec: 60, nombre_series_prevues: 3, ...extra,
    })
  const serie = (id: string, exercice: string, numero: number, valideeSec: number) =>
    mapSerie({ is_completed: 1, id, exercice_seance_id: exercice, numero_serie: numero, validated_at: a(valideeSec), updated_at: a(valideeSec) })
  const vueDe = (exercices: ReturnType<typeof exo>[], series: ReturnType<typeof serie>[]) =>
    construireVue([mapBloc({ id: 'b1', nom: 'Bloc', position: 0 })], exercices, series, new Map()).exercices

  it('A1 validée : pas de repos (on enchaîne avec B)', () => {
    const v = vueDe([exo('A', 0, 'X'), exo('B', 1, 'X', { temps_repos_sec: 120 })], [serie('1', 'A', 1, 0)])
    expect(reposRestant(v, T + 10_000)).toBeNull()
  })

  it('A1 puis B1 validées : repos depuis B1 avec le temps de repos de B (dernier exercice)', () => {
    const v = vueDe([exo('A', 0, 'X'), exo('B', 1, 'X', { temps_repos_sec: 120 })], [serie('1', 'A', 1, 0), serie('2', 'B', 1, 30)])
    expect(reposRestant(v, T + 40_000)).toBe(110_000)
  })

  it('tour suivant : A2 validée après le repos → pas de repos ; B2 → repos', () => {
    const exos = [exo('A', 0, 'X'), exo('B', 1, 'X', { temps_repos_sec: 120 })]
    const v1 = vueDe(exos, [serie('1', 'A', 1, 0), serie('2', 'B', 1, 30), serie('3', 'A', 2, 200)])
    expect(reposRestant(v1, T + 210_000)).toBeNull()
    const v2 = vueDe(exos, [serie('1', 'A', 1, 0), serie('2', 'B', 1, 30), serie('3', 'A', 2, 200), serie('4', 'B', 2, 230)])
    expect(reposRestant(v2, T + 240_000)).toBe(110_000)
  })

  it('trois exercices : repos seulement après C (ordre position, pas ordre des lignes)', () => {
    const exos = [exo('C', 2, 'X', { temps_repos_sec: 90 }), exo('A', 0, 'X'), exo('B', 1, 'X')]
    expect(reposRestant(vueDe(exos, [serie('1', 'A', 1, 0), serie('2', 'B', 1, 20)]), T + 25_000)).toBeNull()
    expect(reposRestant(vueDe(exos, [serie('1', 'A', 1, 0), serie('2', 'B', 1, 20), serie('3', 'C', 1, 40)]), T + 50_000)).toBe(80_000)
  })

  it('séries inégales : B (2 séries) est fini, A3 validée → plus rien à enchaîner, repos depuis A3', () => {
    const exos = [exo('A', 0, 'X', { nombre_series_prevues: 3 }), exo('B', 1, 'X', { nombre_series_prevues: 2, temps_repos_sec: 120 })]
    const series = [
      serie('1', 'A', 1, 0), serie('2', 'B', 1, 30), serie('3', 'A', 2, 200), serie('4', 'B', 2, 230), serie('5', 'A', 3, 400),
    ]
    expect(reposRestant(vueDe(exos, series), T + 410_000)).toBe(50_000)
  })

  it('B déjà saisie pour ce tour (ordre inversé) : A1 validée ensuite déclenche le repos', () => {
    const v = vueDe([exo('A', 0, 'X'), exo('B', 1, 'X')], [serie('1', 'B', 1, 0), serie('2', 'A', 1, 30)])
    expect(reposRestant(v, T + 40_000)).toBe(50_000)
  })

  it('groupe à un seul exercice : comportement normal (repos après chaque série)', () => {
    const v = vueDe([exo('A', 0, 'X'), exo('B', 1, null)], [serie('1', 'A', 1, 0)])
    expect(reposRestant(v, T + 10_000)).toBe(50_000)
  })

  it('groupes différents dans le même bloc : chacun son enchaînement', () => {
    const exos = [exo('A', 0, 'X'), exo('B', 1, 'X'), exo('C', 2, 'Y'), exo('D', 3, 'Y', { temps_repos_sec: 30 })]
    // C1 (groupe Y, non final) : pas de repos même si le groupe X est complet pour ce tour
    expect(reposRestant(vueDe(exos, [serie('1', 'A', 1, 0), serie('2', 'B', 1, 10), serie('3', 'C', 1, 100)]), T + 110_000)).toBeNull()
    const complet = [serie('1', 'A', 1, 0), serie('2', 'B', 1, 10), serie('3', 'C', 1, 100), serie('4', 'D', 1, 120)]
    expect(reposRestant(vueDe(exos, complet), T + 130_000)).toBe(20_000)
  })

  it('même lettre de superset dans deux blocs différents : groupes distincts', () => {
    const exercices = [
      mapExerciceSeance({ id: 'A', bloc_id: 'b1', position: 0, superset_groupe: 'X', temps_repos_sec: 60 }),
      mapExerciceSeance({ id: 'B', bloc_id: 'b2', position: 0, superset_groupe: 'X', temps_repos_sec: 60 }),
    ]
    const v = construireVue(
      [mapBloc({ id: 'b1', nom: 'Un', position: 0 }), mapBloc({ id: 'b2', nom: 'Deux', position: 1 })],
      exercices,
      [serie('1', 'A', 1, 0)],
      new Map(),
    ).exercices
    expect(reposRestant(v, T + 10_000)).toBe(50_000)
  })

  it("hors superset : inchangé (repos de l'exercice de la dernière série)", () => {
    const v = vueDe([exo('A', 0, null), exo('B', 1, null, { temps_repos_sec: 120 })], [serie('1', 'A', 1, 0)])
    expect(reposRestant(v, T + 10_000)).toBe(50_000)
  })

  it("série corrigée après coup : l'ancre reste validated_at (corriger A1 ne relance rien)", () => {
    const exos = [exo('A', 0, 'X'), exo('B', 1, 'X', { temps_repos_sec: 120 })]
    const corrigee = mapSerie({ is_completed: 1, id: '1', exercice_seance_id: 'A', numero_serie: 1, validated_at: a(0), updated_at: a(100) })
    const v = vueDe(exos, [corrigee, serie('2', 'B', 1, 30)])
    expect(reposRestant(v, T + 110_000)).toBe(40_000)
  })
})

describe('construireVue : enchaînement du superset', () => {
  it('indique le suivant du groupe sur les exercices non finaux, rien sur le dernier ni hors superset', () => {
    const v = construireVue(
      [mapBloc({ id: 'b1', nom: 'Bloc', position: 0 })],
      [
        mapExerciceSeance({ id: 'b', exercise_id: 'xb', bloc_id: 'b1', position: 1, superset_groupe: 'X' }),
        mapExerciceSeance({ id: 'a', exercise_id: 'xa', bloc_id: 'b1', position: 0, superset_groupe: 'X' }),
        mapExerciceSeance({ id: 'c', exercise_id: 'xc', bloc_id: 'b1', position: 2, superset_groupe: null }),
        mapExerciceSeance({ id: 'd', exercise_id: 'xd', bloc_id: 'b1', position: 3, superset_groupe: 'Y' }),
      ],
      [],
      new Map([['xa', 'Squat'], ['xb', 'Tractions'], ['xc', 'Gainage'], ['xd', 'Fentes']]),
    )
    expect(v.exercices.map((e) => [e.id, e.enchaineAvec])).toEqual([['a', 'Tractions'], ['b', null], ['c', null], ['d', null]])
  })
})

describe('construireVue : informations de la barre d’exercices', () => {
  it('type du bloc, bilatéral et groupes musculaires du catalogue', () => {
    const v = construireVue(
      [mapBloc({ id: 'b', nom: 'Bloc', position: 0, type: 'SUPERSET' })],
      [
        mapExerciceSeance({ id: 'e1', exercise_id: 'x', bloc_id: 'b', position: 0, is_bilateral: 1 }),
        mapExerciceSeance({ id: 'e2', exercise_id: 'y', bloc_id: null, position: 0 }),
      ],
      [],
      new Map(),
      new Map([['x', ['DOS', 'BICEPS']]]),
    )
    expect(v.blocs.map((b) => b.type)).toEqual(['SUPERSET', null])
    expect(v.exercices.map((e) => [e.blocType, e.isBilateral, e.muscles])).toEqual([
      ['SUPERSET', true, ['DOS', 'BICEPS']],
      [null, false, []],
    ])
  })
})
