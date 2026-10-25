import { describe, expect, it } from 'vitest'
import {
  calculerPaliers, marquerFait, monteeDisponible, paliersActifs, PROTOCOLES, protocoleDefaut, texteCharge, tempsRepos,
} from './montee'

describe('PROTOCOLES (WarmupEngine.kt)', () => {
  it('débutant : 2 paliers, standard : 3, lourd : 5', () => {
    expect(PROTOCOLES.DEBUTANT.map((p) => [p.pct, p.reps, p.reposSec])).toEqual([[0.5, 8, 60], [0.7, 5, 60]])
    expect(PROTOCOLES.STANDARD.map((p) => [p.pct, p.reps, p.reposSec])).toEqual([[0.4, 10, 60], [0.6, 5, 75], [0.8, 3, 90]])
    expect(PROTOCOLES.LOURD.map((p) => [p.pct, p.reps, p.reposSec])).toEqual([
      [0.4, 5, 60], [0.55, 4, 75], [0.7, 3, 90], [0.83, 2, 90], [0.92, 1, 120],
    ])
  })
})

describe('protocoleDefaut', () => {
  it('composé bas : lourd ; composé haut : standard ; isolation, machine, poids de corps : débutant ; inconnu : null', () => {
    expect(protocoleDefaut('COMPOSE_BAS')).toBe('LOURD')
    expect(protocoleDefaut('COMPOSE_HAUT')).toBe('STANDARD')
    expect(protocoleDefaut('ISOLATION')).toBe('DEBUTANT')
    expect(protocoleDefaut('MACHINE')).toBe('DEBUTANT')
    expect(protocoleDefaut('PDC')).toBe('DEBUTANT')
    expect(protocoleDefaut(null)).toBeNull()
  })
})

describe('calculerPaliers', () => {
  it('sans matériel déclaré : pourcentage de la charge cible arrondi au demi-kilo', () => {
    // 100 kg, standard : 40 / 60 / 80
    expect(calculerPaliers(100, 'STANDARD', []).map((p) => [p.chargeKg, p.reps, p.reposSec, p.fait])).toEqual([
      [40, 10, 60, false], [60, 5, 75, false], [80, 3, 90, false],
    ])
    // 62,5 kg débutant : 31,25 -> 31 ; 43,75 -> 44 (arrondi au 0,5 le plus proche)
    expect(calculerPaliers(62.5, 'DEBUTANT', []).map((p) => p.chargeKg)).toEqual([31, 44])
  })

  it('arrondi au demi-kilo, moitié vers le pair comme kotlin.math.round (2,25 -> 2 ; 2,75 -> 3)', () => {
    // 5,5 kg à 50 % = 2,75 : x2 = 5,5 -> 6 -> 3 ; 4,5 kg à 50 % = 2,25 : x2 = 4,5 -> 4 -> 2
    expect(calculerPaliers(5.5, 'DEBUTANT', [])[0].chargeKg).toBe(3)
    expect(calculerPaliers(4.5, 'DEBUTANT', [])[0].chargeKg).toBe(2)
  })

  it('avec matériel déclaré : la charge composable la plus proche', () => {
    const charges = [20, 30, 45, 60, 75, 100]
    expect(calculerPaliers(100, 'STANDARD', charges).map((p) => p.chargeKg)).toEqual([45, 60, 75])
  })

  it('égalité de distance : la première charge de la liste gagne', () => {
    expect(calculerPaliers(100, 'STANDARD', [30, 50]).map((p) => p.chargeKg)[0]).toBe(30)
  })

  it('palier nul ou négatif : libellé « PDC »', () => {
    expect(texteCharge(0)).toBe('PDC')
    expect(texteCharge(40)).toBe('40 kg')
    expect(texteCharge(17.5)).toBe('17,5 kg')
  })
})

describe('paliers à cocher dans l’ordre', () => {
  const paliers = calculerPaliers(100, 'STANDARD', [])

  it('seul le premier palier non fait est actif', () => {
    expect(paliersActifs(paliers).map((p) => p.actif)).toEqual([true, false, false])
    expect(paliersActifs(marquerFait(paliers, 0)).map((p) => p.actif)).toEqual([false, true, false])
  })

  it('marquer fait un palier non actif est ignoré (il faut valider dans l’ordre)', () => {
    expect(marquerFait(paliers, 2)).toBe(paliers)
  })

  it('marquer fait renvoie une copie : le repos du palier lance le chrono', () => {
    const suite = marquerFait(paliers, 0)
    expect(suite[0].fait).toBe(true)
    expect(paliers[0].fait).toBe(false)
    expect(tempsRepos(paliers, 0)).toBe(60)
    expect(tempsRepos(paliers, 9)).toBe(0)
  })
})

describe('monteeDisponible (openWarmupSheet Android)', () => {
  it('hors blocs échauffement / activation / récupération, avec une charge cible > 0', () => {
    expect(monteeDisponible(null, '60 kg')).toBe(true)
    expect(monteeDisponible('AUTRE', '60 kg')).toBe(true)
    expect(monteeDisponible('SUPERSET', '60')).toBe(true)
    expect(monteeDisponible('ECHAUFFEMENT', '60 kg')).toBe(false)
    expect(monteeDisponible('ACTIVATION', '60 kg')).toBe(false)
    expect(monteeDisponible('RECUPERATION', '60 kg')).toBe(false)
    expect(monteeDisponible(null, 'PDC')).toBe(false)
    expect(monteeDisponible(null, '')).toBe(false)
    expect(monteeDisponible(null, '0 kg')).toBe(false)
  })
})
