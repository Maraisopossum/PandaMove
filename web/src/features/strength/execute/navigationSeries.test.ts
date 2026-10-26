import { describe, expect, it } from 'vitest'
import { mapBloc, mapExerciceSeance, mapSerie } from '../../../core/db/repos/mappers'
import { apresSerie, exerciceComplet, exerciceValide } from './navigationSeries'
import { construireVue } from './vue'

interface Exo { id: string; bloc?: string; series?: number; repos?: number; bilateral?: boolean }
interface Blocs { id: string; type: string; inter?: number; fin?: number }

// `faites` : « id#numero » des séries validées (numéros de ligne ; côté G sur impair en bilatéral)
function vue(blocs: Blocs[], exos: Exo[], faites: string[]) {
  const bs = blocs.map((b, i) => mapBloc({ id: b.id, nom: b.id, position: i, type: b.type, temps_repos_inter_sec: b.inter ?? 10, temps_repos_fin_round_sec: b.fin ?? 100 }))
  const es = exos.map((e, i) =>
    mapExerciceSeance({
      id: e.id, exercise_id: 'x', bloc_id: e.bloc ?? null, position: i, nombre_series_prevues: e.series ?? 3, temps_repos_sec: e.repos ?? 60,
      is_bilateral: e.bilateral ? 1 : 0,
    }),
  )
  const ss = faites.map((f) => {
    const [ex, n] = f.split('#')
    const bilateral = exos.find((e) => e.id === ex)?.bilateral
    return mapSerie({ id: f, exercice_seance_id: ex, numero_serie: Number(n), is_completed: 1, notes: bilateral ? (Number(n) % 2 === 1 ? 'G' : 'D') : '' })
  })
  return construireVue(bs, es, ss, new Map()).exercices
}

describe('apresSerie : exercice libre', () => {
  const exos: Exo[] = [{ id: 'a', series: 2, repos: 45 }, { id: 'b', series: 1, repos: 30 }]
  it('série non finale : repos de l’exercice, pas de navigation', () => {
    expect(apresSerie(vue([], exos, ['a#1']), 'a')).toEqual({ activerId: null, reposSec: 45 })
  })
  it('exercice complet : exercice suivant puis repos de l’exercice', () => {
    expect(apresSerie(vue([], exos, ['a#1', 'a#2']), 'a')).toEqual({ activerId: 'b', reposSec: 45 })
  })
  it('dernier exercice : rien', () => {
    expect(apresSerie(vue([], exos, ['b#1']), 'b')).toEqual({ activerId: null, reposSec: 0 })
  })
  it('repos saisi à la main prioritaire', () => {
    expect(apresSerie(vue([], exos, ['a#1']), 'a', 20).reposSec).toBe(20)
  })
  it('exercice inconnu : rien', () => {
    expect(apresSerie(vue([], exos, []), 'zzz')).toEqual({ activerId: null, reposSec: 0 })
  })
})

describe('apresSerie : bloc non alternant', () => {
  const blocs = [{ id: 'e', type: 'ECHAUFFEMENT' }, { id: 'f', type: 'AUTRE' }]
  const exos: Exo[] = [{ id: 'a', bloc: 'e', series: 2, repos: 40 }, { id: 'b', bloc: 'e', series: 1, repos: 30 }, { id: 'c', bloc: 'f', series: 1 }]
  it('exercice non complet : repos de l’exercice, sans navigation', () => {
    expect(apresSerie(vue(blocs, exos, ['a#1']), 'a')).toEqual({ activerId: null, reposSec: 40 })
  })
  it('exercice complet : exercice suivant du bloc, repos de l’exercice', () => {
    expect(apresSerie(vue(blocs, exos, ['a#1', 'a#2']), 'a')).toEqual({ activerId: 'b', reposSec: 40 })
  })
  it('dernier exercice du bloc terminé : premier exercice du bloc suivant (même si des séries ont été ignorées)', () => {
    expect(apresSerie(vue(blocs, exos, ['b#1']), 'b')).toEqual({ activerId: 'c', reposSec: 30 })
  })
  it('dernier bloc de la séance : ni navigation ni repos', () => {
    expect(apresSerie(vue(blocs, exos, ['c#1']), 'c')).toEqual({ activerId: null, reposSec: 0 })
  })
})

describe('apresSerie : superset 2 exercices × 3 tours', () => {
  const blocs = [{ id: 's', type: 'SUPERSET', inter: 10, fin: 90 }, { id: 'z', type: 'AUTRE' }]
  const exos: Exo[] = [{ id: 'a', bloc: 's' }, { id: 'b', bloc: 's' }, { id: 'c', bloc: 'z', series: 1 }]

  it('après A : on passe à B avec le repos inter-exercices', () => {
    expect(apresSerie(vue(blocs, exos, ['a#1']), 'a')).toEqual({ activerId: 'b', reposSec: 10 })
  })
  it('après B (dernier) avec des tours restants : retour à A, repos de fin de tour', () => {
    expect(apresSerie(vue(blocs, exos, ['a#1', 'b#1']), 'b')).toEqual({ activerId: 'a', reposSec: 90 })
  })
  it('tout le bloc complet : bloc suivant, repos de fin de tour', () => {
    const tout = ['a#1', 'a#2', 'a#3', 'b#1', 'b#2', 'b#3']
    expect(apresSerie(vue(blocs, exos, tout), 'b')).toEqual({ activerId: 'c', reposSec: 90 })
  })
  it('séquence complète A1 B1 A2 B2 A3 B3', () => {
    const suite: [string, string[]][] = [['a', ['a#1']], ['b', ['a#1', 'b#1']], ['a', ['a#1', 'b#1', 'a#2']], ['b', ['a#1', 'b#1', 'a#2', 'b#2']], ['a', ['a#1', 'b#1', 'a#2', 'b#2', 'a#3']]]
    expect(suite.map(([id, f]) => apresSerie(vue(blocs, exos, f), id).activerId)).toEqual(['b', 'a', 'b', 'a', 'b'])
  })
  it('repos de 0 s : transmis tel quel (aucun repos lancé par l’appelant)', () => {
    expect(apresSerie(vue([{ id: 's', type: 'SUPERSET', inter: 0, fin: 0 }], [{ id: 'a', bloc: 's' }, { id: 'b', bloc: 's' }], ['a#1']), 'a')).toEqual({ activerId: 'b', reposSec: 0 })
  })
})

