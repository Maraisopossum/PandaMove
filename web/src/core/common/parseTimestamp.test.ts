import { describe, expect, it, vi } from 'vitest'
import { comparerHorodatages, parseTimestamp } from './parseTimestamp'

const MS = Date.UTC(2026, 9, 24, 16, 0, 0)

describe('parseTimestamp', () => {
  it('lit un ISO écrit par le client (toISOString)', () => {
    expect(parseTimestamp('2026-10-24T16:00:00.000Z')).toBe(MS)
  })

  it('lit le format Postgres / PowerSync (espace, décalage court « +00 »)', () => {
    expect(parseTimestamp('2026-10-24 16:00:00+00')).toBe(MS)
    expect(parseTimestamp('2026-10-24 18:00:00+02')).toBe(MS)
    expect(parseTimestamp('2026-10-24 12:30:00-03:30')).toBe(MS)
    expect(parseTimestamp('2026-10-24 16:00:00+0000')).toBe(MS)
  })

  it('accepte les microsecondes (6 chiffres) et les tronque à la milliseconde', () => {
    expect(parseTimestamp('2026-10-24 16:00:00.123456+00')).toBe(MS + 123)
    expect(parseTimestamp('2026-10-24 16:00:00.5Z')).toBe(MS + 500)
    expect(parseTimestamp('2026-10-24T16:00:00.123456Z')).toBe(MS + 123)
  })

  it('un horodatage sans décalage est lu en UTC (horodatage serveur), jamais en heure locale', () => {
    expect(parseTimestamp('2026-10-24 16:00:00')).toBe(MS)
    expect(parseTimestamp('2026-10-24T16:00')).toBe(MS)
  })

  it('ne dépend pas de Date.parse pour les formats Postgres (Safari / iOS renvoie NaN)', () => {
    const safari = vi.spyOn(Date, 'parse').mockReturnValue(Number.NaN)
    try {
      expect(parseTimestamp('2026-10-24 16:00:00+00')).toBe(MS)
      expect(parseTimestamp('2026-10-24 16:00:00.123456+00')).toBe(MS + 123)
    } finally {
      safari.mockRestore()
    }
  })

  it('renvoie null pour une valeur absente ou illisible', () => {
    expect(parseTimestamp(null)).toBeNull()
    expect(parseTimestamp(undefined)).toBeNull()
    expect(parseTimestamp('')).toBeNull()
    expect(parseTimestamp('pas une date')).toBeNull()
    expect(parseTimestamp('2026-13-45 99:00:00+00')).toBeNull()
  })
})

describe('comparerHorodatages', () => {
  it('compare des formats mélangés par instant, pas par ordre alphabétique', () => {
    // « 2026-10-24 17:00 » < « 2026-10-24T16:00 » en ordre alphabétique (espace < T), mais il est plus récent
    expect(comparerHorodatages('2026-10-24 17:00:00+00', '2026-10-24T16:00:00.000Z')).toBeGreaterThan(0)
    expect(comparerHorodatages('2026-10-24T16:00:00.000Z', '2026-10-24 16:00:00+00')).toBe(0)
  })

  it('une valeur illisible est plus ancienne que toute valeur lisible', () => {
    expect(comparerHorodatages(null, '2026-10-24T16:00:00.000Z')).toBeLessThan(0)
    expect(comparerHorodatages('2026-10-24T16:00:00.000Z', '')).toBeGreaterThan(0)
    expect(comparerHorodatages(null, '')).toBe(0)
  })
})
