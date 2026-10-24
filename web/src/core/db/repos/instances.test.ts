import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../../../test/sqliteDb'
import type { Db } from '../Db'
import { createInstance, getInstance, listInstances } from './instances'
import { softDelete } from './seances'

let db: Db
beforeEach(() => {
  db = createTestDb()
})

describe('instances', () => {
  it('crée et relit une instance planifiée', async () => {
    const id = await createInstance(db, 's1', '2026-06-01')
    expect(await getInstance(db, id)).toMatchObject({
      id, seanceId: 's1', date: '2026-06-01', isCompleted: false, completedAt: null, durationSeconds: 0, notes: '',
    })
  })

  it('liste par date et ignore les supprimées', async () => {
    const a = await createInstance(db, 's1', '2026-06-02')
    const b = await createInstance(db, 's1', '2026-06-01')
    expect((await listInstances(db)).map((i) => i.id)).toEqual([b, a])
    await softDelete(db, 'instances_seance', b)
    expect((await listInstances(db)).map((i) => i.id)).toEqual([a])
    expect(await getInstance(db, b)).toBeNull()
  })
})
