import { describe, expect, it } from 'vitest'
import { analyserDuree, BROUILLON_VIERGE, lireBrouillon, type BrouillonSortie } from './saisieSortie'

const base = (surcharge: Partial<BrouillonSortie> = {}): BrouillonSortie => ({ ...BROUILLON_VIERGE('2026-11-05'), ...surcharge })

describe('analyserDuree', () => {
  it.each([
    ['52:30', 3150],
    ['1:05:30', 3930],
    ['0:45', 45],
    ['', null],
    ['  ', null],
  ])('« %s » -> %s', (texte, attendu) => expect(analyserDuree(texte)).toBe(attendu))
  it.each(['45', '1:5', '12:60', '1:75:00', 'abc', '1:2:3:4'])('« %s » est invalide', (texte) => expect(analyserDuree(texte)).toBeUndefined())
})

describe('lireBrouillon', () => {
  it('formulaire vide : seulement la date et le sport', () => {
    const r = lireBrouillon(base(), 'course')
    expect(r).toEqual({
      ok: true,
      saisie: {
        sport: 'course', date: '2026-11-05', titre: '', dureeS: null, distanceM: null, denivelePosM: null, fcMoy: null, fcMax: null,
        rpe: null, notes: '', lien: null, enSalle: false, seanceId: null,
      },
    })
  })

  it('convertit durée, distance (virgule), dénivelé, FC, RPE', () => {
    const r = lireBrouillon(base({ duree: '50:00', distanceKm: '10,5', denivele: '120', fcMoy: '150', fcMax: '175', rpe: '7', seanceId: 'abc' }), 'velo')
    expect(r.ok && r.saisie).toMatchObject({ sport: 'velo', dureeS: 3000, distanceM: 10_500, denivelePosM: 120, fcMoy: 150, fcMax: 175, rpe: 7, seanceId: 'abc' })
  })

  it('signale chaque champ invalide', () => {
    const r = lireBrouillon(base({ duree: '45', distanceKm: 'dix', denivele: '-3', fcMoy: '10', fcMax: 'x', rpe: '11', lien: 'http://x.fr' }), 'course')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.erreurs).sort()).toEqual(['denivele', 'distanceKm', 'duree', 'fcMax', 'fcMoy', 'lien', 'rpe'])
  })

  it('FC moyenne au-dessus de la maximale', () => {
    const r = lireBrouillon(base({ fcMoy: '180', fcMax: '170' }), 'course')
    expect(!r.ok && r.erreurs.fcMoy).toMatch(/dépasse/)
  })

  it('lien https normalisé', () => {
    const r = lireBrouillon(base({ lien: 'HTTPS://Exemple.fr/a' }), 'course')
    expect(r.ok && r.saisie.lien).toBe('https://exemple.fr/a')
  })
})
