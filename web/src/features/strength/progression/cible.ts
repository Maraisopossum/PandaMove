import type { ObjectifAEcrire } from '../../../core/db/repos/objectifs'
import type { ExerciceSeance, ObjectifProgression } from '../../../core/db/types'
import { chargeLisible } from '../../../core/progression/chargeLisible'
import type { CibleExercice, PropositionProgression } from '../../../core/progression/engine'
import { chargesAtteignablesPourEquipement, rawEquipmentToCategory } from '../../../core/progression/inventory'
import type { EquipmentInventaire } from '../../../core/progression/types'

// Fonctions pures de l'évaluation de progression (miroir d'InstanceExecuteViewModel Android),
// partagées par la fin de séance (useExecute) et le bilan (useReport).

// ── Cible initiale (InstanceExecuteViewModel.cibleDepuis, parseChargeLabel / parseChargeKg) ──

// String.toIntOrNull Kotlin : signe facultatif + chiffres, dans les bornes d'un Int.
function entierKotlin(texte: string): number | null {
  if (!/^[+-]?\d+$/.test(texte)) return null
  const n = Number(texte)
  return n >= -2147483648 && n <= 2147483647 ? n : null
}

// String.toFloatOrNull Kotlin (cas décimaux usuels ; la virgule n'est pas acceptée).
function decimalKotlin(texte: string): number | null {
  return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(texte) ? Number(texte) : null
}

function parseChargeLabel(chargeCible: string): string {
  const nettoye = chargeCible.trim()
  if (nettoye === '') return 'PDC'
  const minuscule = nettoye.toLowerCase()
  if (minuscule === 'pdc' || minuscule === 'poids corps') return 'PDC'
  if (minuscule === 'élastique' || minuscule === 'elastique') return 'Élastique'
  const kg = entierKotlin(nettoye.replace(' kg', '').replace(',', '.'))
  if (kg !== null && kg >= 1 && kg <= 100) return `${kg} kg`
  return nettoye
}

/** Charge (kg) d'un libellé de charge cible du modèle, comme parseChargeKg(parseChargeLabel(...)). */
export function parseChargeKg(chargeCible: string): number | null {
  const libelle = parseChargeLabel(chargeCible)
  if (libelle === 'PDC' || libelle === 'Élastique') return null
  return decimalKotlin(libelle.replace(' kg', ''))
}

type ChampsCible = Pick<ExerciceSeance, 'repsType' | 'repsCibles' | 'chargeCible'>

/** Cible tirée du modèle quand aucun objectif n'existe encore. */
export function cibleInitiale(es: ChampsCible): CibleExercice {
  const repsModele = entierKotlin(es.repsCibles)
  if (es.repsType === 'DURATION') return { chargeKg: null, reps: null, dureeSec: repsModele }
  return { chargeKg: parseChargeKg(es.chargeCible), reps: repsModele, dureeSec: null }
}

export function cibleDepuis(objectif: ObjectifProgression | null, es: ChampsCible): CibleExercice {
  if (objectif) return { chargeKg: objectif.chargeCible, reps: objectif.repsCible, dureeSec: objectif.dureeCibleSec }
  return cibleInitiale(es)
}

// ── Matériel (resolvePasMateriel / resolveChargesAtteignables) ──

/** Liste d'équipements d'un exercice du catalogue (JSON d'un tableau de chaînes) ; [] si illisible. */
export function lireListeEquipement(json: string): string[] {
  try {
    const v: unknown = JSON.parse(json)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

// PAS_DEFAUT d'EquipmentRepository.kt : seule la catégorie MACHINE a un pas par défaut.
const PAS_DEFAUT: Record<string, number> = { MACHINE: 5 }

/** Plus petit pas déclaré parmi les catégories de l'équipement de l'exercice ; null si aucun. */
export function pasMaterielExercice(equipement: string[], pasParCategorie: Record<string, number>): number | null {
  const pas = { ...PAS_DEFAUT, ...pasParCategorie }
  const valeurs = equipement
    .map(rawEquipmentToCategory)
    .flatMap((c) => (c !== null && pas[c] !== undefined ? [pas[c]] : []))
  return valeurs.length > 0 ? Math.min(...valeurs) : null
}

/** Charges composables avec l'inventaire déclaré ; undefined si rien (repli sur le pas simple). */
export function chargesAtteignablesExercice(equipement: string[], inventaire: EquipmentInventaire): number[] | undefined {
  const charges = chargesAtteignablesPourEquipement(inventaire, equipement)
  return charges.length > 0 ? charges : undefined
}

// ── Écriture d'une décision (validerPropositions / persisterObjectif Android) ──

/** Date LOCALE yyyy-MM-dd (LocalDate.now() Android), jamais la tranche UTC d'un ISO. */
export function dateLocale(ms: number): string {
  const d = new Date(ms)
  const deux = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`
}

export type Decision = { type: 'accepter' } | { type: 'refuser' } | { type: 'ajuster'; chargeKg: number }

export interface ContexteDecision {
  seanceId: string
  exerciseId: string
  /** Cible courante évaluée (objectif, sinon modèle) */
  cible: CibleExercice
}

/**
 * Objectif à écrire pour une décision :
 * - Oui : la proposition (charge rendue lisible) ;
 * - Ajuster : la charge choisie, le reste de la proposition ;
 * - Non : cible existante conservée, compteur d'échec de la proposition (Android écrit
 *   `proposition.copy(charge/reps/durée = existant)`), séries cibles effacées. Sans objectif existant,
 *   Android écrirait des cibles nulles (perte de la cible du modèle) : on conserve la cible courante.
 * `derniereMaj` : date locale yyyy-MM-dd (colonne typée LocalDate côté Android).
 */
export function objectifApresDecision(
  decision: Decision,
  p: PropositionProgression,
  existant: ObjectifProgression | null,
  ctx: ContexteDecision,
  derniereMaj: string,
): ObjectifAEcrire {
  const commun = { seanceId: ctx.seanceId, exerciseId: ctx.exerciseId, compteurEchec: p.nouveauCompteurEchec, derniereMaj }
  const lisible = (c: number | null) => (c === null ? null : chargeLisible(c))
  if (decision.type === 'refuser') {
    return {
      ...commun,
      chargeCible: lisible(existant ? existant.chargeCible : ctx.cible.chargeKg),
      repsCible: existant ? existant.repsCible : ctx.cible.reps,
      dureeCibleSec: existant ? existant.dureeCibleSec : ctx.cible.dureeSec,
      nombreSeriesCible: null,
    }
  }
  return {
    ...commun,
    chargeCible: lisible(decision.type === 'ajuster' ? decision.chargeKg : p.nouvelleChargeCible),
    repsCible: p.nouveauRepsCible,
    dureeCibleSec: p.nouvelleDureeCible,
    nombreSeriesCible: p.nouveauNombreSeries,
  }
}
