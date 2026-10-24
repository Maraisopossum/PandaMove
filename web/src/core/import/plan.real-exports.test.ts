import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildImportPlan, detecterTypeExport } from './plan'
import { EquipmentConfigExportSchema, ExerciseCatalogExportSchema } from './schema'

// Test optionnel sur de VRAIS exports Android (données personnelles, jamais commitées).
// Activé seulement si PANDAMOVE_REAL_EXPORTS_DIR pointe vers un dossier contenant des .json ;
// sinon le bloc apparaît « skipped » dans la sortie (pas de faux succès silencieux).
const dir = process.env.PANDAMOVE_REAL_EXPORTS_DIR
const USER = '11111111-1111-4111-8111-111111111111'
const NOW = '2026-10-24T12:00:00.000Z'

const fichiers = dir && existsSync(dir)
  ? readdirSync(dir).filter((f) => /^panda(move|fit).*\.json$/i.test(f))
  : []

describe.skipIf(!dir)('exports réels (PANDAMOVE_REAL_EXPORTS_DIR)', () => {
  it('le dossier contient au moins un export', () => {
    expect(fichiers.length).toBeGreaterThan(0)
  })

  it.each(fichiers)('%s : import sans erreur et déterministe', (nom) => {
    const json: unknown = JSON.parse(readFileSync(join(dir as string, nom), 'utf8'))
    const type = detecterTypeExport(json)
    if (type === 'catalogue') expect(ExerciseCatalogExportSchema.safeParse(json).success).toBe(true)
    if (type === 'materiel') expect(EquipmentConfigExportSchema.safeParse(json).success).toBe(true)
    const p1 = buildImportPlan(json, USER, { now: NOW })
    const p2 = buildImportPlan(json, USER, { now: NOW })
    expect(p2).toEqual(p1)
    // Aucun id en double dans une même table
    for (const lignes of Object.values(p1.rows)) {
      expect(new Set(lignes.map((l) => l.id)).size).toBe(lignes.length)
    }
    // Comptes seulement (aucun contenu personnel dans la sortie)
    console.info(nom, type, JSON.stringify(p1.report), Object.fromEntries(
      Object.entries(p1.rows).map(([t, l]) => [t, l.length]),
    ))
  })
})
