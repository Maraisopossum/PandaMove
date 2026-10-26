import { describe, expect, it } from 'vitest'
import { deterministicId, newId } from '../db/ids'
import { AllocateurIds, idLongDepuisUuid } from './ids'

describe('idLongDepuisUuid', () => {
  it("est stable : le même UUID donne toujours le même entier", () => {
    const uuid = 'a1b2c3d4-e5f6-4789-8abc-def012345678'
    expect(idLongDepuisUuid(uuid)).toBe(idLongDepuisUuid(uuid))
    expect(idLongDepuisUuid(uuid.toUpperCase())).toBe(idLongDepuisUuid(uuid))
  })

  it('donne un entier sûr strictement positif (Long Android, JSON exact)', () => {
    for (let i = 0; i < 200; i++) {
      const n = idLongDepuisUuid(newId())
      expect(Number.isSafeInteger(n)).toBe(true)
      expect(n).toBeGreaterThan(0)
      expect(n).toBeLessThanOrEqual(2 ** 52)
    }
  })

  it("ignore le quartet de version (v4 et v5 ne se distinguent pas que par lui)", () => {
    // Seul le 13e chiffre (version) diffère : sans l'ignorer, 4 bits d'entropie seraient perdus ailleurs
    expect(idLongDepuisUuid('00000000-0000-4000-8000-000000000000')).toBe(
      idLongDepuisUuid('00000000-0000-5000-8000-000000000000'),
    )
    expect(idLongDepuisUuid('00000000-0000-4100-8000-000000000000')).not.toBe(
      idLongDepuisUuid('00000000-0000-4000-8000-000000000000'),
    )
  })

  it('accepte aussi les UUID v5 déterministes des lignes importées', () => {
    expect(Number.isSafeInteger(idLongDepuisUuid(deterministicId('u:seances', '101')))).toBe(true)
  })
})

describe('AllocateurIds', () => {
  it('attribue à chaque UUID son entier dérivé quand il n’y a pas de collision', () => {
    const a = newId()
    const b = newId()
    const alloc = new AllocateurIds([a, b])
    expect(alloc.id(a)).toBe(idLongDepuisUuid(a))
    expect(alloc.id(b)).toBe(idLongDepuisUuid(b))
  })

  it('résout une collision de façon déterministe, quel que soit l’ordre de lecture', () => {
    // Même 52 bits utiles (seuls les chiffres ignorés diffèrent) -> collision forcée
    const a = '12345678-9abc-4d00-8000-000000000001'
    const b = '12345678-9abc-4d00-8000-000000000002'
    const alloc1 = new AllocateurIds([a, b])
    const alloc2 = new AllocateurIds([b, a])
    expect(alloc1.id(a)).not.toBe(alloc1.id(b))
    expect(alloc1.id(a)).toBe(alloc2.id(a))
    expect(alloc1.id(b)).toBe(alloc2.id(b))
  })

  it('un UUID inconnu (ligne référencée mais non exportée) reçoit son entier dérivé', () => {
    const alloc = new AllocateurIds([])
    const x = newId()
    expect(alloc.id(x)).toBe(idLongDepuisUuid(x))
  })
})
