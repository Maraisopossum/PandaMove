import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { volumeParMuscle } from '../../features/stats/statsQueries'
import { createTestDb } from '../../test/sqliteDb'
import { normalizeSearch } from '../common/normalizeSearch'
import { applyImportPlan } from '../import/apply'
import { buildImportPlan, detecterTypeExport } from '../import/plan'
import { installerCatalogueDeBase } from './installerCatalogue'

// Test optionnel sur un VRAI export Android complet (données personnelles, jamais commitées ni affichées).
// Activé seulement si PANDAMOVE_REAL_EXPORTS_DIR pointe vers un dossier contenant des .json.
// Seuls des comptes sont affichés.
const dir = process.env.PANDAMOVE_REAL_EXPORTS_DIR
const USER = '11111111-1111-4111-8111-111111111111'
const NOW = '2026-10-24T12:00:00.000Z'

const fichiers = dir && existsSync(dir) ? readdirSync(dir).filter((f) => /\.json$/i.test(f)) : []

describe.skipIf(!dir)('catalogue de base sur export réel (PANDAMOVE_REAL_EXPORTS_DIR)', () => {
  const complets = fichiers
    .map((f) => JSON.parse(readFileSync(join(dir as string, f), 'utf8')) as unknown)
    .filter((j) => detecterTypeExport(j) === 'complet')

  it("le dossier contient un export complet", () => {
    expect(complets.length).toBeGreaterThan(0)
  })

  it.each(complets.map((j, i) => [i, j] as const))('export complet #%i : importer puis installer le catalogue', async (_i, json) => {
    const db = createTestDb()
    await applyImportPlan(db, buildImportPlan(json, USER, { now: NOW }))
    const avant = (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM exercises WHERE deleted_at IS NULL')).n
    const r = await installerCatalogueDeBase(db, USER)

    const vivants = await db.getAll<{ name: string; muscle_primary: string; muscle_groups: string }>(
      'SELECT name, muscle_primary, muscle_groups FROM exercises WHERE deleted_at IS NULL',
    )
    // Aucun doublon de nom normalisé ; au plus ≈ 166 + exercices personnalisés
    expect(new Set(vivants.map((v) => normalizeSearch(v.name))).size).toBe(vivants.length)
    expect(vivants.length).toBeLessThanOrEqual(192)
    // Chaque exercice qui porte une information musculaire a un muscle principal ; seuls des exercices
    // créés sans aucun muscle (ni groupes ni principal) restent sans principal : rien à en déduire.
    const sansPrincipal = vivants.filter((v) => v.muscle_primary.trim() === '')
    expect(sansPrincipal.filter((v) => v.muscle_groups !== '[]')).toHaveLength(0)
    expect(sansPrincipal.length).toBeLessThanOrEqual(3)

    // Volumes par muscle des séances terminées : répartis sur plusieurs groupes
    const volume = await volumeParMuscle(db, '2000-01-01', '2100-12-31')
    const total = Object.values(volume).reduce((a, b) => a + b, 0)
    const groupes = Object.entries(volume).filter(([, v]) => v > 0)
    const termines = (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM instances_seance WHERE is_completed = 1')).n
    console.info('exercices avant installation', avant, 'résultat', JSON.stringify(r), 'vivants', vivants.length, 'sans muscle', sansPrincipal.length,
      'séances terminées', termines, 'séries', total, 'groupes avec volume', groupes.length, 'AUTRE', volume.AUTRE)
    expect(total).toBeGreaterThan(0)
    expect(groupes.length).toBeGreaterThanOrEqual(4)
    expect(volume.AUTRE).toBeLessThan(total / 2)
  })
})
