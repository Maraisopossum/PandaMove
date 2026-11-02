import type { ExerciceConfig, CibleExercice, PropositionProgression, SerieEvaluee } from './engine'
import { f32 } from './inventory'

// Calibration de la charge de départ pendant la première séance d'un exercice (voir concepts_brief.md, lot 2).
// Fonctions pures. L'exercice est joué normalement, la charge saisie série par série ; au bilan, on propose la charge la
// plus lourde tenue dans la plage de répétitions, que l'utilisateur valide (Oui / Non / Ajuster) avant écriture.

const TYPES_CALIBRES = ['COMPOSE_BAS', 'COMPOSE_HAUT', 'MACHINE']

/**
 * Seuls les « gros » exercices à charge sont calibrés : polyarticulaires et machines. Isolation, poids de corps, durée
 * et exercices sans type renseigné ne le sont pas (le type se règle dans la configuration de progression).
 */
export function estEligibleCalibration(e: Pick<ExerciceConfig, 'typeExercice' | 'repsType' | 'isBodyweight'>): boolean {
  return e.typeExercice !== null && TYPES_CALIBRES.includes(e.typeExercice) && e.repsType === 'REPS' && !e.isBodyweight
}

/**
 * Proposition de charge de départ : parmi les séries chargées qui atteignent le minimum de la plage, la charge la plus
 * lourde (à charge égale, le plus de répétitions) ; répétitions de départ = celles réalisées, bornées au haut de plage.
 * Null si aucune série n'est concluante (rien à écrire : l'exercice reste à calibrer).
 */
export function proposerCalibration(
  config: Pick<ExerciceConfig, 'repsMin' | 'repsMax'>,
  cible: CibleExercice,
  series: SerieEvaluee[],
): PropositionProgression | null {
  const minimum = config.repsMin ?? cible.reps ?? 1
  const valables = series.filter((s) => s.chargeKg != null && s.chargeKg > 0 && (s.repsRealisees ?? 0) >= minimum)
  if (valables.length === 0) return null
  const retenue = valables.reduce((a, b) => {
    const ca = a.chargeKg ?? 0
    const cb = b.chargeKg ?? 0
    return cb > ca || (cb === ca && (b.repsRealisees ?? 0) > (a.repsRealisees ?? 0)) ? b : a
  })
  const reps = retenue.repsRealisees ?? minimum
  return {
    statut: 'SUCCES',
    nouvelleChargeCible: f32(retenue.chargeKg ?? 0),
    nouveauRepsCible: config.repsMax != null ? Math.min(reps, config.repsMax) : reps,
    nouvelleDureeCible: null,
    nouveauCompteurEchec: 0,
    deload: false,
    nouveauNombreSeries: null,
    calibration: true,
  }
}
