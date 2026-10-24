import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../../../test/sqliteDb'
import type { Db } from '../Db'
import { addSerie, listSeries, updateSerie, type NouvelleSerie } from './series'

let db: Db
beforeEach(() => {
  db = createTestDb()
})

const serie = (extra: Partial<NouvelleSerie> = {}): NouvelleSerie => ({
  instanceSeanceId: 'i1',
  exerciceSeanceId: 'x1',
  numeroSerie: 1,
  repsRealisees: 5,
  chargeKg: 40,
  chargeLabel: null,
  rpe: null,
  notes: '',
  isCompleted: true,
  ...extra,
})

describe('series', () => {
  it('ajoute puis relit une série avec ses types', async () => {
    const id = await addSerie(db, serie({ repsRealisees: 8, chargeKg: 52.5, rpe: 8.5 }))
    const [lue] = await listSeries(db, 'i1')
    expect(lue).toMatchObject({ id, repsRealisees: 8, chargeKg: 52.5, rpe: 8.5, isCompleted: true, numeroSerie: 1 })
  })

  it('updateSerie modifie une série par son uuid et rafraîchit updated_at', async () => {
    const id = await addSerie(db, serie({ isCompleted: false }))
    await db.execute('UPDATE series_realisees SET updated_at = ? WHERE id = ?', ['2000-01-01T00:00:00.000Z', id])
    await updateSerie(db, id, { repsRealisees: 6, isCompleted: true })
    const [lue] = await listSeries(db, 'i1')
    expect(lue).toMatchObject({ repsRealisees: 6, isCompleted: true, chargeKg: 40 })
    expect(lue.updatedAt > '2000-01-01T00:00:00.000Z').toBe(true)
  })

  it('doublon (même exercice, même numéro) de deux appareils : garde le plus récent', async () => {
    const a = await addSerie(db, serie({ repsRealisees: 5 }))
    const b = await addSerie(db, serie({ repsRealisees: 9 }))
    await db.execute('UPDATE series_realisees SET updated_at = ? WHERE id = ?', ['2026-05-01T10:00:00.000Z', a])
    await db.execute('UPDATE series_realisees SET updated_at = ? WHERE id = ?', ['2026-05-01T11:00:00.000Z', b])
    const series = await listSeries(db, 'i1')
    expect(series).toHaveLength(1)
    expect(series[0].id).toBe(b)
  })

  it('doublon aux formats mélangés (Postgres vs ISO) : compare les instants, pas le texte', async () => {
    const a = await addSerie(db, serie({ repsRealisees: 5 }))
    const b = await addSerie(db, serie({ repsRealisees: 9 }))
    // « 2026-05-01 12:00:00+00 » est plus récent mais trié AVANT « 2026-05-01T11:00 » par ordre alphabétique
    await db.execute('UPDATE series_realisees SET updated_at = ? WHERE id = ?', ['2026-05-01 12:00:00+00', a])
    await db.execute('UPDATE series_realisees SET updated_at = ? WHERE id = ?', ['2026-05-01T11:00:00.000Z', b])
    const series = await listSeries(db, 'i1')
    expect(series.map((s) => s.id)).toEqual([a])
  })

  it('ne dédoublonne pas des numéros ou exercices différents, trie par exercice puis numéro', async () => {
    await addSerie(db, serie({ numeroSerie: 2 }))
    await addSerie(db, serie({ numeroSerie: 1 }))
    await addSerie(db, serie({ exerciceSeanceId: 'x2' }))
    const lues = await listSeries(db, 'i1')
    expect(lues.map((s) => `${s.exerciceSeanceId}#${s.numeroSerie}`)).toEqual(['x1#1', 'x1#2', 'x2#1'])
  })

  it('ignore les séries supprimées', async () => {
    const id = await addSerie(db, serie())
    await db.execute('UPDATE series_realisees SET deleted_at = ? WHERE id = ?', ['2026-01-01T00:00:00Z', id])
    expect(await listSeries(db, 'i1')).toHaveLength(0)
  })
})
