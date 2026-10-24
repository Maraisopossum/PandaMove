import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('vitest tourne', () => expect(1 + 1).toBe(2))

  it("index.html étend la page sous l'encoche (viewport-fit=cover, marges safe-area dans le CSS)", () => {
    const racine = resolve(import.meta.dirname, '../..')
    expect(readFileSync(resolve(racine, 'index.html'), 'utf8')).toMatch(/viewport-fit=cover/)
    expect(readFileSync(resolve(racine, 'src/app/app.css'), 'utf8')).toMatch(/env\(safe-area-inset-top\)/)
  })
})
