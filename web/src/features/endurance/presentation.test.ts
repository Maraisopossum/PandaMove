import { describe, expect, it } from 'vitest'
import { distanceKm, formaterAllure, formaterDateCourte, formaterDate, formaterDistance, formaterDuree, formaterRythme, formaterVitesse } from './presentation'

describe('formaterDuree', () => {
  it.each([
    [0, '0:00'],
    [59, '0:59'],
    [3000, '50:00'],
    [3900, '1:05:00'],
    [3599.6, '1:00:00'],
  ])('%s s -> %s', (s, attendu) => expect(formaterDuree(s)).toBe(attendu))
})

describe('distance, allure, vitesse', () => {
  it('distance en km avec virgule', () => expect(formaterDistance(10_000)).toBe('10,00 km'))
  it('allure : 10 km en 50 min -> 5:00 /km', () => expect(formaterAllure(10_000, 3000)).toBe('5:00 /km'))
  it('vitesse : 30 km en 1 h -> 30,0 km/h', () => expect(formaterVitesse(30_000, 3600)).toBe('30,0 km/h'))
  it('rien sans distance ou sans durée', () => {
    expect(formaterAllure(null, 3000)).toBeNull()
    expect(formaterAllure(10_000, 0)).toBeNull()
    expect(formaterVitesse(0, 3600)).toBeNull()
  })
  it('rythme selon le sport', () => {
    expect(formaterRythme({ sport: 'course', distanceM: 10_000, dureeS: 3000 })).toBe('5:00 /km')
    expect(formaterRythme({ sport: 'velo', distanceM: 30_000, dureeS: 3600 })).toBe('30,0 km/h')
  })
})

describe('distanceKm, formaterDateCourte', () => {
  it('nombre seul avec virgule', () => expect(distanceKm(10_020)).toBe('10,02'))
  it('date courte sans année', () => expect(formaterDateCourte('2026-11-05')).toMatch(/^5 nov\.?$/))
})

describe('formaterDate', () => {
  it('jour choisi, sans décalage de fuseau', () => expect(formaterDate('2026-11-05')).toMatch(/^5 nov\.? 2026$/))
  it('texte invalide renvoyé tel quel', () => expect(formaterDate('n’importe quoi')).toBe('n’importe quoi'))
})
