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

// Lignes d'instance du fichier en COLLISION avec une copie web : même instance et même ligne source
// (exercice_source_id / bloc_source_id), c'est-à-dire exactement ce que refuse l'index unique serveur
// (instance_seance_id, ligne source). Le fichier fait foi (« l'export gagne ») : la copie locale passe
// en suppression logique (jamais de DELETE). Rien n'est perdu de ce qui a été saisi sur le web :
//  - les séries de la copie retirée sont rattachées à la ligne équivalente du fichier, valeurs intactes ;
//  - les lignes ajoutées sur le web (sans collision) restent, et celles rangées dans un bloc retiré
//    passent dans le bloc équivalent du fichier.
// Renvoie les messages à montrer dans le résultat de l'import.
async function remplacerCopiesEnCollision(tx: DbTx, plan: ImportPlan): Promise<string[]> {
  const maintenant = new Date().toISOString()
  const remplacees = { blocs_seance: new Map<string, string>(), exercices_seance: new Map<string, string>() }
  const SOURCES = [['blocs_seance', 'bloc_source_id'], ['exercices_seance', 'exercice_source_id']] as const
  for (const [table, colonneSource] of SOURCES) {
    for (const ligne of plan.rows[table]) {
      const instance = ligne.instance_seance_id
      const source = ligne[colonneSource]
      if (typeof instance !== 'string' || typeof source !== 'string') continue
      const enCollision = await tx.getAll<{ id: string }>(
        `SELECT id FROM ${table} WHERE instance_seance_id = ? AND ${colonneSource} = ? AND deleted_at IS NULL AND id <> ?`,
        [instance, source, ligne.id],
      )
      for (const { id } of enCollision) {
        await tx.execute(`UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?`, [maintenant, maintenant, id])
        remplacees[table].set(id, String(ligne.id))
      }
    }
  }

  let seriesRattachees = 0
  for (const [ancienne, nouvelle] of remplacees.exercices_seance) {
    const { n } = await tx.get<{ n: number }>(
      'SELECT COUNT(*) AS n FROM series_realisees WHERE exercice_seance_id = ? AND deleted_at IS NULL',
      [ancienne],
    )
    if (n === 0) continue
    await tx.execute(
      'UPDATE series_realisees SET exercice_seance_id = ?, updated_at = ? WHERE exercice_seance_id = ? AND deleted_at IS NULL',
      [nouvelle, maintenant, ancienne],
    )
    seriesRattachees += n
  }
  for (const [ancien, nouveau] of remplacees.blocs_seance) {
    await tx.execute(
      'UPDATE exercices_seance SET bloc_id = ?, updated_at = ? WHERE bloc_id = ? AND deleted_at IS NULL',
      [nouveau, maintenant, ancien],
    )
  }
  return seriesRattachees > 0
    ? [`${seriesRattachees} série(s) saisie(s) sur le web rattachée(s) aux exercices du fichier (même exercice de la séance)`]
    : []
}

// Applique un plan d'import en UNE transaction : la moindre erreur annule tout (rien n'est écrit)
// et est relancée. « L'export gagne » : une ligne complète remplace la ligne locale de même id
// (réimporter deux fois donne les mêmes comptes). Les exercices minimaux (créés pour une référence
// absente du fichier) ne sont insérés que s'ils n'existent pas, pour ne jamais écraser une fiche.
export async function applyImportPlan(db: Db, plan: ImportPlan): Promise<ImportReport> {
  const minimaux = new Set(plan.exercisesMinimauxIds)
  return db.writeTransaction(async (tx) => {
    // AVANT les upserts : PowerSync rejoue les écritures dans l'ordre d'exécution. Les copies web
    // remplacées doivent être supprimées sur le serveur avant l'arrivée des lignes du fichier, sinon
    // l'index unique (instance, ligne source) rejette ces dernières (23505).
    const rattachements = await remplacerCopiesEnCollision(tx, plan)

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
      ignores: [...plan.report.ignores, ...rattachements],
    }
  })
}
