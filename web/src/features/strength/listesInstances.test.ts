import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../../core/db/Db'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import { detailsTerminee, lireSeancesProgrammees, lireSeancesTerminees } from './listesInstances'

const base = { user_id: 'u1', updated_at: 'u0', deleted_at: null }

async function seance(db: Db, id: string, nom: string, extra: Record<string, unknown> = {}) {
  await inserer(db, 'seances', { ...base, id, nom, is_archived: 0, seance_category: 'STRENGTH', created_at: 'c', ...extra })
}
async function instance(db: Db, id: string, seanceId: string, date: string, extra: Record<string, unknown> = {}) {
  await inserer(db, 'instances_seance', { ...base, id, seance_id: seanceId, date, is_completed: 0, ...extra })
}
async function serie(db: Db, id: string, inst: string, numero: number, fait: number, extra: Record<string, unknown> = {}) {
  await inserer(db, 'series_realisees', {
    ...base, id, instance_seance_id: inst, exercice_seance_id: 'e1', numero_serie: numero, is_completed: fait, ...extra,
  })
}

let db: Db
beforeEach(() => {
  db = createTestDb()
})

describe('lireSeancesProgrammees', () => {
  it('base vide : liste vide', async () => {
    expect(await lireSeancesProgrammees(db)).toEqual([])
  })

  it('non terminées et vivantes (passées comprises), date croissante puis id ; état en cours si démarrée', async () => {
    await seance(db, 's1', 'Pull')
    await instance(db, 'b', 's1', '2026-11-02')
    await instance(db, 'a', 's1', '2026-11-02')
    await instance(db, 'passee', 's1', '2026-10-01')
    await instance(db, 'cours', 's1', '2026-10-25', { started_at: '2026-10-25T08:00:00.000Z' })
    await instance(db, 'faite', 's1', '2026-10-20', { is_completed: 1 })
    await instance(db, 'sup', 's1', '2026-10-21', { deleted_at: 'x' })
    const vues = await lireSeancesProgrammees(db)
    expect(vues.map((v) => v.id)).toEqual(['passee', 'cours', 'a', 'b'])
    expect(vues.map((v) => v.etat)).toEqual(['planifiee', 'en_cours', 'planifiee', 'planifiee'])
    expect(vues[0]).toMatchObject({ nom: 'Pull', dateIso: '2026-10-01', seanceId: 's1' })
  })

  it('séance supprimée : nom conservé (lireNomSeance) ; séance inconnue : libellé de repli', async () => {
    await seance(db, 's1', 'Ancienne', { deleted_at: 'x' })
    await instance(db, 'i1', 's1', '2026-10-30')
    await instance(db, 'i2', 'fantome', '2026-10-31')
    expect((await lireSeancesProgrammees(db)).map((v) => v.nom)).toEqual(['Ancienne', 'Séance (supprimée)'])
  })

  it("exclut les séances d'une autre catégorie que le renforcement", async () => {
    await seance(db, 's1', 'Pull')
    await seance(db, 'run', 'Footing', { seance_category: 'RUNNING' })
    await instance(db, 'i1', 's1', '2026-10-30')
    await instance(db, 'i2', 'run', '2026-10-30')
    expect((await lireSeancesProgrammees(db)).map((v) => v.id)).toEqual(['i1'])
  })
})

describe('lireSeancesTerminees', () => {
  it('base vide : liste vide', async () => {
    expect(await lireSeancesTerminees(db)).toEqual([])
  })

  it('terminées et vivantes, date décroissante ; durée et séries validées (dédoublonnées, vivantes)', async () => {
    await seance(db, 's1', 'Pull', { deleted_at: 'x' })
    await instance(db, 'vieille', 's1', '2026-09-01', { is_completed: 1, duration_seconds: 1800 })
    await instance(db, 'recente', 's1', '2026-10-20', { is_completed: 1, duration_seconds: 2700 })
    await instance(db, 'planifiee', 's1', '2026-10-22')
    await instance(db, 'sup', 's1', '2026-10-23', { is_completed: 1, deleted_at: 'x' })
    await serie(db, 'x1', 'recente', 1, 1)
    await serie(db, 'x2', 'recente', 2, 1)
    await serie(db, 'x3', 'recente', 3, 0) // non validée
    await serie(db, 'x4', 'recente', 1, 1, { updated_at: 'u9' }) // doublon de (e1, 1)
    await serie(db, 'x5', 'recente', 4, 1, { deleted_at: 'x' }) // supprimée
    const vues = await lireSeancesTerminees(db)
    expect(vues.map((v) => v.id)).toEqual(['recente', 'vieille'])
    expect(vues[0]).toMatchObject({ nom: 'Pull', etat: 'terminee', dureeSec: 2700, nbSeries: 2 })
  })
})

describe('detailsTerminee', () => {
  it('durée arrondie à la minute et séries validées ; durée absente omise', () => {
    expect(detailsTerminee({ dureeSec: 2700, nbSeries: 12 })).toBe('45 min · 12 séries validées')
    expect(detailsTerminee({ dureeSec: 30, nbSeries: 1 })).toBe('moins d’une minute · 1 série validée')
    expect(detailsTerminee({ dureeSec: 0, nbSeries: 0 })).toBe('0 série validée')
    expect(detailsTerminee({})).toBe('0 série validée')
  })
})
