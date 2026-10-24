import { describe, expect, it } from 'vitest'
import { deterministicId, newId } from './ids'

describe('ids', () => {
  it('deterministicId est stable et dépend du nom comme du namespace', () => {
    expect(deterministicId('a', 'b')).toBe(deterministicId('a', 'b'))
    expect(deterministicId('a', 'b')).not.toBe(deterministicId('a', 'c'))
    expect(deterministicId('a', 'b')).not.toBe(deterministicId('x', 'b'))
    expect(deterministicId('a', 'b')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('newId produit des uuid v4 distincts', () => {
    expect(newId()).not.toBe(newId())
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
