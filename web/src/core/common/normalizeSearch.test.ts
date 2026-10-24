import { describe, expect, it } from 'vitest'
import { normalizeSearch } from './normalizeSearch'

describe('normalizeSearch', () => {
  it('met en minuscules et retire les accents', () => {
    expect(normalizeSearch('Développé Couché')).toBe('developpe couche')
    expect(normalizeSearch('ÉLÉVATIONS latérales')).toBe('elevations laterales')
  })

  it('supprime les espaces en bord et fusionne les espaces internes', () => {
    expect(normalizeSearch('  developpe   COUCHE ')).toBe('developpe couche')
    expect(normalizeSearch('curl\t\nhaltère')).toBe('curl haltere')
  })

  it('laisse intacte une chaîne déjà normalisée', () => {
    expect(normalizeSearch('squat barre')).toBe('squat barre')
    expect(normalizeSearch('')).toBe('')
  })
})
