import { describe, expect, it } from 'vitest'
import { mapBloc, mapExerciceSeance, mapSerie } from '../../../../core/db/repos/mappers'
import { construireVue, type BlocVue, type ExerciceVue } from '../vue'
import { construirePlan, lancementPour, recapCircuit, secondesCible } from './plan'

interface Exo {
  id: string
  bloc?: string
  cibles?: string
  type?: 'DURATION' | 'REPS'
  series?: number
  bilateral?: boolean
}
interface Bl {
  id: string
  type: string
  inter?: number
  fin?: number
}

// `faites` : « id#numero » des séries validées (numéros de ligne)
function vue(blocs: Bl[], exos: Exo[], faites: string[] = []): { blocs: BlocVue[]; exercices: ExerciceVue[] } {
  const bs = blocs.map((b, i) => mapBloc({ id: b.id, nom: b.id, position: i, type: b.type, temps_repos_inter_sec: b.inter ?? 20, temps_repos_fin_round_sec: b.fin ?? 120 }))
  const es = exos.map((e, i) =>
    mapExerciceSeance({
      id: e.id, exercise_id: e.id, bloc_id: e.bloc ?? null, position: i, nombre_series_prevues: e.series ?? 3,
      reps_cibles: e.cibles ?? '45', reps_type: e.type ?? 'DURATION', is_bilateral: e.bilateral ? 1 : 0, temps_repos_sec: 60,
    }),
  )
  const ss = faites.map((f) => {
    const [ex, n] = f.split('#')
    return mapSerie({ id: f, exercice_seance_id: ex, numero_serie: Number(n), reps_realisees: 40, is_completed: 1 })
  })
  return construireVue(bs, es, ss, new Map(exos.map((e) => [e.id, 'Nom ' + e.id])))
}

describe('secondesCible', () => {
  it('lit un nombre de secondes entier, avec ou sans « s »', () => {
    expect(secondesCible('45')).toBe(45)
    expect(secondesCible(' 60 ')).toBe(60)
    expect(secondesCible('45s')).toBe(45)
    expect(secondesCible('45 s')).toBe(45)
  })
  it('refuse tout ce qui n’est pas une durée numérique', () => {
    for (const t of ['', 'PDC', '8-10', '1,5', '-3', '45 reps']) expect(secondesCible(t)).toBeNull()
  })
})

describe('lancementPour', () => {
  it('circuit avec au moins un exercice en durée numérique : bouton « circuit »', () => {
    const v = vue([{ id: 'b', type: 'CIRCUIT' }], [{ id: 'a', bloc: 'b' }, { id: 'c', bloc: 'b' }])
    const l = lancementPour(v.blocs[0], v.exercices[0])
    expect(l).toMatchObject({ type: 'circuit', blocId: 'b', reprise: false })
  })
  it('circuit sans exercice éligible : rien', () => {
    const v = vue([{ id: 'b', type: 'CIRCUIT' }], [{ id: 'a', bloc: 'b', cibles: 'PDC' }, { id: 'c', bloc: 'b', type: 'REPS', cibles: '10' }])
    expect(lancementPour(v.blocs[0], v.exercices[0])).toBeNull()
  })
  it('circuit déjà terminé : rien ; circuit entamé : reprise', () => {
    const exos = [{ id: 'a', bloc: 'b', series: 1 }, { id: 'c', bloc: 'b', series: 1 }]
    const fini = vue([{ id: 'b', type: 'CIRCUIT' }], exos, ['a#1', 'c#1'])
    expect(lancementPour(fini.blocs[0], fini.exercices[0])).toBeNull()
    const entame = vue([{ id: 'b', type: 'CIRCUIT' }], exos, ['a#1'])
    expect(lancementPour(entame.blocs[0], entame.exercices[0])).toMatchObject({ type: 'circuit', reprise: true })
  })
  it('exercice en durée hors circuit : minuteur seul', () => {
    const libre = vue([], [{ id: 'a' }])
    expect(lancementPour(libre.blocs[0], libre.exercices[0])).toEqual({ type: 'seul', exerciceId: 'a' })
    const superset = vue([{ id: 'b', type: 'SUPERSET' }], [{ id: 'a', bloc: 'b' }])
    expect(lancementPour(superset.blocs[0], superset.exercices[0])).toMatchObject({ type: 'seul' })
  })
  it('répétitions ou cible non numérique : pas de minuteur', () => {
    const reps = vue([], [{ id: 'a', type: 'REPS', cibles: '10' }])
    expect(lancementPour(reps.blocs[0], reps.exercices[0])).toBeNull()
    const libre = vue([], [{ id: 'a', cibles: 'max' }])
    expect(lancementPour(libre.blocs[0], libre.exercices[0])).toBeNull()
  })
  it('sans exercice actif : rien', () => {
    expect(lancementPour(null, null)).toBeNull()
  })
})

