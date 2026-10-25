import type { DbLecture } from '../../../core/db/Db'
import { getObjectif } from '../../../core/db/repos/objectifs'
import { getSettings } from '../../../core/db/repos/settings'
import type { ExerciceSeance } from '../../../core/db/types'
import { lireEquipementStocke } from '../../../core/import/equipment'
import { proposerMontee, type PropositionProgression } from '../../../core/progression/engine'
import { chargesAtteignablesExercice, cibleDepuis, lireListeEquipement, pasMaterielExercice } from './cible'

// Aperçu de progression (calculerProgressionPreview Android) : pour chaque exercice en progression, ce que proposerait
// le moteur si toutes les séries réussissaient (compteur d'échec 0). Lecture seule, aucune écriture : alimente le
// bandeau de progression de l'écran d'exécution. Clé : id de la ligne d'exercice de l'instance.
export async function calculerApercus(
  db: DbLecture,
  seanceId: string,
  exercices: ExerciceSeance[],
  userId: string | undefined,
): Promise<Map<string, PropositionProgression>> {
  const candidats = exercices.filter((e) => e.progressionActivee)
  const apercus = new Map<string, PropositionProgression>()
  if (candidats.length === 0) return apercus
  const stocke = lireEquipementStocke(userId ? (await getSettings(db, userId)).equipmentJson : null)
  const inventaire = { halteres: stocke.halteres, barre: stocke.barre, kettlebell: stocke.kettlebell, cable: stocke.cable }
  const ids = [...new Set(candidats.map((e) => e.exerciseId))]
  const fiches = new Map(
    (
      await db.getAll<{ id: string; equipment: string | null }>(
        `SELECT id, equipment FROM exercises WHERE deleted_at IS NULL AND id IN (${ids.map(() => '?').join(', ')})`,
        ids,
      )
    ).map((l) => [l.id, lireListeEquipement(l.equipment ?? '[]')]),
  )
  for (const es of candidats) {
    const objectif = await getObjectif(db, seanceId, es.exerciseId)
    const equipement = fiches.get(es.exerciseId) ?? []
    apercus.set(
      es.id,
      proposerMontee(
        es,
        cibleDepuis(objectif, es),
        0,
        pasMaterielExercice(equipement, stocke.pasParCategorie),
        chargesAtteignablesExercice(equipement, inventaire),
      ),
    )
  }
  return apercus
}
