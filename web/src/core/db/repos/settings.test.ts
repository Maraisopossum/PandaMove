import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../../../test/sqliteDb'
import type { Db } from '../Db'
import { deterministicId } from '../ids'
import { getSettings, saveSettings } from './settings'

let db: Db
beforeEach(() => {
  db = createTestDb()
})

describe('settings', () => {
  it('renvoie les valeurs par défaut quand aucune ligne', async () => {
    expect(await getSettings(db, 'u1')).toEqual({ pandaVariant: 'male', darkMode: false, equipmentJson: '{}' })
  })

  it('upsert sur un id déterministe : une seule ligne par utilisateur', async () => {
    await saveSettings(db, 'u1', { darkMode: true })
    await saveSettings(db, 'u1', { pandaVariant: 'female' })
    await saveSettings(db, 'u1', { equipmentJson: '{"a":1}' })
    expect(await getSettings(db, 'u1')).toEqual({ pandaVariant: 'female', darkMode: true, equipmentJson: '{"a":1}' })
    const lignes = await db.getAll<{ id: string; user_id: string }>('SELECT id, user_id FROM user_settings')
    expect(lignes).toEqual([{ id: deterministicId('u1', 'user_settings'), user_id: 'u1' }])
  })

  it('deux utilisateurs ont deux lignes distinctes', async () => {
    await saveSettings(db, 'u1', { darkMode: true })
    expect((await getSettings(db, 'u2')).darkMode).toBe(false)
  })
})
