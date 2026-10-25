import { describe, expect, it } from 'vitest'
import { mapBloc, mapExerciceSeance, mapSerie } from '../../../core/db/repos/mappers'
import {
  construireLignes, mesuresLigne, nombreLignes, numeroCourant, premierNombre, rpeApplicable, texteHistorique, texteRepos, valeursLigne,
} from './lignesSeries'
import { construireVue } from './vue'

function exercice(extra: Record<string, unknown> = {}, series: ReturnType<typeof mapSerie>[] = []) {
  const b = mapBloc({ id: 'b', nom: 'Bloc', position: 0, type: 'AUTRE' })
  const e = mapExerciceSeance({
    id: 'e', exercise_id: 'x', bloc_id: 'b', position: 0, nombre_series_prevues: 3, reps_cibles: '8-10', charge_cible: '60 kg',
    temps_repos_sec: 90, progression_activee: 0, ...extra,
  })
  return construireVue([b], [e], series, new Map([['x', 'Squat']])).exercices[0]
}
const serie = (numero: number, extra: Record<string, unknown> = {}) =>
  mapSerie({ id: `s${numero}`, exercice_seance_id: 'e', numero_serie: numero, reps_realisees: 8, charge_kg: 62.5, is_completed: 1, ...extra })

describe('premierNombre', () => {
  it('entier, plage, durée, décimale, texte sans nombre', () => {
    expect([premierNombre('8'), premierNombre('8-10'), premierNombre('45s'), premierNombre('17,5 kg'), premierNombre('PDC')]).toEqual([
      8, 8, 45, 17.5, null,
    ])
  })
})

describe('rpeApplicable', () => {
  it('ni échauffement / activation / récupération, ni durée', () => {
    expect(rpeApplicable('AUTRE', 'REPS')).toBe(true)
    expect(rpeApplicable('SUPERSET', 'REPS')).toBe(true)
    expect(rpeApplicable(null, 'REPS')).toBe(true)
    expect(rpeApplicable('ECHAUFFEMENT', 'REPS')).toBe(false)
    expect(rpeApplicable('ACTIVATION', 'REPS')).toBe(false)
    expect(rpeApplicable('RECUPERATION', 'REPS')).toBe(false)
    expect(rpeApplicable('AUTRE', 'DURATION')).toBe(false)
  })
})

describe('construireLignes', () => {
  it('une ligne par série prévue, pré-remplie avec le prévu (reps min de la plage, charge cible, repos)', () => {
    const l = construireLignes(exercice())
    expect(l.map((x) => x.numero)).toEqual([1, 2, 3])
    expect(l[0]).toMatchObject({ libelle: '1', terminee: false, serieId: null, reps: 8, chargeKg: 60, preRemplie: true, reposSec: 90, rpe: null })
  })

  it('une série validée reprend ses valeurs réelles (non grisées) ; la charge se propage aux suivantes', () => {
    const l = construireLignes(exercice({}, [serie(1, { reps_realisees: 9, charge_kg: 62.5 })]))
    expect(l[0]).toMatchObject({ terminee: true, serieId: 's1', reps: 9, chargeKg: 62.5, preRemplie: false })
    expect(l[1]).toMatchObject({ terminee: false, reps: 8, chargeKg: 62.5, preRemplie: true })
  })

  it('série laissée non validée (Android) : ses valeurs, non grisées, non terminée', () => {
    const l = construireLignes(exercice({}, [serie(2, { is_completed: 0, reps_realisees: 7 })]))
    expect(l[1]).toMatchObject({ terminee: false, serieId: 's2', reps: 7, preRemplie: false })
  })

  it("historique de la dernière séance, sauf progression activée où la cible prime", () => {
    const histo = [{ numero: 1, reps: 12, chargeKg: 50 }]
    expect(construireLignes(exercice(), histo)[0]).toMatchObject({ reps: 12, chargeKg: 50, preRemplie: true })
    expect(construireLignes(exercice({ progression_activee: 1 }), histo)[0]).toMatchObject({ reps: 8, chargeKg: 60 })
  })

  it('durée : cible en secondes', () => {
    const l = construireLignes(exercice({ reps_type: 'DURATION', reps_cibles: '45s', charge_cible: 'PDC' }))
    expect(l[0]).toMatchObject({ reps: 45, chargeKg: null })
  })

  it('séries enregistrées au-delà du prévu : lignes en plus', () => {
    const e = exercice({ nombre_series_prevues: 1 }, [serie(1), serie(2), serie(3)])
    expect(nombreLignes(e)).toBe(3)
    expect(construireLignes(e).map((x) => x.terminee)).toEqual([true, true, true])
  })

  it('bilatéral : deux lignes par série, côtés G puis D, libellés « 1G », « 1D », « 2G »…', () => {
    const l = construireLignes(exercice({ is_bilateral: 1, nombre_series_prevues: 2 }))
    expect(l.map((x) => [x.numero, x.libelle, x.cote])).toEqual([[1, '1G', 'G'], [2, '1D', 'D'], [3, '2G', 'G'], [4, '2D', 'D']])
  })

  it('repos affiché en superset : fin de round pour le dernier exercice du bloc, inter-exercices sinon', () => {
    const b = mapBloc({ id: 'b', nom: 'S', position: 0, type: 'SUPERSET', temps_repos_inter_sec: 15, temps_repos_fin_round_sec: 120 })
    const es = [
      mapExerciceSeance({ id: 'a', exercise_id: 'x', bloc_id: 'b', position: 0, temps_repos_sec: 60 }),
      mapExerciceSeance({ id: 'c', exercise_id: 'x', bloc_id: 'b', position: 1, temps_repos_sec: 60 }),
    ]
    const v = construireVue([b], es, [], new Map())
    expect(construireLignes(v.exercices[0])[0].reposSec).toBe(15)
    expect(construireLignes(v.exercices[1])[0].reposSec).toBe(120)
  })
})

describe('ligne courante, valeurs et mesures', () => {
  const lignes = construireLignes(exercice({}, [serie(1)]))

  it('courante : première non validée', () => {
    expect(numeroCourant(lignes)).toBe(2)
    expect(numeroCourant(construireLignes(exercice({ nombre_series_prevues: 1 }, [serie(1)])))).toBeNull()
  })
  it('la saisie prime sur le prévu ; un champ vide donne NaN', () => {
    expect(valeursLigne(lignes[1], { reps: 10 })).toMatchObject({ reps: 10, repsSaisies: true, chargeSaisie: false })
    expect(mesuresLigne(lignes[1], undefined)).toEqual({ reps: 8, chargeKg: 62.5, rpe: null })
    expect(mesuresLigne(lignes[1], { reps: null, rpe: 7 })).toEqual({ reps: Number.NaN, chargeKg: 62.5, rpe: 7 })
  })
  it('texte du repos', () => {
    expect([texteRepos(90), texteRepos(0)]).toEqual(['90s', ''])
  })
})

describe('texteHistorique', () => {
  it('date courte, reps et charge ; durée en secondes ; poids du corps sans charge', () => {
    expect(texteHistorique({ dateIso: '2026-10-04', maxChargeKg: 62.5, reps: 8, enSecondes: false })).toBe('4 oct. — 8 reps @ 62,5 kg')
    expect(texteHistorique({ dateIso: '2026-12-24', maxChargeKg: 0, reps: 45, enSecondes: true })).toBe('24 déc. — 45 s')
  })
})
