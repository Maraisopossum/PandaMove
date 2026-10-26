import { describe, expect, it } from 'vitest'
import { mapExerciceSeance, mapSerie } from '../../../core/db/repos/mappers'
import type { PropositionProgression } from '../../../core/progression/engine'
import { bandeauProgression, texteBandeau } from './bandeauProgression'
import { construireVue } from './vue'

const proposition = (extra: Partial<PropositionProgression> = {}): PropositionProgression => ({
  statut: 'SUCCES', nouvelleChargeCible: null, nouveauRepsCible: null, nouvelleDureeCible: null, nouveauCompteurEchec: 0, deload: false,
  nouveauNombreSeries: null, ...extra,
})

function exercice(extra: Record<string, unknown> = {}, series: ReturnType<typeof mapSerie>[] = []) {
  const e = mapExerciceSeance({
    id: 'e', exercise_id: 'x', bloc_id: null, position: 0, nombre_series_prevues: 3, reps_cibles: '8', charge_cible: '60 kg',
    reps_type: 'REPS', progression_activee: 1, systeme_progression: 'DOUBLE', reps_min: 8, reps_max: 12, ...extra,
  })
  return construireVue([], [e], series, new Map([['x', 'Squat']])).exercices[0]
}
const serie = (numero: number, reps: number, kg: number, extra: Record<string, unknown> = {}) =>
  mapSerie({ id: `s${numero}`, exercice_seance_id: 'e', numero_serie: numero, reps_realisees: reps, charge_kg: kg, is_completed: 1, ...extra })

describe('bandeauProgression (SeanceUiState.progressionBanner Android)', () => {
  it('sans progression activée ou sans aperçu : aucun bandeau', () => {
    expect(bandeauProgression(exercice({ progression_activee: 0 }), proposition({ nouveauRepsCible: 9 }))).toBeNull()
    expect(bandeauProgression(exercice(), undefined)).toBeNull()
  })

  it('double progression sous le plafond : reps de la prochaine fois', () => {
    const b = bandeauProgression(exercice({}, [serie(1, 8, 60)]), proposition({ nouveauRepsCible: 9 }))
    expect(b).toMatchObject({ mode: 'NEXT_REPS', cibleReps: 8, totalSeries: 3, seriesReussies: 1, nouveauRepsCible: 9 })
    expect(texteBandeau(b!)).toBe('Fais 8 reps sur les 3 séries → 9 reps la prochaine fois')
  })

  it('cible au plafond de reps : la charge se débloque', () => {
    const b = bandeauProgression(exercice({ reps_cibles: '12' }), proposition({ nouvelleChargeCible: 62.5, nouveauRepsCible: 8 }))
    expect(b?.mode).toBe('UNLOCK_CHARGE')
    expect(texteBandeau(b!)).toBe('Fais 12 reps sur les 3 séries pour débloquer 62,5 kg')
  })

  it('poids de corps au plafond : une série de plus plutôt qu’une charge', () => {
    const b = bandeauProgression(exercice({ reps_cibles: '12', is_bodyweight: 1, charge_cible: 'PDC' }), proposition({ nouveauRepsCible: 8, nouveauNombreSeries: 4 }))
    expect(texteBandeau(b!)).toBe('Fais 12 reps sur les 3 séries pour passer à 4 séries')
  })

  it('progression linéaire : charge suivante', () => {
    const b = bandeauProgression(exercice({ systeme_progression: 'LINEAIRE' }), proposition({ nouvelleChargeCible: 62.5 }))
    expect(b?.mode).toBe('NEXT_CHARGE_LINEAIRE')
    expect(texteBandeau(b!)).toBe('Fais 8 reps sur les 3 séries pour passer à 62,5 kg')
  })

  it('progression temporelle : durée à tenir puis durée suivante', () => {
    const b = bandeauProgression(
      exercice({ systeme_progression: 'TEMPORELLE', reps_type: 'DURATION', reps_cibles: '30', charge_cible: 'PDC' }, [serie(1, 30, 0), serie(2, 20, 0)]),
      proposition({ nouvelleDureeCible: 35 }),
    )
    expect(b).toMatchObject({ mode: 'NEXT_DUREE', cibleDureeSec: 30, seriesReussies: 1 })
    expect(texteBandeau(b!)).toBe('Tiens 30 s sur les 3 séries → 35 s la prochaine fois')
  })

  it('compte les séries validées qui atteignent la cible (reps ET charge), pas les lignes non validées', () => {
    const b = bandeauProgression(
      exercice({}, [serie(1, 8, 60), serie(2, 8, 55), serie(3, 9, 60, { is_completed: 0 })]),
      proposition({ nouveauRepsCible: 9 }),
    )
    expect(b?.seriesReussies).toBe(1)
  })

  it('cible en plage « 8-12 » : la borne basse', () => {
    expect(bandeauProgression(exercice({ reps_cibles: '8-12' }), proposition({ nouveauRepsCible: 9 }))?.cibleReps).toBe(8)
  })

  it('le total suit le nombre de lignes du tableau (un tour G+D en bilatéral)', () => {
    expect(bandeauProgression(exercice({ is_bilateral: 1 }), proposition({ nouveauRepsCible: 9 }))?.totalSeries).toBe(6)
  })
})
