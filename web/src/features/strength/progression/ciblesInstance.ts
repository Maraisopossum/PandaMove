import type { Db, DbTx } from '../../../core/db/Db'
import { getInstance } from '../../../core/db/repos/instances'
import { getObjectif } from '../../../core/db/repos/objectifs'
import { getSeanceTree } from '../../../core/db/repos/seances'
import { chargeLisible } from '../../../core/progression/chargeLisible'

// Libellé de charge cible d'une ligne d'instance depuis la charge d'un objectif (formatChargeCibleFraiche Android) :
// « 60 kg », « 62.5 kg » (point décimal : parseChargeKg relit ce libellé). null : on garde le libellé actuel
// (charge absente, ou poids de corps à 0 qui doit rester « PDC »).
export function libelleChargeCible(chargeKg: number | null, isBodyweight: boolean): string | null {
  if (chargeKg === null) return null
  if (isBodyweight && chargeKg === 0) return null
  return `${chargeLisible(chargeKg)} kg`
}

// Aligne charge / reps cibles de la copie d'instance sur l'objectif de progression courant, pour les exercices en
// progression (rafraichirCiblesProgression Android) : la cible a pu évoluer depuis la création de l'instance
// (séance précédente terminée entre-temps). Une instance terminée n'est jamais retouchée (rapport figé) ; seules les
// lignes de l'INSTANCE sont écrites, jamais le modèle. Renvoie le nombre de lignes modifiées.
export async function rafraichirCiblesProgression(db: Db | DbTx, instanceId: string): Promise<number> {
  const instance = await getInstance(db, instanceId)
  if (!instance || instance.isCompleted) return 0
  const { exercices } = await getSeanceTree(db, instance.seanceId, instanceId)
  const maintenant = new Date().toISOString()
  let modifiees = 0
  for (const es of exercices) {
    if (!es.progressionActivee) continue
    const objectif = await getObjectif(db, instance.seanceId, es.exerciseId)
    if (!objectif) continue
    const charge = libelleChargeCible(objectif.chargeCible, es.isBodyweight) ?? es.chargeCible
    const reps = (es.repsType === 'DURATION' ? objectif.dureeCibleSec : objectif.repsCible)?.toString() ?? es.repsCibles
    if (charge === es.chargeCible && reps === es.repsCibles) continue
    await db.execute(
      'UPDATE exercices_seance SET charge_cible = ?, reps_cibles = ?, updated_at = ? WHERE id = ? AND instance_seance_id = ? AND deleted_at IS NULL',
      [charge, reps, maintenant, es.id, instanceId],
    )
    modifiees += 1
  }
  return modifiees
}
