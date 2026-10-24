import type { Db, DbTx } from '../db/Db'
import { getSettings, saveSettingsTx } from '../db/repos/settings'
import { upsertRow } from '../db/upsert'
import { mergeEquipment, type ImportPlan, type TableName } from './plan'

export interface ImportReport {
  seances: number
  instances: number
  series: number
  exercises: number
  objectifs: number
  ignores: string[]
}

// Ordre d'écriture : parents avant enfants.
const ORDRE: TableName[] = [
  'exercises', 'seances', 'blocs_seance', 'exercices_seance', 'instances_seance',
  'series_realisees', 'objectifs_progression',
]

// Exception à « l'export gagne » : le marqueur de progression local d'une instance (évaluation faite,
// décisions Oui / Non / Ajuster prises sur le web) n'est jamais remplacé par celui du fichier ;
// sinon une proposition déjà décidée serait reproposée, ou une évaluation rejouée.
async function sansEcraserMarqueur(tx: DbTx, table: TableName, ligne: Record<string, unknown>) {
  if (table !== 'instances_seance' || !('progression_json' in ligne)) return ligne
  const locale = await tx.getOptional<{ progression_json: string | null }>(
    'SELECT progression_json FROM instances_seance WHERE id = ?',
    [ligne.id],
  )
  if (!locale || locale.progression_json === null) return ligne
  const { progression_json: _ignore, ...reste } = ligne
  void _ignore
  return reste
}

// Applique un plan d'import en UNE transaction : la moindre erreur annule tout (rien n'est écrit)
// et est relancée. « L'export gagne » : une ligne complète remplace la ligne locale de même id
// (réimporter deux fois donne les mêmes comptes). Les exercices minimaux (créés pour une référence
// absente du fichier) ne sont insérés que s'ils n'existent pas, pour ne jamais écraser une fiche.
export async function applyImportPlan(db: Db, plan: ImportPlan): Promise<ImportReport> {
  const minimaux = new Set(plan.exercisesMinimauxIds)
  return db.writeTransaction(async (tx) => {
    const ecrites: Partial<Record<TableName, number>> = {}
    for (const table of ORDRE) {
      let n = 0
      for (const ligne of plan.rows[table]) {
        if (table === 'exercises' && minimaux.has(ligne.id as string)) {
          const presente = await tx.getOptional('SELECT 1 AS one FROM exercises WHERE id = ?', [ligne.id])
          if (presente) continue
        }
        await upsertRow(tx, table, await sansEcraserMarqueur(tx, table, ligne))
        n++
      }
      ecrites[table] = n
    }

    // Matériel : fusion avec l'inventaire existant, écrite dans la même transaction
    if (plan.equipmentPatch) {
      const existant = await getSettings(tx, plan.userId)
      const fusion = mergeEquipment(existant.equipmentJson, plan.equipmentPatch)
      await saveSettingsTx(tx, plan.userId, { equipmentJson: JSON.stringify(fusion) })
    }

    return {
      seances: ecrites.seances ?? 0,
      instances: ecrites.instances_seance ?? 0,
      series: ecrites.series_realisees ?? 0,
      exercises: ecrites.exercises ?? 0,
      objectifs: ecrites.objectifs_progression ?? 0,
      ignores: plan.report.ignores,
    }
  })
}
