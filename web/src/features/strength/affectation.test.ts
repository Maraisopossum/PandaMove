import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../../core/db/Db'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import { lancerSeanceMaintenant } from './affectation'

const base = { user_id: 'u1', updated_at: 'u0', deleted_at: null }
// 25 octobre 2026, 23 h 30 heure locale : la date retenue est la date LOCALE du jour
const MAINTENANT = new Date(2026, 9, 25, 23, 30)

const lignes = (db: Db) =>
  db.getAll<{ id: string; seance_id: string; date: string; started_at: string | null; is_completed: number }>(
    'SELECT id, seance_id, date, started_at, is_completed FROM instances_seance WHERE deleted_at IS NULL ORDER BY id',
  )

let db: Db
beforeEach(async () => {
  db = createTestDb()
  await inserer(db, 'seances', { ...base, id: 's1', nom: 'Pull', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
  await inserer(db, 'seances', { ...base, id: 's2', nom: 'Push', is_archived: 0, seance_category: 'STRENGTH', created_at: 'c' })
})

describe('lancerSeanceMaintenant', () => {
  it("crée l'instance à la date locale du jour et la démarre immédiatement", async () => {
    const id = await lancerSeanceMaintenant(db, 's1', MAINTENANT)
    expect(await lignes(db)).toEqual([
      { id, seance_id: 's1', date: '2026-10-25', started_at: MAINTENANT.toISOString(), is_completed: 0 },
    ])
  })

  it("reprend l'instance non terminée du même modèle déjà prévue aujourd'hui (sans en créer une seconde) et la démarre", async () => {
    await inserer(db, 'instances_seance', { ...base, id: 'prevue', seance_id: 's1', date: '2026-10-25', is_completed: 0, created_at: 'c' })
    expect(await lancerSeanceMaintenant(db, 's1', MAINTENANT)).toBe('prevue')
    expect(await lignes(db)).toEqual([
      { id: 'prevue', seance_id: 's1', date: '2026-10-25', started_at: MAINTENANT.toISOString(), is_completed: 0 },
    ])
  })

  it('une instance déjà démarrée aujourd’hui est reprise sans toucher à son heure de départ', async () => {
    await inserer(db, 'instances_seance', {
      ...base, id: 'encours', seance_id: 's1', date: '2026-10-25', is_completed: 0, started_at: '2026-10-25T08:00:00.000Z', created_at: 'c',
    })
    expect(await lancerSeanceMaintenant(db, 's1', MAINTENANT)).toBe('encours')
    expect((await lignes(db))[0].started_at).toBe('2026-10-25T08:00:00.000Z')
  })

  it("ne reprend ni une instance terminée, ni supprimée, ni d'un autre jour, ni d'un autre modèle", async () => {
    await inserer(db, 'instances_seance', { ...base, id: 'a-faite', seance_id: 's1', date: '2026-10-25', is_completed: 1, created_at: 'c' })
    await inserer(db, 'instances_seance', {
      ...base, id: 'b-sup', seance_id: 's1', date: '2026-10-25', is_completed: 0, created_at: 'c', deleted_at: 'x',
    })
    await inserer(db, 'instances_seance', { ...base, id: 'c-hier', seance_id: 's1', date: '2026-10-24', is_completed: 0, created_at: 'c' })
    await inserer(db, 'instances_seance', { ...base, id: 'd-autre', seance_id: 's2', date: '2026-10-25', is_completed: 0, created_at: 'c' })
    const id = await lancerSeanceMaintenant(db, 's1', MAINTENANT)
    expect(['a-faite', 'b-sup', 'c-hier', 'd-autre']).not.toContain(id)
    expect((await lignes(db)).filter((l) => l.seance_id === 's1' && l.date === '2026-10-25' && l.is_completed === 0)).toHaveLength(1)
  })

  it('deux lancements successifs ne créent qu’une instance', async () => {
    const premier = await lancerSeanceMaintenant(db, 's1', MAINTENANT)
    expect(await lancerSeanceMaintenant(db, 's1', MAINTENANT)).toBe(premier)
    expect(await lignes(db)).toHaveLength(1)
  })

  it('séance inconnue ou supprimée : message français, rien écrit', async () => {
    await db.execute("UPDATE seances SET deleted_at = 'x' WHERE id = 's2'")
    await expect(lancerSeanceMaintenant(db, 's2', MAINTENANT)).rejects.toThrow('Séance introuvable.')
    await expect(lancerSeanceMaintenant(db, 'fantome', MAINTENANT)).rejects.toThrow('Séance introuvable.')
    expect(await lignes(db)).toEqual([])
  })
})
