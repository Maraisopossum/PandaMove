import type { ImportPlan, TableName } from './plan'

// Colonnes de référence -> table cible. Postgres n'a pas de clé étrangère (synchro hors-ligne) :
// cette vérification pure garantit qu'un plan n'introduit aucune ligne orpheline.
const REFERENCES: Record<string, TableName> = {
  seance_id: 'seances',
  bloc_id: 'blocs_seance',
  exercise_id: 'exercises',
  instance_seance_id: 'instances_seance',
  exercice_seance_id: 'exercices_seance',
  bloc_source_id: 'blocs_seance',
  exercice_source_id: 'exercices_seance',
}

/** Liste (en français) des références non nulles qui ne pointent vers aucune ligne du plan ; [] = intègre. */
export function verifierIntegrite(plan: ImportPlan): string[] {
  const ids = new Map<TableName, Set<unknown>>()
  for (const [table, lignes] of Object.entries(plan.rows) as [TableName, ImportPlan['rows'][TableName]][]) {
    ids.set(table, new Set(lignes.map((l) => l.id)))
  }
  const violations: string[] = []
  for (const [table, lignes] of Object.entries(plan.rows)) {
    for (const ligne of lignes) {
      for (const [colonne, cible] of Object.entries(REFERENCES)) {
        const valeur = ligne[colonne]
        if (valeur === undefined || valeur === null) continue
        if (!ids.get(cible)?.has(valeur)) {
          violations.push(`${table} ${String(ligne.id)} : ${colonne} = ${String(valeur)} ne correspond à aucune ligne de ${cible}`)
        }
      }
    }
  }
  return violations
}
