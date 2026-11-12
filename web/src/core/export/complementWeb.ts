import type { DbLecture } from '../db/Db'
import type { Ligne } from '../db/repos/mappers'
import { lireRappelsJson } from '../db/repos/settings'

// Complément web de la sauvegarde (champ `pandamoveWeb` du fichier d'export) : ce que le format Android ne sait pas porter,
// c'est-à-dire les sorties de course et de vélo, les séances de cardio planifiées, la respiration, l'historique de mobilité
// et les réglages des rappels. Le champ est ignoré par l'import Android (ignoreUnknownKeys) et par le schéma Zod de l'import
// web (objets non stricts) : le fichier reste un export v3.2 valide.
//
// Contenu : les lignes vivantes de chaque table, telles que la base les stocke (snake_case), SANS user_id, updated_at ni
// deleted_at (posés à l'import). Les identifiants sont ceux de la base : voir core/import/complementWeb.ts pour la reprise.

export const VERSION_COMPLEMENT = 1

/** Tables du complément, dans l'ordre d'écriture à l'import (les séances planifiées avant les sorties qui s'y réfèrent). */
export const TABLES_COMPLEMENT = [
  'seances_course',
  'seances_velo',
  'sorties',
  'methodes_respiration',
  'seances_respiration',
  'seances_mobilite',
] as const

export type TableComplement = (typeof TABLES_COMPLEMENT)[number]

export interface ComplementWeb {
  version: number
  tables: Record<TableComplement, Ligne[]>
  /** Réglages des rappels (user_settings.rappels_json), texte JSON ; null s'ils n'ont jamais été réglés. */
  rappelsJson: string | null
}

const COLONNES_POSEES_A_L_IMPORT = ['user_id', 'updated_at', 'deleted_at'] as const

export async function lireComplementWeb(db: DbLecture, userId?: string): Promise<ComplementWeb> {
  const tables = {} as Record<TableComplement, Ligne[]>
  for (const table of TABLES_COMPLEMENT) {
    const lignes = await db.getAll<Ligne>(`SELECT * FROM ${table} WHERE deleted_at IS NULL ORDER BY created_at, id`)
    tables[table] = lignes.map((ligne) => {
      const copie: Ligne = { ...ligne }
      for (const c of COLONNES_POSEES_A_L_IMPORT) delete copie[c]
      return copie
    })
  }
  return { version: VERSION_COMPLEMENT, tables, rappelsJson: userId ? await lireRappelsJson(db, userId) : null }
}
