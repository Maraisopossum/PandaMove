import { describe, expect, it } from 'vitest'
import { dateIsoValide } from './dates'

describe('dateIsoValide', () => {
  it('accepte uniquement de vraies dates yyyy-MM-dd', () => {
    expect(dateIsoValide('2026-10-24')).toBe(true)
    expect(dateIsoValide('2024-02-29')).toBe(true)
    expect(dateIsoValide('2026-02-29')).toBe(false)
    expect(dateIsoValide('2026-02-30')).toBe(false)
    expect(dateIsoValide('2026-13-01')).toBe(false)
    expect(dateIsoValide('2026-00-10')).toBe(false)
    expect(dateIsoValide('2026-4-5')).toBe(false)
    expect(dateIsoValide('24/10/2026')).toBe(false)
    expect(dateIsoValide('')).toBe(false)
    expect(dateIsoValide('2026-10-24T10:00')).toBe(false)
  })

  it('gère les années bissextiles séculaires (2000 oui, 2100 non)', () => {
    expect(dateIsoValide('2000-02-29')).toBe(true)
    expect(dateIsoValide('2100-02-29')).toBe(false)
  })

  it('refuse les jours hors du mois et les espaces autour', () => {
    expect(dateIsoValide('2026-04-31')).toBe(false)
    expect(dateIsoValide('2026-04-30')).toBe(true)
    expect(dateIsoValide(' 2026-10-24')).toBe(false)
    expect(dateIsoValide('2026-10-24\n')).toBe(false)
  })

  it('reste exacte pour les dates du programme 2027 (31 janvier, 14 mars, 6 juin)', () => {
    for (const date of ['2027-01-31', '2027-03-14', '2027-06-06']) expect(dateIsoValide(date), date).toBe(true)
  })
})
