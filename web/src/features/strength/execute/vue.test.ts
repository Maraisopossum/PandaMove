import { describe, expect, it } from 'vitest'
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
      mapSerie({ id: 's2', exercice_seance_id: 'e1', numero_serie: 2 }),
      mapSerie({ id: 's1', exercice_seance_id: 'e1', numero_serie: 1 }),
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
        mapSerie({ id: '1', exercice_seance_id: 'a', numero_serie: 1, updated_at: '2026-10-24T10:00:00.000Z' }),
        mapSerie({ id: '2', exercice_seance_id: 'b', numero_serie: 1, updated_at: '2026-10-24T10:01:00.000Z' }),
      ],
      new Map(),
    )
    const t = Date.parse('2026-10-24T10:01:30.000Z')
    expect(reposRestant(vue.exercices, t)).toBe(90_000)
    expect(reposRestant(vue.exercices, t + 600_000)).toBe(0)
    expect(reposRestant([], t)).toBeNull()
  })
})
