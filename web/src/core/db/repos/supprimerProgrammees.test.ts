import { describe, expect, it } from 'vitest'
import { createTestDb } from '../../../test/sqliteDb'
import { compterProgrammees, creer, definirValidation, lirePlage, supprimerProgrammees } from './seancesCardio'

const seance = (id: string) => ({ id, date: '2026-11-12', titre: id, consigne: null, detail: null, optionnelle: false, jalon: null })

describe('supprimerProgrammees', () => {
  it('supprime les séances de cardio non validées, course et vélo, et garde les validées', async () => {
    const db = createTestDb()
    await creer(db, 'course', seance('a'))
    await creer(db, 'course', seance('b'))
    await creer(db, 'velo', seance('c'))
    await creer(db, 'velo', seance('d'))
    await definirValidation(db, 'course', 'b', true)
    expect(await compterProgrammees(db)).toBe(3)
    expect(await supprimerProgrammees(db)).toBe(3)
    expect(await compterProgrammees(db)).toBe(0)
    expect((await lirePlage(db, 'course', '2026-01-01', '2027-12-31')).map((s) => s.id)).toEqual(['b'])
    expect(await lirePlage(db, 'velo', '2026-01-01', '2027-12-31')).toEqual([])
  })

  it('ne fait rien sans séance programmée', async () => {
    expect(await supprimerProgrammees(createTestDb())).toBe(0)
  })
})
