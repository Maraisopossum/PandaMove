// Bandeau de progression live (ProgressionLiveBanner Android) : ce qui se passera si toutes les séries restantes
// réussissent, et combien de séries atteignent déjà la cible. Dérivation pure, aucune écriture.
import type { CibleExercice, PropositionProgression } from '../../../core/progression/engine'
import { serieReussie } from '../../../core/progression/engine'
import { parseChargeKg } from '../progression/cible'
import { nombreLignes } from './lignesSeries'
import { texteKg } from './disques'
import type { ExerciceVue } from './vue'

export type ModeBandeau = 'UNLOCK_CHARGE' | 'NEXT_REPS' | 'NEXT_CHARGE_LINEAIRE' | 'NEXT_DUREE'

export interface Bandeau {
  mode: ModeBandeau
  cibleReps: number | null
  cibleDureeSec: number | null
  totalSeries: number
  seriesReussies: number
  nouvelleChargeKg: number | null
  nouveauRepsCible: number | null
  nouvelleDureeCibleSec: number | null
  nouveauNombreSeries: number | null
}

// Reps cibles : « 10 » -> 10 ; texte libre « 15-20 » -> borne basse ; sinon null (toIntOrNull puis split("-") Android)
function repsCibles(texte: string): number | null {
  const entier = /^[+-]?\d+$/.test(texte) ? Number(texte) : null
  if (entier !== null) return entier
  const premier = texte.split('-')[0]?.trim() ?? ''
  return /^[+-]?\d+$/.test(premier) ? Number(premier) : null
}

export function bandeauProgression(exercice: ExerciceVue, apercu: PropositionProgression | undefined): Bandeau | null {
  const es = exercice.ligne
  if (!es.progressionActivee || !apercu) return null
  const reps = repsCibles(es.repsCibles)
  const cible: CibleExercice = {
    chargeKg: parseChargeKg(es.chargeCible),
    reps,
    dureeSec: es.repsType === 'DURATION' ? reps : null,
  }
  const reussies = exercice.series.filter(
    (s) => s.terminee && serieReussie(es, cible, { repsRealisees: s.reps, chargeKg: s.chargeKg, rpe: s.rpe, notes: s.notes }),
  ).length
  const mode: ModeBandeau =
    es.systemeProgression === 'TEMPORELLE'
      ? 'NEXT_DUREE'
      : es.systemeProgression === 'LINEAIRE'
        ? 'NEXT_CHARGE_LINEAIRE'
        : es.repsMax !== null && (cible.reps ?? 0) >= es.repsMax
          ? 'UNLOCK_CHARGE'
          : 'NEXT_REPS'
  return {
    mode,
    cibleReps: cible.reps,
    cibleDureeSec: cible.dureeSec,
    totalSeries: nombreLignes(exercice),
    seriesReussies: reussies,
    nouvelleChargeKg: apercu.nouvelleChargeCible,
    nouveauRepsCible: apercu.nouveauRepsCible,
    nouvelleDureeCibleSec: apercu.nouvelleDureeCible,
    nouveauNombreSeries: apercu.nouveauNombreSeries,
  }
}

// Objectif en une phrase (textes de l'Android). Poids de corps au plafond : « passer à N séries » plutôt qu'une charge.
export function texteBandeau(b: Bandeau): string {
  const reps = b.cibleReps ?? 0
  switch (b.mode) {
    case 'UNLOCK_CHARGE':
      return b.nouvelleChargeKg === null && b.nouveauNombreSeries !== null
        ? `Fais ${reps} reps sur les ${b.totalSeries} séries pour passer à ${b.nouveauNombreSeries} séries`
        : `Fais ${reps} reps sur les ${b.totalSeries} séries pour débloquer ${texteKg(b.nouvelleChargeKg ?? 0)}`
    case 'NEXT_REPS':
      return `Fais ${reps} reps sur les ${b.totalSeries} séries → ${b.nouveauRepsCible ?? 0} reps la prochaine fois`
    case 'NEXT_CHARGE_LINEAIRE':
      return `Fais ${reps} reps sur les ${b.totalSeries} séries pour passer à ${texteKg(b.nouvelleChargeKg ?? 0)}`
    case 'NEXT_DUREE':
      return `Tiens ${b.cibleDureeSec ?? 0} s sur les ${b.totalSeries} séries → ${b.nouvelleDureeCibleSec ?? 0} s la prochaine fois`
  }
}
