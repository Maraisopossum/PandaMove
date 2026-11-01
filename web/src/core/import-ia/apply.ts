import { ecrireBrouillon } from '../../features/strength/seanceStore'
import { normalizeSearch } from '../common/normalizeSearch'
import type { Db } from '../db/Db'
import { ecrireExercicePersonnalise, listExercises } from '../db/repos/exercises'
import { listSeanceTemplates } from '../db/repos/seances'
import type { ContextePlan, PlanImportIA } from './planifier'

export class ErreurImportIA extends Error {}

export interface ResultatImportIA {
  seances: number
  /** Séances du fichier déjà présentes (ou en double dans le fichier) : non réécrites. */
  ignorees: number
  exercicesCrees: number
}

/** État de la base nécessaire au plan : catalogue vivant et séances modèles vivantes. */
export async function lireContextePlan(db: Db, userId: string): Promise<ContextePlan> {
  const [catalogue, seances] = await Promise.all([listExercises(db), listSeanceTemplates(db)])
  return { userId, catalogue, seancesExistantes: seances.map((s) => ({ id: s.id, nom: s.nom })) }
}

// Écrit tout le plan en UNE transaction : exercices personnalisés d'abord, puis chaque séance par le chemin de
// l'éditeur (ecrireBrouillon : positions entrelacées, circuits, durée calculée, lignes modèle uniquement). La
// moindre erreur annule tout. Réexécuter le plan est sans effet de doublon : mêmes ids, lignes mises à jour.
export async function appliquerImportIA(db: Db, plan: PlanImportIA, userId: string): Promise<ResultatImportIA> {
  if (plan.erreurs.length > 0) throw new ErreurImportIA("Le fichier contient des erreurs : corrigez-les avant d'importer.")
  const maintenant = new Date().toISOString()
  return db.writeTransaction(async (tx) => {
    let exercicesCrees = 0
    for (const e of plan.exercicesACreer) {
      const vivants = await tx.getAll<{ id: string; name: string }>('SELECT id, name FROM exercises WHERE deleted_at IS NULL')
      if (vivants.some((v) => v.id === e.id)) continue
      if (vivants.some((v) => normalizeSearch(v.name) === normalizeSearch(e.nom))) {
        throw new ErreurImportIA(`L'exercice « ${e.nom} » vient d'être ajouté par ailleurs : relancez l'import.`)
      }
      await ecrireExercicePersonnalise(
        tx, userId, e.id,
        { name: e.nom, muscleGroups: e.muscleGroups, musclePrimary: e.musclePrimary, isBodyweight: e.isBodyweight },
        maintenant,
      )
      exercicesCrees++
    }
    for (const d of plan.brouillons) await ecrireBrouillon(tx, d)
    return { seances: plan.brouillons.length, ignorees: plan.seances.length - plan.brouillons.length, exercicesCrees }
  })
}
