import type { SimulationHyrox } from '../../core/db/repos/hyrox'
import { bornesPeriode, type PeriodeId } from '../stats/periode'
import { jourSimulation, simulationComptee } from './chargeHyrox'
import type { FormeSimulation } from './simulation'

// Statistiques Hyrox de l'écran Statistiques : les simulations terminées d'une période (nombre, temps passé, meilleur temps de la
// simulation complète). Fonctions pures ; la lecture est dans useStatsHyrox.

export interface StatsHyrox {
  nombre: number
  /** Temps total passé en simulation sur la période, en secondes. */
  dureeS: number
  /** Temps moyen d'une simulation de la période. */
  moyenneS: number | null
  /** Meilleur temps d'une simulation COMPLÈTE sur la période (les formes partielles ne se comparent pas). */
  meilleureCompleteS: number | null
  parForme: Record<FormeSimulation, number>
  /** Simulations de la période, de la plus récente à la plus ancienne. */
  liste: SimulationHyrox[]
}

export function calculerStatsHyrox(simulations: readonly SimulationHyrox[], periode: PeriodeId, maintenant: Date): StatsHyrox {
  const { from, to } = bornesPeriode(periode, maintenant)
  const liste = simulations
    .filter((s) => simulationComptee(s) && jourSimulation(s) >= from && jourSimulation(s) <= to)
    .sort((a, b) => b.debutAt.localeCompare(a.debutAt))
  const dureeS = liste.reduce((somme, s) => somme + (s.totalS ?? 0), 0)
  const completes = liste.filter((s) => s.forme === 'complete').map((s) => s.totalS ?? 0)
  const parForme: Record<FormeSimulation, number> = { complete: 0, partielle: 0, station: 0 }
  for (const s of liste) parForme[s.forme] += 1
  return {
    nombre: liste.length,
    dureeS,
    moyenneS: liste.length > 0 ? Math.round(dureeS / liste.length) : null,
    meilleureCompleteS: completes.length > 0 ? Math.min(...completes) : null,
    parForme,
    liste,
  }
}
