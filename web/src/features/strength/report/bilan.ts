import { formaterCharge } from '../../../core/common/formaterCharge'
import type { ObjectifAEcrire } from '../../../core/db/repos/objectifs'
import type { ExerciceSeance, ObjectifProgression, SerieRealisee } from '../../../core/db/types'
import { chargeLisible } from '../../../core/progression/chargeLisible'
import type { CibleExercice, PropositionProgression } from '../../../core/progression/engine'
import { chargesAtteignablesPourEquipement, rawEquipmentToCategory } from '../../../core/progression/inventory'
import type { EquipmentInventaire } from '../../../core/progression/types'

// Fonctions pures du bilan de séance et du récap de progression (miroir d'InstanceExecuteViewModel
// et d'InstanceReportScreen Android).

export interface ResumeSeance {
  tonnageKg: number
  seriesTotal: number
  dureeSec: number
}

// Tonnage = Σ reps × charge des séries TERMINÉES ; une série DURATION contient des secondes, pas des
// répétitions : elle compte pour 0 (KNOWN_BUGS « tonnage renforcement »). Séries = toutes les séries
// terminées (tous types) des exercices de l'instance.
export function resumerSeance(
  exercices: Pick<ExerciceSeance, 'id' | 'repsType'>[],
  series: SerieRealisee[],
  dureeSec: number,
): ResumeSeance {
  const types = new Map(exercices.map((e) => [e.id, e.repsType]))
  let tonnageKg = 0
  let seriesTotal = 0
  for (const s of series) {
    const type = types.get(s.exerciceSeanceId)
    if (type === undefined || !s.isCompleted) continue
    seriesTotal++
    if (type !== 'DURATION' && s.repsRealisees !== null && s.chargeKg !== null) tonnageKg += s.repsRealisees * s.chargeKg
  }
  // Arrondi à 0,01 kg : absorbe le bruit des sommes décimales (0,1 + 0,2)
  return { tonnageKg: Number(tonnageKg.toFixed(2)), seriesTotal, dureeSec }
}

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

// ── Garde « déjà appliqué » ──

// Android évalue et applique le récap AVANT de clore l'instance : il ne peut jamais l'appliquer deux
// fois. Ici le récap est présenté après la clôture : un objectif dont derniere_maj est postérieure ou
// égale à la fin de la séance a déjà reçu la décision de cette séance (ou d'une plus récente) et ne
// doit plus être re-proposé. derniere_maj importée d'Android est une date seule (LocalDate) : elle est
// alors comparée au jour de fin de séance.
export function objectifDejaApplique(derniereMaj: string | null, completedAt: string): boolean {
  if (!derniereMaj) return false
  if (/^\d{4}-\d{2}-\d{2}$/.test(derniereMaj)) return derniereMaj >= completedAt.slice(0, 10)
  const maj = Date.parse(derniereMaj)
  const fin = Date.parse(completedAt)
  return Number.isFinite(maj) && Number.isFinite(fin) && maj >= fin
}

// ── Écriture d'une décision (validerPropositions / persisterObjectif Android) ──

export type Decision = { type: 'accepter' } | { type: 'refuser' } | { type: 'ajuster'; chargeKg: number }

export interface ContexteDecision {
  seanceId: string
  exerciseId: string
  completedAt: string
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
 * derniere_maj n'est jamais antérieure à la fin de séance, pour que la garde tienne même si l'horloge
 * de cet appareil retarde sur celle de l'appareil qui a clos la séance.
 */
export function objectifApresDecision(
  decision: Decision,
  p: PropositionProgression,
  existant: ObjectifProgression | null,
  ctx: ContexteDecision,
  maintenant: string,
): ObjectifAEcrire {
  const derniereMaj = Date.parse(maintenant) >= Date.parse(ctx.completedAt) ? maintenant : ctx.completedAt
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

// ── Textes (strings.xml progression_recap_*) ──

const kg = (c: number) => `${formaterCharge(chargeLisible(c))} kg`

/** Libellé de la proposition, même priorité que ProgressionRecapDialog Android. */
export function texteProposition(p: PropositionProgression): string {
  if (p.nouveauNombreSeries !== null) return `Proposer +1 série (${p.nouveauNombreSeries}) — reps remis à ${p.nouveauRepsCible ?? 0}`
  if (p.nouvelleDureeCible !== null) return `Proposer ${p.nouvelleDureeCible} s`
  if (p.nouveauRepsCible !== null && p.nouvelleChargeCible !== null) return `Proposer ${p.nouveauRepsCible} reps à ${kg(p.nouvelleChargeCible)}`
  if (p.nouvelleChargeCible !== null) return `Proposer ${kg(p.nouvelleChargeCible)}`
  if (p.nouveauRepsCible !== null) return `Proposer ${p.nouveauRepsCible} reps`
  return ''
}

/** Explication du statut en langage courant. */
export function texteStatut(p: PropositionProgression): string {
  if (p.deload) return 'Réduction proposée de 10 % après échecs répétés.'
  switch (p.statut) {
    case 'SUCCES':
      return 'Cible atteinte sur toutes les séries : progression proposée.'
    case 'SUCCES_SANS_MARGE':
      return 'Cible atteinte mais RPE élevé — pas de marge, cible maintenue.'
    case 'ECHEC':
    case 'ECHEC_MARQUE':
      return `Cible manquée : cible maintenue (échec n° ${p.nouveauCompteurEchec}).`
    case 'NON_LOGGE':
      return 'Non loggé — aucune série enregistrée cette fois-ci.'
  }
}

/** Durée affichée : m:ss sous une heure, h:mm au-delà. */
export function formaterDureeBilan(dureeSec: number): string {
  const total = Math.max(0, Math.round(dureeSec))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const deux = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h} h ${deux(m)}` : `${deux(m)}:${deux(s)}`
}

/** Tonnage affiché : kg sous une tonne, t au-delà (comme InstanceReportScreen Android). */
export function formaterTonnage(tonnageKg: number): string {
  if (tonnageKg >= 1000) return `${(tonnageKg / 1000).toFixed(1).replace('.', ',')} t`
  return `${Math.round(tonnageKg)} kg`
}
