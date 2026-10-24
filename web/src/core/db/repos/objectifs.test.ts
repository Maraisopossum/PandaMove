import { beforeEach, describe, expect, it } from 'vitest'
import { inserer } from '../../../test/fixtures'
import { createTestDb } from '../../../test/sqliteDb'
import type { Db } from '../Db'
import { deterministicId } from '../ids'
import { getObjectif, saveObjectif, type ObjectifAEcrire } from './objectifs'

let db: Db
beforeEach(() => {
  db = createTestDb()
})

const commun = { user_id: 'u1', deleted_at: null }

async function ligne(id: string, champs: Record<string, unknown>) {
  await inserer(db, 'objectifs_progression', {
    ...commun, id, seance_id: 's1', exercise_id: 'x1', charge_cible: 50, reps_cible: 8, duree_cible_sec: null,
    compteur_echec: 0, derniere_maj: '2026-01-01', nombre_series_cible: null, updated_at: '2026-01-01T00:00:00.000Z',
    ...champs,
  })
}

const objectif = (champs: Partial<ObjectifAEcrire> = {}): ObjectifAEcrire => ({
  seanceId: 's1', exerciseId: 'x1', chargeCible: 60, repsCible: 6, dureeCibleSec: null, compteurEchec: 1,
  derniereMaj: '2026-10-24T12:00:00.000Z', nombreSeriesCible: null, ...champs,
})

const lignes = () =>
  db.getAll<{ id: string; charge_cible: number | null; compteur_echec: number; deleted_at: string | null }>(
    'SELECT id, charge_cible, compteur_echec, deleted_at FROM objectifs_progression ORDER BY id',
  )

describe('getObjectif', () => {
  it('renvoie null pour un couple sans objectif', async () => {
    expect(await getObjectif(db, 's1', 'x1')).toBeNull()
  })

  it('lit la ligne vivante la plus récente du couple (séance, exercice), quel que soit son id', async () => {
    await ligne('legacy-a', { charge_cible: 40, updated_at: '2026-01-01T00:00:00.000Z' })
    await ligne('web-b', { charge_cible: 45, updated_at: '2026-03-01T00:00:00.000Z' })
    await ligne('autre', { exercise_id: 'x2', charge_cible: 99, updated_at: '2026-09-01T00:00:00.000Z' })
    expect(await getObjectif(db, 's1', 'x1')).toMatchObject({ id: 'web-b', chargeCible: 45, compteurEchec: 0 })
  })

  it('ignore les lignes supprimées', async () => {
    await ligne('vivante', { charge_cible: 40, updated_at: '2026-01-01T00:00:00.000Z' })
    await ligne('supprimee', { charge_cible: 45, updated_at: '2026-03-01T00:00:00.000Z', deleted_at: '2026-03-02T00:00:00.000Z' })
    expect((await getObjectif(db, 's1', 'x1'))?.id).toBe('vivante')
  })

  it('applique les défauts typés (charge/reps/durée nulles conservées, compteur 0)', async () => {
    await ligne('vide', { charge_cible: null, reps_cible: null, compteur_echec: null, derniere_maj: null })
    expect(await getObjectif(db, 's1', 'x1')).toMatchObject({
      chargeCible: null, repsCible: null, dureeCibleSec: null, compteurEchec: 0, derniereMaj: null, nombreSeriesCible: null,
    })
  })
})

describe('saveObjectif', () => {
  it('crée la ligne avec un id déterministe (séance, exercice) pour un couple neuf', async () => {
    const id = await saveObjectif(db, objectif())
    expect(id).toBe(deterministicId('s1', 'x1'))
    expect(await getObjectif(db, 's1', 'x1')).toMatchObject({
      id, chargeCible: 60, repsCible: 6, compteurEchec: 1, derniereMaj: '2026-10-24T12:00:00.000Z',
    })
  })

  it('met à jour la ligne la plus récente du couple, sans en créer une troisième', async () => {
    await ligne('legacy-a', { charge_cible: 40, updated_at: '2026-01-01T00:00:00.000Z' })
    await ligne('web-b', { charge_cible: 45, updated_at: '2026-03-01T00:00:00.000Z' })
    const id = await saveObjectif(db, objectif({ chargeCible: 47.5, compteurEchec: 2 }), '2026-10-24T12:00:00.000Z')
    expect(id).toBe('web-b')
    expect(await lignes()).toEqual([
      { id: 'legacy-a', charge_cible: 40, compteur_echec: 0, deleted_at: null },
      { id: 'web-b', charge_cible: 47.5, compteur_echec: 2, deleted_at: null },
    ])
    expect((await getObjectif(db, 's1', 'x1'))?.updatedAt).toBe('2026-10-24T12:00:00.000Z')
  })

  it('ne réutilise pas une ligne supprimée du couple', async () => {
    await ligne('supprimee', { deleted_at: '2026-03-02T00:00:00.000Z' })
    const id = await saveObjectif(db, objectif())
    expect(id).toBe(deterministicId('s1', 'x1'))
    expect((await lignes()).map((l) => l.id).sort()).toEqual([deterministicId('s1', 'x1'), 'supprimee'].sort())
  })

  it('écrit une charge Float 32 bits sous sa forme décimale lisible', async () => {
    await saveObjectif(db, objectif({ chargeCible: 17.69999885559082 }))
    expect((await lignes())[0].charge_cible).toBe(17.7)
  })

  it('fonctionne dans une transaction fournie', async () => {
    await db.writeTransaction((tx) => saveObjectif(tx, objectif({ chargeCible: 30 })))
    expect((await getObjectif(db, 's1', 'x1'))?.chargeCible).toBe(30)
  })
})
