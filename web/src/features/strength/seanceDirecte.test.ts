import { describe, expect, it } from 'vitest'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import { desarchiverSeance, ErreurSeance } from './affectation'
import { creerSeanceDirecte, nomParDefautSeanceDirecte } from './seanceDirecte'
import { supprimerInstanceRenforcement } from './suppression'

const base = { user_id: 'u1', updated_at: 'u0', deleted_at: null }

describe('séance directe (one-shot)', () => {
  it('nom par défaut « Séance du j/m »', () => {
    expect(nomParDefautSeanceDirecte('2026-10-05')).toBe('Séance du 5/10')
    expect(nomParDefautSeanceDirecte('2026-12-25')).toBe('Séance du 25/12')
  })

  it("crée une séance STRENGTH_ONESHOT et son instance du jour (non démarrée)", async () => {
    const db = createTestDb()
    const { seanceId, instanceId } = await creerSeanceDirecte(db, '  ', '2026-10-05')
    const s = await db.get<Record<string, unknown>>('SELECT * FROM seances WHERE id = ?', [seanceId])
    expect(s).toMatchObject({ nom: 'Séance du 5/10', seance_category: 'STRENGTH_ONESHOT', is_archived: 0, deleted_at: null })
    const i = await db.get<Record<string, unknown>>('SELECT * FROM instances_seance WHERE id = ?', [instanceId])
    expect(i).toMatchObject({ seance_id: seanceId, date: '2026-10-05', is_completed: 0, started_at: null })
  })

  it('nom saisi conservé (rogné) ; date invalide refusée sans rien écrire', async () => {
    const db = createTestDb()
    const { seanceId } = await creerSeanceDirecte(db, ' Footing de gainage ', '2026-10-05')
    expect((await db.get<{ nom: string }>('SELECT nom FROM seances WHERE id = ?', [seanceId])).nom).toBe('Footing de gainage')
    await expect(creerSeanceDirecte(db, 'x', '2026-02-30')).rejects.toThrow(ErreurSeance)
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM seances')).n).toBe(1)
  })

  it("supprimer l'instance d'une séance directe supprime aussi sa séance (tombstones), pas celle d'un modèle", async () => {
    const db = createTestDb()
    const { seanceId, instanceId } = await creerSeanceDirecte(db, 'Direct', '2026-10-05')
    await inserer(db, 'seances', { ...base, id: 'm', nom: 'Modèle', seance_category: 'STRENGTH', created_at: 'c', is_archived: 0 })
    await inserer(db, 'instances_seance', { ...base, id: 'im', seance_id: 'm', date: '2026-10-05', is_completed: 0 })
    await supprimerInstanceRenforcement(db, instanceId)
    expect((await db.get<{ deleted_at: string | null }>('SELECT deleted_at FROM seances WHERE id = ?', [seanceId])).deleted_at).not.toBeNull()
    expect((await db.get<{ deleted_at: string | null }>('SELECT deleted_at FROM instances_seance WHERE id = ?', [instanceId])).deleted_at).not.toBeNull()
    await supprimerInstanceRenforcement(db, 'im')
    expect((await db.get<{ deleted_at: string | null }>('SELECT deleted_at FROM seances WHERE id = ?', ['m'])).deleted_at).toBeNull()
    await expect(supprimerInstanceRenforcement(db, 'im')).rejects.toThrow('Séance introuvable.')
  })
})

describe('desarchiverSeance', () => {
  it('remet la séance dans la liste (is_archived = 0, updated_at rafraîchi) ; séance supprimée refusée', async () => {
    const db = createTestDb()
    await inserer(db, 'seances', { ...base, id: 'a', nom: 'A', seance_category: 'STRENGTH', created_at: 'c', is_archived: 1 })
    await desarchiverSeance(db, 'a')
    const l = await db.get<{ is_archived: number; updated_at: string }>('SELECT is_archived, updated_at FROM seances WHERE id = ?', ['a'])
    expect(l.is_archived).toBe(0)
    expect(l.updated_at).not.toBe('u0')
    await db.execute("UPDATE seances SET deleted_at = 'x' WHERE id = 'a'")
    await expect(desarchiverSeance(db, 'a')).rejects.toThrow('Séance introuvable.')
  })
})