describe('recapCircuit', () => {
  it('résume tours, exercices, repos et durée estimée', () => {
    const v = vue([{ id: 'b', type: 'CIRCUIT', inter: 20, fin: 120 }], [
      { id: 'a', bloc: 'b', series: 3, cibles: '45' }, { id: 'c', bloc: 'b', series: 3, cibles: '45' },
      { id: 'd', bloc: 'b', series: 3, cibles: '45' }, { id: 'e', bloc: 'b', series: 3, cibles: '45' },
    ])
    // 3 tours x 4 x 45 s = 540 s ; repos inter : 3 x 3 x 20 = 180 s ; fin de tour : 2 x 120 = 240 s ; total 960 s = 16 min
    expect(recapCircuit(v.exercices)).toBe('3 tours · 4 exercices · repos 20 s entre exercices, 120 s en fin de tour · environ 16 min')
  })
  it('singulier, repos nuls et tours inégaux', () => {
    const v = vue([{ id: 'b', type: 'CIRCUIT', inter: 0, fin: 0 }], [{ id: 'a', bloc: 'b', series: 1, cibles: '30' }])
    expect(recapCircuit(v.exercices)).toBe('1 tour · 1 exercice · sans repos · environ 1 min')
    const inegal = vue([{ id: 'b', type: 'CIRCUIT', inter: 10, fin: 0 }], [
      { id: 'a', bloc: 'b', series: 3 }, { id: 'c', bloc: 'b', series: 2 },
    ])
    expect(recapCircuit(inegal.exercices)).toContain('2 à 3 tours · 2 exercices')
  })
})

describe('construirePlan', () => {
  const histo = new Map()
  it('circuit : un exercice du plan par exercice éligible, repos du bloc, lignes faites marquées', () => {
    const v = vue([{ id: 'b', type: 'CIRCUIT', inter: 15, fin: 90 }], [
      { id: 'a', bloc: 'b', series: 2 }, { id: 'x', bloc: 'b', cibles: 'PDC' }, { id: 'c', bloc: 'b', series: 2, cibles: '30s' },
    ], ['a#1'])
    const r = construirePlan({ type: 'circuit', blocId: 'b' }, v.blocs[0].exercices, histo, {})
    if ('erreur' in r) throw new Error(r.erreur)
    expect(r.plan.mode).toBe('circuit')
    expect(r.plan.reposInterSec).toBe(15)
    expect(r.plan.reposFinTourSec).toBe(90)
    expect(r.plan.exercices.map((e) => e.id)).toEqual(['a', 'c'])
    expect(r.plan.exercices[0].lignes.map((l) => [l.numero, l.faite, l.secondes])).toEqual([[1, true, 40], [2, false, 45]])
    expect(r.plan.exercices[1].lignes.map((l) => [l.numero, l.faite, l.secondes])).toEqual([[1, false, 30], [2, false, 30]])
    expect(r.plan.exercices[1].toursPrevus).toBe(2)
  })
  it('durée : brouillon saisi > valeur préremplie (historique) > cible', () => {
    const v = vue([{ id: 'b', type: 'CIRCUIT' }], [{ id: 'a', bloc: 'b', series: 2 }])
    const h = new Map([['a', [{ numero: 1, reps: 38, chargeKg: null }]]])
    const r = construirePlan({ type: 'circuit', blocId: 'b' }, v.exercices, h, { 'a#2': { reps: 50 } })
    if ('erreur' in r) throw new Error(r.erreur)
    expect(r.plan.exercices[0].lignes.map((l) => l.secondes)).toEqual([38, 50])
  })
  it('durée invalide (≤ 0, vide) : message d’erreur, pas de plan', () => {
    const v = vue([{ id: 'b', type: 'CIRCUIT' }], [{ id: 'a', bloc: 'b', series: 1 }])
    for (const reps of [0, -5, Number.NaN, null]) {
      const r = construirePlan({ type: 'circuit', blocId: 'b' }, v.exercices, histo, { 'a#1': { reps } })
      expect(r).toEqual({ erreur: 'Durée invalide pour « Nom a » (série 1) : saisissez un nombre de secondes supérieur à 0.' })
    }
  })
  it('minuteur seul : la première série à faire, avec sa durée', () => {
    const v = vue([], [{ id: 'a', series: 3 }], ['a#1'])
    const r = construirePlan({ type: 'seul', exerciceId: 'a' }, v.exercices, histo, { 'a#2': { reps: 20 } })
    if ('erreur' in r) throw new Error(r.erreur)
    expect(r.plan.mode).toBe('seul')
    expect(r.plan.exercices).toHaveLength(1)
    expect(r.plan.exercices[0].lignes.filter((l) => !l.faite).map((l) => [l.numero, l.secondes])).toEqual([[2, 20]])
  })
  it('minuteur seul : durée invalide ou plus aucune série', () => {
    const v = vue([], [{ id: 'a', series: 1 }])
    expect(construirePlan({ type: 'seul', exerciceId: 'a' }, v.exercices, histo, { 'a#1': { reps: 0 } })).toEqual({
      erreur: 'Durée invalide : saisissez un nombre de secondes supérieur à 0.',
    })
    const fini = vue([], [{ id: 'a', series: 1 }], ['a#1'])
    expect(construirePlan({ type: 'seul', exerciceId: 'a' }, fini.exercices, histo, {})).toEqual({
      erreur: 'Toutes les séries de cet exercice sont déjà validées.',
    })
  })
  it('bilatéral : lignes G puis D', () => {
    const v = vue([], [{ id: 'a', series: 2, bilateral: true }])
    const r = construirePlan({ type: 'seul', exerciceId: 'a' }, v.exercices, histo, {})
    if ('erreur' in r) throw new Error(r.erreur)
    expect(r.plan.exercices[0].lignes.filter((l) => !l.faite).map((l) => [l.numero, l.cote])).toEqual([[1, 'G']])
    const c = vue([{ id: 'b', type: 'CIRCUIT' }], [{ id: 'a', bloc: 'b', series: 2, bilateral: true }])
    const rc = construirePlan({ type: 'circuit', blocId: 'b' }, c.exercices, histo, {})
    if ('erreur' in rc) throw new Error(rc.erreur)
    expect(rc.plan.exercices[0].lignes.map((l) => [l.numero, l.cote])).toEqual([[1, 'G'], [2, 'D'], [3, 'G'], [4, 'D']])
  })
})
