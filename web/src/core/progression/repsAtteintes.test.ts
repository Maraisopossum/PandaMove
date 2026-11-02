import { describe, expect, it } from 'vitest'
import { evaluerExercice, type CibleExercice, type ExerciceConfig } from './engine'
import { lireProgression, REGLE_PROGRESSION, serialiserProgression } from './marqueur'

// Double progression sur les répétitions réellement atteintes (plage 6 à 10) : la prochaine cible part de la plus petite
// série réalisée, la charge soulevée plus lourde que prévu est reprise, le RPE n'intervient plus, le côté faible décide.

const config = {
  repsType: 'REPS', systemeProgression: 'DOUBLE', repsMin: 6, repsMax: 10, incrementKg: 2.5, incrementDureeSec: 5,
  seuilDeload: 3, typeExercice: null, incrementPct: null, isBodyweight: false, nombreSeriesPrevues: 3,
} as ExerciceConfig
const cible: CibleExercice = { chargeKg: 20, reps: 6, dureeSec: null }
const serie = (repsRealisees: number, chargeKg: number | null = 20, extra: Record<string, unknown> = {}) => ({
  repsRealisees, chargeKg, rpe: null, notes: '', ...extra,
})
const evaluer = (series: ReturnType<typeof serie>[], surcharges: Partial<ExerciceConfig> = {}, c = cible, bilateral = false) =>
  evaluerExercice({ ...config, ...surcharges }, c, 0, series, bilateral)

describe('répétitions atteintes (plage 6 à 10, cible 6)', () => {
  it('8, 8, 8 donnent 9 (et non 7)', () => {
    expect(evaluer([serie(8), serie(8), serie(8)])).toMatchObject({ statut: 'SUCCES', nouvelleChargeCible: 20, nouveauRepsCible: 9 })
  })

  it('la plus petite série décide : 8, 9, 10 donnent 9', () => {
    expect(evaluer([serie(8), serie(9), serie(10)]).nouveauRepsCible).toBe(9)
  })

  it('9 atteintes donnent le haut de plage, jamais plus', () => {
    expect(evaluer([serie(9), serie(9), serie(9)]).nouveauRepsCible).toBe(10)
  })

  it('toutes les séries au haut de plage : la charge monte et les répétitions repartent au minimum', () => {
    expect(evaluer([serie(10), serie(10), serie(10)])).toMatchObject({ nouvelleChargeCible: 22.5, nouveauRepsCible: 6 })
  })

  it('cible atteinte pile : +1 comme avant', () => {
    expect(evaluer([serie(6), serie(6), serie(6)]).nouveauRepsCible).toBe(7)
  })

  it('le RPE n’intervient plus : RPE 10 donne le même résultat qu’un RPE absent', () => {
    const rpeEleve = [serie(8, 20, { rpe: 10 }), serie(8, 20, { rpe: 10 }), serie(8, 20, { rpe: 10 })]
    expect(evaluer(rpeEleve)).toMatchObject({ statut: 'SUCCES', nouveauRepsCible: 9 })
  })
})

describe('charge soulevée plus lourde que la cible', () => {
  it('8 répétitions à 25 kg sur une cible de 6 à 20 kg : la suite part de 25 kg', () => {
    expect(evaluer([serie(8, 25), serie(8, 25), serie(8, 25)])).toMatchObject({ nouvelleChargeCible: 25, nouveauRepsCible: 9 })
  })

  it('la plus petite charge soulevée décide quand les séries diffèrent', () => {
    expect(evaluer([serie(8, 25), serie(8, 22.5), serie(8, 25)]).nouvelleChargeCible).toBe(22.5)
  })

  it('au haut de plage avec une charge plus lourde, l’incrément s’applique à la charge soulevée', () => {
    expect(evaluer([serie(10, 25), serie(10, 25), serie(10, 25)])).toMatchObject({ nouvelleChargeCible: 27.5, nouveauRepsCible: 6 })
  })
})

describe('cas limites', () => {
  it('bilatéral : le côté le plus faible décide (G 10, D 8 : 9, pas de montée de charge)', () => {
    const series = [serie(10, 20, { notes: 'G' }), serie(10, 20, { notes: 'G' }), serie(8, 20, { notes: 'D' }), serie(8, 20, { notes: 'D' })]
    expect(evaluer(series, {}, cible, true)).toMatchObject({ nouvelleChargeCible: 20, nouveauRepsCible: 9 })
  })

  it('plage absente : comportement inchangé (cible + 1)', () => {
    expect(evaluer([serie(8), serie(8), serie(8)], { repsMin: null, repsMax: null }).nouveauRepsCible).toBe(7)
  })

  it('exercice en durée : règle inchangée (la valeur atteinte est en secondes)', () => {
    const duree = evaluer([serie(45, null), serie(45, null), serie(45, null)], { repsType: 'DURATION', systemeProgression: 'DOUBLE' }, {
      chargeKg: null, reps: 30, dureeSec: 30,
    })
    expect(duree.nouveauRepsCible).not.toBe(46)
  })

  it('poids de corps (charge nulle) : 8, 8, 8 donnent 9 sans charge', () => {
    const p = evaluer([serie(8, null), serie(8, null), serie(8, null)], { isBodyweight: true }, { chargeKg: null, reps: 6, dureeSec: null })
    expect(p).toMatchObject({ nouvelleChargeCible: null, nouveauRepsCible: 9 })
  })
})

describe('version de la règle dans le marqueur', () => {
  const base = {
    cible: { chargeKg: 20, reps: 6, dureeSec: null }, avant: null,
    ecrit: { chargeCible: 20, repsCible: 9, dureeCibleSec: null, compteurEchec: 0, nombreSeriesCible: null, derniereMaj: '2026-11-02' },
    proposition: { statut: 'SUCCES', chargeCible: 20, repsCible: 9, dureeCibleSec: null, compteurEchec: 0, nombreSeries: null, deload: false },
    seriesAvant: null, seriesApres: null,
  }

  it('la version est conservée à la lecture ; une base sans version reste sans version', () => {
    const json = serialiserProgression({ evaluee: true, decisions: { e1: 'acceptee', e2: 'acceptee' }, bases: { e1: { ...base, regle: REGLE_PROGRESSION }, e2: base } })
    const etat = lireProgression(json)
    expect(etat?.bases?.e1.regle).toBe(REGLE_PROGRESSION)
    expect(etat?.bases?.e2.regle).toBeUndefined()
  })
})
