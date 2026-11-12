import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXERCICES } from './donnees'
import { urlExercice } from './presentation'

// Chaque exercice du catalogue a ses deux illustrations publiées (public/mobilite/<id>-male|female.webp).
describe('illustrations des exercices', () => {
  it('existent toutes dans public/', () => {
    const manquantes = EXERCICES.flatMap((e) => (['male', 'female'] as const).map((v) => urlExercice(e.id, v))).filter((u) => !existsSync(join(process.cwd(), 'public', u)))
    expect(manquantes).toEqual([])
  })
})
