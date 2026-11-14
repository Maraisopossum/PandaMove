import { describe, expect, it } from 'vitest'
import { chargeSemaine, DUREE_DEFAUT_MIN, dureeEvenementMin, formaterMinutes, lundiDe, minutesDeDetail } from './chargeCalendrier'
import type { EvenementAgenda } from './types'

const renfo = (id: string, dateIso: string, seanceId = 's1', etat: 'planifiee' | 'terminee' = 'planifiee', dureeSec?: number): EvenementAgenda => ({
  id, genre: 'renfo', dateIso, titre: 'Pull', etat, instance: { id, seanceId, nom: 'Pull', dateIso, etat, dureeSec },
})
const cardio = (id: string, dateIso: string, genre: 'course' | 'velo', detail: string | null): EvenementAgenda => ({
  id, genre, dateIso, titre: 'Sortie', etat: 'planifiee', consigne: null, detail, optionnelle: false, jalon: null, lien: null,
})
const durees = new Map([['s1', 55], ['s2', 40]])

describe('minutesDeDetail', () => {
  it.each([
    ['45 min · zone 2', 45], ['1 h 30', 90], ['2 h', 120], ['1h15', 75], ['Sortie de 1 h 10 en endurance', 70], ['90 min', 90],
  ])('%s -> %i', (texte, minutes) => expect(minutesDeDetail(texte)).toBe(minutes))
  it('absent ou illisible : null', () => {
    expect(minutesDeDetail(null)).toBeNull()
    expect(minutesDeDetail('')).toBeNull()
    expect(minutesDeDetail('zone 2')).toBeNull()
  })
})

describe('dureeEvenementMin', () => {
  it('renforcement : durée estimée du modèle, réelle une fois terminée, par défaut sinon', () => {
    expect(dureeEvenementMin(renfo('a', '2026-11-17'), durees)).toBe(55)
    expect(dureeEvenementMin(renfo('b', '2026-11-17', 'inconnue'), durees)).toBe(DUREE_DEFAUT_MIN)
    expect(dureeEvenementMin(renfo('c', '2026-11-10', 's1', 'terminee', 3030), durees)).toBe(51)
    expect(dureeEvenementMin(renfo('d', '2026-11-10', 's1', 'terminee', 0), durees)).toBe(55)
  })
  it('cardio : lue dans le détail, 45 min à défaut', () => {
    expect(dureeEvenementMin(cardio('x', '2026-11-17', 'course', '1 h 10'), durees)).toBe(70)
    expect(dureeEvenementMin(cardio('y', '2026-11-17', 'velo', null), durees)).toBe(DUREE_DEFAUT_MIN)
  })
})

describe('lundiDe et formaterMinutes', () => {
  it('lundi de la semaine, dimanche compris', () => {
    expect(lundiDe('2026-11-17')).toBe('2026-11-16') // mardi
    expect(lundiDe('2026-11-16')).toBe('2026-11-16')
    expect(lundiDe('2026-11-22')).toBe('2026-11-16') // dimanche
    expect(lundiDe('2026-11-01')).toBe('2026-10-26')
  })
  it('durées lisibles', () => {
    expect([formaterMinutes(100), formaterMinutes(55), formaterMinutes(120), formaterMinutes(0)]).toEqual(['1 h 40', '55 min', '2 h', '—'])
  })
})

describe('chargeSemaine', () => {
  // Semaine du 16 novembre : mardi (renfo 55 + course 45), mercredi (vélo 90), jeudi (renfo 55), samedi (course 70)
  const semaine = [
    renfo('r1', '2026-11-17'), cardio('c1', '2026-11-17', 'course', '45 min'), cardio('v1', '2026-11-18', 'velo', '1 h 30'),
    renfo('r2', '2026-11-19'), cardio('c2', '2026-11-21', 'course', '1 h 10'),
  ]
  // Quatre semaines précédentes d'environ 3 h chacune (moyenne 180 min)
  const historique = ['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09'].flatMap((lundi, i) => [
    cardio(`h${i}a`, lundi, 'course', '1 h 30'), cardio(`h${i}b`, lundi, 'velo', '1 h 30'),
  ])

  it('totaux par jour et par semaine, séances, suite de jours et jour libre conseillé', () => {
    const c = chargeSemaine('2026-11-16', semaine, durees)
    expect(c.jours.map((j) => j.minutes)).toEqual([0, 100, 90, 55, 0, 70, 0])
    expect(c.jours.map((j) => j.seances)).toEqual([0, 2, 1, 1, 0, 1, 0])
    expect([c.minutes, c.seances]).toEqual([315, 5])
    expect(c.suite).toEqual({ longueur: 3, debut: '2026-11-17', fin: '2026-11-19' })
    expect(c.jourLibre).toBe('2026-11-20') // vendredi, premier jour libre après la suite de trois jours
  })

  it('niveau par rapport à la moyenne des quatre semaines précédentes', () => {
    const c = chargeSemaine('2026-11-16', [...historique, ...semaine], durees)
    expect(c.moyenneMin).toBe(180)
    expect(c.ecartPct).toBe(75) // 315 min contre 180
    expect(c.niveau).toBe('haut')
    const calme = chargeSemaine('2026-11-16', [...historique, cardio('x', '2026-11-18', 'velo', '2 h')], durees)
    expect(calme.niveau).toBe('bas') // 120 min contre 180 : 67 % de la moyenne, sous 90 %
    const proche = chargeSemaine('2026-11-16', [...historique, cardio('y', '2026-11-18', 'velo', '2 h 50')], durees)
    expect(proche.niveau).toBe('moyen') // 170 min : 94 % de la moyenne
  })

  it('sans historique : repères absolus ; semaine vide : zéros, jour libre le premier jour', () => {
    expect(chargeSemaine('2026-11-16', semaine, durees)).toMatchObject({ moyenneMin: null, ecartPct: null, niveau: 'moyen' }) // 315 min : entre 4 h et 8 h
    const lourde = [1, 2, 3, 4, 5, 6].map((i) => cardio(`l${i}`, `2026-11-${15 + i}`, 'velo', '1 h 30'))
    expect(chargeSemaine('2026-11-16', lourde, durees).niveau).toBe('haut') // 9 h
    const vide = chargeSemaine('2026-11-16', [], durees)
    expect(vide).toMatchObject({ minutes: 0, seances: 0, niveau: 'bas', suite: { longueur: 0, debut: null, fin: null }, jourLibre: '2026-11-16' })
  })

  it('aucun jour libre : null ; suite qui touche dimanche : premier jour libre de la semaine', () => {
    const pleine = Array.from({ length: 7 }, (_, i) => cardio(`p${i}`, `2026-11-${16 + i}`, 'course', '30 min'))
    expect(chargeSemaine('2026-11-16', pleine, durees).jourLibre).toBeNull()
    const fin = [cardio('a', '2026-11-21', 'course', '30 min'), cardio('b', '2026-11-22', 'course', '30 min')]
    expect(chargeSemaine('2026-11-16', fin, durees).jourLibre).toBe('2026-11-16')
  })

  it('les événements des autres semaines ne comptent pas dans les jours', () => {
    const c = chargeSemaine('2026-11-16', [...semaine, cardio('z', '2026-11-30', 'velo', '3 h')], durees)
    expect(c.minutes).toBe(315)
  })
})
