import type { PointHistorique } from '../stats/statsQueries'
import { construireGraphique, type Graphique } from '../stats/presentation'
import { bornesPeriode, type PeriodeId } from '../stats/periode'

// Progression d'un exercice sur une période : courbe (la même que l'historique des statistiques), record et évolution.
// Fonctions pures sur les points déjà lus ; aucune lecture de base ici.

export type PeriodeProgression = Extract<PeriodeId, '3m' | '12m' | 'tout'>

export const PERIODES_PROGRESSION: { id: PeriodeProgression; libelle: string }[] = [
  { id: '3m', libelle: '3 mois' },
  { id: '12m', libelle: '12 mois' },
  { id: 'tout', libelle: 'Tout' },
]

export function pointsDeLaPeriode(points: PointHistorique[], periode: PeriodeProgression, maintenant: Date): PointHistorique[] {
  if (periode === 'tout') return points
  const { from, to } = bornesPeriode(periode, maintenant)
  return points.filter((p) => p.dateIso >= from && p.dateIso <= to)
}

export interface ResumeProgression {
  graphique: Graphique
  /** Meilleure valeur de la période (kg, reps ou secondes selon l'exercice) et sa date. */
  record: { valeur: number; dateIso: string } | null
  /** Dernière valeur moins première valeur de la période ; null avec moins de deux séances. */
  evolution: number | null
  seances: number
}

export function resumerProgression(points: PointHistorique[]): ResumeProgression {
  const graphique = construireGraphique(points)
  const p = graphique.points
  let record: ResumeProgression['record'] = null
  for (const point of p) if (!record || point.valeur >= record.valeur) record = { valeur: point.valeur, dateIso: point.dateIso }
  const evolution = p.length >= 2 ? Math.round((p[p.length - 1].valeur - p[0].valeur) * 100) / 100 : null
  return { graphique, record, evolution, seances: p.length }
}
