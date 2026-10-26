import { describe, expect, it } from 'vitest'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import { normalizeSearch } from '../common/normalizeSearch'
import type { Db } from '../db/Db'
import { deterministicId } from '../db/ids'
import {
  catalogueDeBaseInstalle, corrigerGroupesMusculaires, installerCatalogueDeBase, messageCorrection, messageInstallation,
} from './installerCatalogue'

const USER = 'u1'
const idDe = (nom: string) => deterministicId(`${USER}:exercises`, normalizeSearch(nom))
const NOM_BASE = 'Développé couché barre'

async function exo(db: Db, nom: string, extra: Record<string, unknown> = {}) {
  await inserer(db, 'exercises', {
    id: idDe(nom), user_id: USER, updated_at: 'u', deleted_at: null, name: nom, category: 'OTHER', muscle_groups: '[]',
    description: '', is_favorite: 0, is_custom: 1, image_url: null, exercise_type: '', equipment: '[]',
    muscle_primary: '', is_bodyweight: 0, ...extra,
  })
}
const ligne = (db: Db, id: string) => db.get<Record<string, unknown>>('SELECT * FROM exercises WHERE id = ?', [id])
const compte = async (db: Db) => (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM exercises')).n

describe('installerCatalogueDeBase', () => {
  it('crée les 166 exercices (is_custom = 0, id déterministe) puis ne fait plus rien', async () => {
    const db = createTestDb()
    expect(await catalogueDeBaseInstalle(db)).toBe(false)
    const r = await installerCatalogueDeBase(db, USER)
    expect(r).toMatchObject({ ajoutes: 166, corriges: 0, ignores: 0 })
    expect(await compte(db)).toBe(166)
    expect(await catalogueDeBaseInstalle(db)).toBe(true)
    const l = await ligne(db, idDe(NOM_BASE))
    expect(l).toMatchObject({ is_custom: 0, muscle_primary: 'PECTORAUX', user_id: USER, deleted_at: null, exercise_type: 'Pluri' })
    expect(JSON.parse(l.muscle_groups as string)[0]).toBe('PECTORAUX')
    const r2 = await installerCatalogueDeBase(db, USER)
    expect(r2).toMatchObject({ ajoutes: 0, corriges: 0 })
    expect(await compte(db)).toBe(166)
  })

  it("corrige les groupes d'une ligne existante sans toucher favori, image, description ni is_custom", async () => {
    const db = createTestDb()
    await exo(db, NOM_BASE, { is_favorite: 1, image_url: 'img', description: 'ma note', muscle_groups: '["Pectoral"]' })
    const r = await installerCatalogueDeBase(db, USER)
    expect(r).toMatchObject({ ajoutes: 165, corriges: 1 })
    const l = await ligne(db, idDe(NOM_BASE))
    expect(l).toMatchObject({ is_favorite: 1, image_url: 'img', description: 'ma note', is_custom: 1, muscle_primary: 'PECTORAUX' })
    expect(JSON.parse(l.muscle_groups as string)).toEqual(['PECTORAUX', 'TRICEPS', 'EPAULES'])
  })

  it("reconnaît une ligne existante de même nom normalisé mais d'id différent (pas de doublon)", async () => {
    const db = createTestDb()
    await inserer(db, 'exercises', {
      id: 'autre-id', user_id: USER, updated_at: 'u', deleted_at: null, name: 'developpe couche BARRE', category: 'OTHER',
      muscle_groups: '[]', description: '', is_favorite: 0, is_custom: 1, image_url: null, exercise_type: '', equipment: '[]',
      muscle_primary: '', is_bodyweight: 0,
    })
    await installerCatalogueDeBase(db, USER)
    expect(await compte(db)).toBe(166)
    expect((await ligne(db, 'autre-id')).muscle_primary).toBe('PECTORAUX')
  })

  it('ne ressuscite pas une ligne supprimée logiquement', async () => {
    const db = createTestDb()
    await exo(db, NOM_BASE, { deleted_at: '2026-01-01T00:00:00Z', is_custom: 0 })
    const r = await installerCatalogueDeBase(db, USER)
    expect(r).toMatchObject({ ajoutes: 165, ignores: 1 })
    const l = await ligne(db, idDe(NOM_BASE))
    expect(l.deleted_at).toBe('2026-01-01T00:00:00Z')
    expect(l.muscle_primary).toBe('')
  })

  it('compte les lignes supprimées pour le marqueur « déjà installé »', async () => {
    const db = createTestDb()
    await exo(db, NOM_BASE, { deleted_at: 'x', is_custom: 0 })
    expect(await catalogueDeBaseInstalle(db)).toBe(true)
  })

  it('a des messages en français', () => {
    expect(messageInstallation({ ajoutes: 166, corriges: 12, ignores: 0 })).toBe('166 exercices ajoutés, 12 corrigés.')
    expect(messageInstallation({ ajoutes: 1, corriges: 1, ignores: 0 })).toBe('1 exercice ajouté, 1 corrigé.')
    expect(messageInstallation({ ajoutes: 0, corriges: 0, ignores: 0 })).toBe('Le catalogue de base est déjà à jour.')
    expect(messageCorrection(0)).toBe('Les groupes musculaires sont déjà corrects.')
    expect(messageCorrection(3)).toBe('3 exercices corrigés.')
  })
})

describe('corrigerGroupesMusculaires', () => {
  it('corrige perso (principal vide) et base, ignore les supprimés et ne touche pas un principal renseigné', async () => {
    const db = createTestDb()
    await exo(db, NOM_BASE, { muscle_groups: '["Pectoral"]' })
    await exo(db, 'Mon exo', { muscle_groups: '["Grand dorsal","Biceps brachial"]' })
    await exo(db, 'Mon exo 2', { muscle_primary: 'Quadriceps', muscle_groups: '["QUADRICEPS"]' })
    await exo(db, 'Mon exo 3', { muscle_groups: '["Grand dorsal"]', deleted_at: 'x' })
    const n = await corrigerGroupesMusculaires(db)
    expect(n).toBe(2)
    expect((await ligne(db, idDe('Mon exo'))).muscle_primary).toBe('DOS')
    expect(JSON.parse((await ligne(db, idDe('Mon exo'))).muscle_groups as string)).toEqual(['DOS', 'BICEPS'])
    expect((await ligne(db, idDe('Mon exo 2'))).muscle_primary).toBe('Quadriceps')
    expect((await ligne(db, idDe('Mon exo 3'))).muscle_primary).toBe('')
    expect(await corrigerGroupesMusculaires(db)).toBe(0)
  })
})

describe("installation — lignes synchronisées incomplètes", () => {
  it('ne plante pas sur un exercice dont le nom, les groupes et le muscle principal sont NULL', async () => {
    const db = createTestDb()
    await inserer(db, 'exercises', { id: 'n1', user_id: 'u', updated_at: 'x', deleted_at: null, name: null, muscle_groups: null, muscle_primary: null })
    await inserer(db, 'exercises', { id: 'n2', user_id: 'u', updated_at: 'x', deleted_at: null, name: 'Sans muscle', muscle_groups: '{}', muscle_primary: null, is_custom: null })
    const r = await installerCatalogueDeBase(db, 'u')
    expect(r.ajoutes).toBe(166)
    await expect(corrigerGroupesMusculaires(db)).resolves.toBeTypeOf('number')
  })
})