describe('apresSerie : nombres de séries différents dans un superset', () => {
  const blocs = [{ id: 's', type: 'SUPERSET', inter: 10, fin: 90 }]
  const exos: Exo[] = [{ id: 'a', bloc: 's', series: 3 }, { id: 'b', bloc: 's', series: 1 }]
  it('B déjà à son quota : A enchaîne avec A (tour de A seul) et fin de tour', () => {
    const f = ['a#1', 'b#1']
    expect(apresSerie(vue(blocs, exos, [...f, 'a#2']), 'a')).toEqual({ activerId: 'a', reposSec: 90 })
  })
  it('A complet, B restant : B', () => {
    const exos2: Exo[] = [{ id: 'a', bloc: 's', series: 1 }, { id: 'b', bloc: 's', series: 2 }]
    expect(apresSerie(vue(blocs, exos2, ['a#1', 'b#1']), 'b')).toEqual({ activerId: 'b', reposSec: 90 })
  })
})

describe('apresSerie : circuit', () => {
  const blocs = [{ id: 'k', type: 'CIRCUIT', inter: 5, fin: 60 }]
  const exos: Exo[] = [{ id: 'a', bloc: 'k', series: 2 }, { id: 'b', bloc: 'k', series: 2 }, { id: 'c', bloc: 'k', series: 2 }]
  it('exercice suivant avec repos inter, puis retour au premier en fin de tour', () => {
    expect(apresSerie(vue(blocs, exos, ['a#1']), 'a')).toEqual({ activerId: 'b', reposSec: 5 })
    expect(apresSerie(vue(blocs, exos, ['a#1', 'b#1']), 'b')).toEqual({ activerId: 'c', reposSec: 5 })
    expect(apresSerie(vue(blocs, exos, ['a#1', 'b#1', 'c#1']), 'c')).toEqual({ activerId: 'a', reposSec: 60 })
  })
  it('dernier tour terminé en fin de séance : rien', () => {
    const tout = ['a#1', 'a#2', 'b#1', 'b#2', 'c#1', 'c#2']
    expect(apresSerie(vue(blocs, exos, tout), 'c')).toEqual({ activerId: null, reposSec: 0 })
  })
})

describe('apresSerie : bilatéral', () => {
  const blocs = [{ id: 's', type: 'SUPERSET', inter: 10, fin: 90 }]
  it('dans un superset : pas de navigation après G, navigation après D', () => {
    const exos: Exo[] = [{ id: 'a', bloc: 's', series: 2, bilateral: true }, { id: 'b', bloc: 's', series: 2 }]
    expect(apresSerie(vue(blocs, exos, ['a#1']), 'a')).toEqual({ activerId: null, reposSec: 0 })
    expect(apresSerie(vue(blocs, exos, ['a#1', 'a#2']), 'a')).toEqual({ activerId: 'b', reposSec: 10 })
  })
  it('exercice libre : pas de repos entre G et D, repos après D', () => {
    const exos: Exo[] = [{ id: 'a', series: 2, bilateral: true, repos: 45 }]
    expect(apresSerie(vue([], exos, ['a#1']), 'a')).toEqual({ activerId: null, reposSec: 0 })
    expect(apresSerie(vue([], exos, ['a#1', 'a#2']), 'a')).toEqual({ activerId: null, reposSec: 45 })
  })
  it('un exercice bilatéral est complet à 2 lignes par série prévue', () => {
    const e = vue([], [{ id: 'a', series: 2, bilateral: true }], ['a#1', 'a#2', 'a#3'])[0]
    expect(exerciceComplet(e)).toBe(false)
    expect(exerciceComplet(vue([], [{ id: 'a', series: 2, bilateral: true }], ['a#1', 'a#2', 'a#3', 'a#4'])[0])).toBe(true)
  })
})

describe('exerciceValide', () => {
  const exos: Exo[] = [{ id: 'a' }, { id: 'b' }]
  it("repère l'exercice dont le nombre de séries validées a augmenté", () => {
    expect(exerciceValide(vue([], exos, ['a#1']), vue([], exos, ['a#1', 'b#1']))).toBe('b')
  })
  it('rien sans nouvelle validation (dé-validation, premier chargement)', () => {
    expect(exerciceValide(vue([], exos, ['a#1']), vue([], exos, []))).toBeNull()
    expect(exerciceValide([], vue([], exos, ['a#1']))).toBeNull()
  })
})
