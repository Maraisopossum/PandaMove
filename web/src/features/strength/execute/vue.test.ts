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

describe('reposRestant : superset et circuit (règle de navigateToNext Android)', () => {
  const T = Date.parse('2026-10-24T10:00:00.000Z')
  const a = (sec: number) => new Date(T + sec * 1000).toISOString()

  const exo = (id: string, position: number, extra: Record<string, unknown> = {}) =>
    mapExerciceSeance({ id, exercise_id: id, bloc_id: 'b1', position, temps_repos_sec: 60, nombre_series_prevues: 3, ...extra })
  const serie = (id: string, exercice: string, numero: number, valideeSec: number) =>
    mapSerie({ is_completed: 1, id, exercice_seance_id: exercice, numero_serie: numero, validated_at: a(valideeSec), updated_at: a(valideeSec) })
  const vueDe = (exercices: ReturnType<typeof exo>[], series: ReturnType<typeof serie>[], type = 'SUPERSET') =>
    construireVue(
      [mapBloc({ id: 'b1', nom: 'Bloc', position: 0, type, temps_repos_inter_sec: 15, temps_repos_fin_round_sec: 100 })],
      exercices,
      series,
      new Map(),
    ).exercices

  it('A1 validée : repos inter-exercices du bloc (15 s), pas le repos de l’exercice', () => {
    const v = vueDe([exo('A', 0), exo('B', 1, { temps_repos_sec: 120 })], [serie('1', 'A', 1, 0)])
    expect(reposRestant(v, T + 10_000)).toBe(5_000)
  })

  it('A1 puis B1 validées : repos de fin de tour du bloc (100 s) depuis B1', () => {
    const v = vueDe([exo('A', 0), exo('B', 1, { temps_repos_sec: 120 })], [serie('1', 'A', 1, 0), serie('2', 'B', 1, 30)])
    expect(reposRestant(v, T + 40_000)).toBe(90_000)
  })

  it('tour suivant : A2 → repos inter, B2 → repos de fin de tour', () => {
    const exos = [exo('A', 0), exo('B', 1)]
    const v1 = vueDe(exos, [serie('1', 'A', 1, 0), serie('2', 'B', 1, 30), serie('3', 'A', 2, 200)])
    expect(reposRestant(v1, T + 205_000)).toBe(10_000)
    const v2 = vueDe(exos, [serie('1', 'A', 1, 0), serie('2', 'B', 1, 30), serie('3', 'A', 2, 200), serie('4', 'B', 2, 230)])
    expect(reposRestant(v2, T + 240_000)).toBe(90_000)
  })

  it('circuit : même règle que le superset', () => {
    const v = vueDe([exo('A', 0), exo('B', 1), exo('C', 2)], [serie('1', 'A', 1, 0), serie('2', 'B', 1, 5)], 'CIRCUIT')
    expect(reposRestant(v, T + 10_000)).toBe(10_000)
  })

  it('séries inégales : B terminé, A3 validée → repos de fin de tour (retour sur A, bloc non complet… ici complet)', () => {
    const exos = [exo('A', 0, { nombre_series_prevues: 3 }), exo('B', 1, { nombre_series_prevues: 2 })]
    const series = [serie('1', 'A', 1, 0), serie('2', 'B', 1, 30), serie('3', 'A', 2, 200), serie('4', 'B', 2, 230), serie('5', 'A', 3, 400)]
    // Dernier bloc de la séance, tout complet : aucun repos ni navigation
    expect(reposRestant(vueDe(exos, series), T + 410_000)).toBeNull()
  })

  it('bloc suivi d’un autre exercice : repos de fin de tour avant de passer à la suite', () => {
    const exos = [exo('A', 0, { nombre_series_prevues: 1 }), exo('B', 1, { nombre_series_prevues: 1 }), exo('L', 2, { bloc_id: null })]
    expect(reposRestant(vueDe(exos, [serie('1', 'A', 1, 0), serie('2', 'B', 1, 10)]), T + 20_000)).toBe(90_000)
  })

  it('repos de 0 s : aucun repos', () => {
    const v = construireVue(
      [mapBloc({ id: 'b1', nom: 'Bloc', position: 0, type: 'SUPERSET', temps_repos_inter_sec: 0, temps_repos_fin_round_sec: 0 })],
      [exo('A', 0), exo('B', 1)],
      [serie('1', 'A', 1, 0)],
      new Map(),
    ).exercices
    expect(reposRestant(v, T + 10_000)).toBeNull()
  })

  it('bloc non alternant (échauffement) : repos de l’exercice', () => {
    const v = vueDe([exo('A', 0), exo('B', 1, { temps_repos_sec: 120 })], [serie('1', 'A', 1, 0)], 'ECHAUFFEMENT')
    expect(reposRestant(v, T + 10_000)).toBe(50_000)
  })

  it('bilatéral : pas de repos après le côté G', () => {
    const v = vueDe([exo('A', 0, { is_bilateral: 1 }), exo('B', 1)], [mapSerie({ is_completed: 1, id: 'g', exercice_seance_id: 'A', numero_serie: 1, notes: 'G', validated_at: a(0), updated_at: a(0) })])
    expect(reposRestant(v, T + 10_000)).toBeNull()
  })

  it("hors bloc : repos de l'exercice de la dernière série", () => {
    const v = vueDe([exo('A', 0, { bloc_id: null }), exo('B', 1, { bloc_id: null, temps_repos_sec: 120 })], [serie('1', 'A', 1, 0)])
    expect(reposRestant(v, T + 10_000)).toBe(50_000)
  })

  it("série corrigée après coup : l'ancre reste validated_at (corriger A1 ne relance rien)", () => {
    const exos = [exo('A', 0), exo('B', 1)]
    const corrigee = mapSerie({ is_completed: 1, id: '1', exercice_seance_id: 'A', numero_serie: 1, validated_at: a(0), updated_at: a(100) })
    const v = vueDe(exos, [corrigee, serie('2', 'B', 1, 30)])
    expect(reposRestant(v, T + 110_000)).toBe(20_000)
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
