import { describe, expect, it } from 'vitest'
import {
  ajuster, arreter, demarrerManuel, ETAT_INITIAL, forcerDuree, lireEtat, oublierReglage, restantMs, serialiserEtat,
  PRESETS_MANUEL, pasManuel, texteDuree, type InfoRepos,
} from './minuteurRepos'

const T0 = Date.parse('2026-10-24T10:00:00.000Z')
const s = (n: number) => n * 1000
// Repos de 90 s issu d'une série validée à T0
const info: InfoRepos = { cle: 'e1#1', debutMs: T0, dureeSec: 90 }

describe('restantMs : repos issu des séries', () => {
  it('sans réglage : durée du repos moins le temps écoulé, borné à 0', () => {
    expect(restantMs(info, ETAT_INITIAL, T0 + s(30))).toBe(s(60))
    expect(restantMs(info, ETAT_INITIAL, T0 + s(500))).toBe(0)
  })

  it('aucun repos ni minuteur : null', () => {
    expect(restantMs(null, ETAT_INITIAL, T0)).toBeNull()
  })
})

describe('ajuster (+30 s / -30 s)', () => {
  it('+30 s allonge le repos restant, en horodatage absolu', () => {
    const e = ajuster(info, ETAT_INITIAL, 30, T0 + s(30))
    expect(restantMs(info, e, T0 + s(30))).toBe(s(90))
    expect(restantMs(info, e, T0 + s(60))).toBe(s(60))
  })

  it('-30 s écourte, sans descendre sous 0', () => {
    const e = ajuster(info, ETAT_INITIAL, -30, T0 + s(30))
    expect(restantMs(info, e, T0 + s(30))).toBe(s(30))
    const f = ajuster(info, e, -30, T0 + s(30))
    expect(restantMs(info, f, T0 + s(30))).toBe(0)
  })

  it('sur un repos déjà terminé, +30 s relance 30 s à partir de maintenant', () => {
    const e = ajuster(info, ETAT_INITIAL, 30, T0 + s(200))
    expect(restantMs(info, e, T0 + s(200))).toBe(s(30))
  })

  it("le réglage ne s'applique plus après une nouvelle validation (autre série)", () => {
    const e = ajuster(info, ETAT_INITIAL, 30, T0 + s(10))
    const suivante: InfoRepos = { cle: 'e1#2', debutMs: T0 + s(120), dureeSec: 90 }
    expect(restantMs(suivante, e, T0 + s(120))).toBe(s(90))
  })

  it("le réglage ne s'applique plus si la même ligne est revalidée (autre horodatage)", () => {
    const e = ajuster(info, ETAT_INITIAL, 30, T0 + s(10))
    const revalidee: InfoRepos = { cle: 'e1#1', debutMs: T0 + s(300), dureeSec: 90 }
    expect(restantMs(revalidee, e, T0 + s(300))).toBe(s(90))
  })
})

describe('arreter', () => {
  it('arrête le repos des séries : plus de décompte ni de « repos terminé »', () => {
    const e = arreter(info, ETAT_INITIAL, T0 + s(10))
    expect(restantMs(info, e, T0 + s(10))).toBeNull()
  })

  it("reprend à la validation suivante", () => {
    const e = arreter(info, ETAT_INITIAL, T0 + s(10))
    const suivante: InfoRepos = { cle: 'e1#2', debutMs: T0 + s(100), dureeSec: 60 }
    expect(restantMs(suivante, e, T0 + s(100))).toBe(s(60))
  })
})

describe('forcerDuree : repos saisi à la main sur la ligne', () => {
  it('remplace la durée du repos de cette ligne', () => {
    const e = forcerDuree(ETAT_INITIAL, 'e1#1', 45)
    expect(restantMs(info, e, T0 + s(10))).toBe(s(35))
  })

  it('0 s : aucun repos', () => {
    expect(restantMs(info, forcerDuree(ETAT_INITIAL, 'e1#1', 0), T0)).toBeNull()
  })

  it('oublierReglage retire le réglage de la ligne (dé-validation)', () => {
    const e = oublierReglage(forcerDuree(ETAT_INITIAL, 'e1#1', 45), 'e1#1')
    expect(restantMs(info, e, T0)).toBe(s(90))
  })
})

describe('minuteur manuel', () => {
  it('démarre un décompte indépendant des séries', () => {
    const e = demarrerManuel(ETAT_INITIAL, T0 + s(5), 120)
    expect(restantMs(null, e, T0 + s(5))).toBe(s(120))
    expect(restantMs(null, e, T0 + s(65))).toBe(s(60))
  })

  it('le plus récent des deux l\'emporte : manuel après la série, puis une série validée après le manuel', () => {
    const manuel = demarrerManuel(ETAT_INITIAL, T0 + s(5), 120)
    expect(restantMs(info, manuel, T0 + s(5))).toBe(s(120))
    const apres: InfoRepos = { cle: 'e1#2', debutMs: T0 + s(20), dureeSec: 60 }
    expect(restantMs(apres, manuel, T0 + s(20))).toBe(s(60))
  })

  it('+30 s, -30 s et arrêt agissent sur le minuteur manuel', () => {
    let e = demarrerManuel(ETAT_INITIAL, T0, 60)
    e = ajuster(info, e, 30, T0 + s(10))
    expect(restantMs(info, e, T0 + s(10))).toBe(s(80))
    e = arreter(info, e, T0 + s(10))
    expect(restantMs(info, e, T0 + s(10))).toBeNull()
  })

  it('retient la dernière durée choisie (30 s au départ)', () => {
    expect(ETAT_INITIAL.derniereManuelleSec).toBe(30)
    expect(demarrerManuel(ETAT_INITIAL, T0, 180).derniereManuelleSec).toBe(180)
  })

  it('une durée nulle ou négative est ignorée', () => {
    expect(demarrerManuel(ETAT_INITIAL, T0, 0)).toBe(ETAT_INITIAL)
  })
})

describe('préréglages et pas', () => {
  it('30 s, 1 min, 1 min 30, 2 min, 3 min, 5 min', () => {
    expect(PRESETS_MANUEL.map((p) => [p.sec, p.libelle])).toEqual([
      [30, '30 s'], [60, '1 min'], [90, '1 min 30'], [120, '2 min'], [180, '3 min'], [300, '5 min'],
    ])
  })

  it('± 5 s, jamais sous 5 s', () => {
    expect(pasManuel(30, 1)).toBe(35)
    expect(pasManuel(30, -1)).toBe(25)
    expect(pasManuel(5, -1)).toBe(5)
  })

  it('texteDuree : « 45 s », « 1 min », « 1 min 30 »', () => {
    expect(texteDuree(45)).toBe('45 s')
    expect(texteDuree(60)).toBe('1 min')
    expect(texteDuree(90)).toBe('1 min 30')
    expect(texteDuree(0)).toBe('—')
  })
})

describe('persistance', () => {
  it("restitue l'état sérialisé", () => {
    const e = demarrerManuel(forcerDuree(ETAT_INITIAL, 'e1#1', 45), T0, 120)
    expect(lireEtat(serialiserEtat(e))).toEqual(e)
  })

  it('texte absent ou illisible : état initial', () => {
    expect(lireEtat(null)).toEqual(ETAT_INITIAL)
    expect(lireEtat('pas du json')).toEqual(ETAT_INITIAL)
    expect(lireEtat('{"reglage":{"cle":3}}')).toEqual(ETAT_INITIAL)
  })
})
