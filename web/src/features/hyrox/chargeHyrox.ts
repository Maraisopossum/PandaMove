import { dateIsoLocale } from '../../core/common/dates'
import type { DbLecture } from '../../core/db/Db'
import { lireSimulations, type FormeSimulationDb, type SimulationHyrox } from '../../core/db/repos/hyrox'
import { lireSorties, type Sortie } from '../../core/db/repos/sorties'

// Les simulations Hyrox chronométrées (jusqu'à plus d'une heure d'effort) comptent dans le bilan de la semaine, la charge d'entraînement
// et les statistiques, au même titre qu'une sortie. Elles ne sont PAS des sorties en base (pas de ligne dans `sorties`) : ce module les
// présente sous la forme d'une sortie de course à la volée, pour que les calculs de charge existants les prennent en compte sans changement.

/**
 * Effort ressenti supposé d'une simulation, faute de saisie : une simulation complète est un effort soutenu (8 sur 10), une partielle ou une
 * station isolée un peu moins (7, l'intensité du seuil). La charge vaut alors durée x (RPE / 7)² : une heure complète à 8 = 131 points.
 */
export const RPE_PAR_FORME: Record<FormeSimulationDb, number> = { complete: 8, partielle: 7, station: 7 }

/** Jour local (yyyy-MM-dd) d'une simulation, d'après son horodatage de départ (UTC). */
export const jourSimulation = (s: Pick<SimulationHyrox, 'debutAt'>): string => dateIsoLocale(new Date(s.debutAt))

/** Une simulation terminée, avec un temps total mesuré, est comptée ; une simulation en cours ou abandonnée ne l'est pas. */
export const simulationComptee = (s: SimulationHyrox): boolean => s.statut === 'terminee' && (s.totalS ?? 0) > 0

/** Simulation sous forme de sortie de course (pour la charge d'entraînement uniquement : aucune distance, aucune trace). */
export function simulationEnSortie(s: SimulationHyrox): Sortie {
  return {
    id: `hyrox:${s.id}`, sport: 'course', date: jourSimulation(s), debutAt: s.debutAt, titre: 'Simulation Hyrox',
    dureeS: s.totalS, dureeDeplacementS: null, distanceM: null, denivelePosM: null, deniveleNegM: null,
    fcMoy: null, fcMax: null, rpe: RPE_PAR_FORME[s.forme], puissanceMoyW: null, puissanceMaxW: null, puissanceNormW: null, cadenceMoy: null,
    enSalle: false, notes: null, lien: null, source: 'manuel', empreinte: null, seanceId: null, tours: null, serie: null, trace: null, createdAt: s.createdAt,
  }
}

/** Sorties de course et de vélo, plus les simulations Hyrox terminées : l'entrée du calcul de charge (forme, fatigue, fraîcheur). */
export async function lireSortiesPourCharge(db: DbLecture): Promise<Sortie[]> {
  const [sorties, simulations] = await Promise.all([lireSorties(db), lireSimulations(db)])
  return [...sorties, ...simulations.filter(simulationComptee).map(simulationEnSortie)]
}

export interface ApportHyrox {
  nombre: number
  dureeS: number
}

/** Simulations terminées dont le jour local est compris entre `debut` et `fin` (inclus) : nombre et temps total. */
export async function lireApportHyrox(db: DbLecture, debut: string, fin: string): Promise<ApportHyrox> {
  const dedans = (await lireSimulations(db)).filter((s) => simulationComptee(s) && jourSimulation(s) >= debut && jourSimulation(s) <= fin)
  return { nombre: dedans.length, dureeS: dedans.reduce((somme, s) => somme + (s.totalS ?? 0), 0) }
}
