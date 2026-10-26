// Calculateur de disques (PlateCalculatorSheet Android) : disques à poser de chaque côté d'une barre pour une charge
// cible, selon les disques réellement possédés (« Mon matériel »). Fonctions pures.
// Float 32 bits comme le Kotlin (Math.fround) : mêmes arrondis, mêmes tolérances.
import { chargesAtteignables, f32 } from '../../../core/progression/inventory'
import type { EquipmentInventaire } from '../../../core/progression/types'
import { premierNombre } from './lignesSeries'

export type Materiel = 'BARRE' | 'HALTERE'

/** Disques standard (kg), du plus lourd au plus léger, en stock illimité quand rien n'est déclaré. */
export const DISQUES_STANDARD: readonly number[] = [20, 15, 10, 5, 2.5, 2, 1.25, 1, 0.75, 0.5]

export interface DisqueStock {
  kg: number
  /** Nombre maximal de disques de ce poids PAR CÔTÉ */
  max: number
}

export interface DisquePose {
  kg: number
  nombre: number
}

export interface ResultatDisques {
  /** Disques à poser de chaque côté (par haltère : sur la tige), du plus lourd au plus léger */
  disques: DisquePose[]
  /** Charge totale réellement obtenue (la cible, ou la plus proche composable) */
  chargeKg: number
  /** Vrai si la cible n'est pas composable et qu'une charge voisine est proposée */
  approximatif: boolean
}

const TOLERANCE_RESTE = f32(0.05)

function remplir(parCote: number, stock: DisqueStock[]): DisquePose[] | null {
  let reste = f32(parCote)
  const pose: DisquePose[] = []
  for (const { kg, max } of [...stock].sort((a, b) => b.kg - a.kg)) {
    const nombre = Math.min(Math.floor(f32(f32(reste / kg) + f32(0.001))), max)
    if (nombre > 0) {
      pose.push({ kg, nombre })
      reste = f32(reste - f32(kg * nombre))
    }
  }
  return reste > TOLERANCE_RESTE ? null : pose
}

/**
 * Disques de chaque côté pour atteindre `cibleKg` avec une barre de `barreKg`. `stock` : disques possédés par côté
 * (null : disques standard illimités). `charges` : charges totales composables, pour proposer la plus proche quand la
 * cible ne l'est pas. Renvoie null si c'est impossible (cible sous la barre, ou aucune charge voisine).
 */
export function calculerDisques(
  cibleKg: number,
  barreKg: number,
  stock: DisqueStock[] | null,
  charges: number[] | null,
): ResultatDisques | null {
  const parCote = f32(f32(cibleKg - barreKg) / 2)
  if (parCote < -0.001) return null
  if (parCote < 0.001) return { disques: [], chargeKg: cibleKg, approximatif: false }

  const effectif = stock ?? DISQUES_STANDARD.map((kg) => ({ kg, max: Number.MAX_SAFE_INTEGER }))
  const exact = remplir(parCote, effectif)
  if (exact) return { disques: exact, chargeKg: cibleKg, approximatif: false }

  // Cible non composable : charge composable la plus proche (la première gagne à distance égale)
  const candidates = charges?.filter((c) => c >= barreKg)
  if (!candidates || candidates.length === 0) return null
  let proche = candidates[0]
  for (const c of candidates) if (Math.abs(c - cibleKg) < Math.abs(proche - cibleKg)) proche = c
  if (Math.abs(proche - cibleKg) < 0.01) return null
  const procheParCote = f32(f32(proche - barreKg) / 2)
  if (procheParCote < 0.001) return { disques: [], chargeKg: proche, approximatif: true }
  const approx = remplir(procheParCote, effectif)
  return approx ? { disques: approx, chargeKg: proche, approximatif: true } : null
}

export interface ConfigMateriel {
  /** Poids de la barre (ou de la tige de l'haltère) déclaré, sinon 20 kg / 2 kg */
  barreKg: number
  /** Disques possédés par côté ; null : standard illimité */
  disques: DisqueStock[] | null
  /** Charges totales composables ; null : inconnues */
  charges: number[] | null
}

/** Disques et barre déclarés dans « Mon matériel » pour le calculateur. */
export function configurationMateriel(inv: EquipmentInventaire, materiel: Materiel): ConfigMateriel {
  const cfg = materiel === 'BARRE' ? inv.barre : inv.halteres.chargeable
  if (!cfg) return { barreKg: materiel === 'BARRE' ? 20 : 2, disques: null, charges: null }
  const disques = Object.entries(cfg.disques)
    .map(([kg, total]) => ({ kg: Number(kg), max: Math.trunc(total / 2) }))
    .filter((d) => d.max > 0)
    .sort((a, b) => b.kg - a.kg)
  const charges = chargesAtteignables(cfg)
  return { barreKg: cfg.barreKg, disques: disques.length > 0 ? disques : null, charges: charges.length > 0 ? charges : null }
}

/** Charge proposée à l'ouverture : celle de la prochaine série non validée, sinon la charge cible du modèle. */
export function chargeInitialeCalculateur(chargeProchaineSerie: number | null, chargeCible: string): number | null {
  return chargeProchaineSerie ?? premierNombre(chargeCible)
}

/** « 20 kg », « 1,25 kg ». */
export const texteKg = (kg: number): string => `${String(kg).replace('.', ',')} kg`

/** « 2 × 20 kg  +  5 kg » (un disque seul : sans multiplicateur). */
export function texteDisques(disques: DisquePose[]): string {
  return disques.map((d) => (d.nombre === 1 ? texteKg(d.kg) : `${d.nombre} × ${texteKg(d.kg)}`)).join('  +  ')
}

/** Nombre d'un champ en kg (virgule ou point) ; null si vide ou illisible. */
export function nombreSaisi(texte: string): number | null {
  const t = texte.trim().replace(',', '.')
  if (t === '' || !/^\d*\.?\d*$/.test(t) || !/\d/.test(t)) return null
  return Number(t)
}

export type EtatCalculateur =
  | { type: 'invite' }
  | { type: 'barre' }
  | { type: 'impossible' }
  | { type: 'resultat'; cibleKg: number; barreKg: number; resultat: ResultatDisques }

/** Ce que la feuille affiche pour les champs saisis (textes bruts) et le matériel choisi. */
export function etatCalculateur(cibleTexte: string, barreTexte: string, config: ConfigMateriel): EtatCalculateur {
  const cibleKg = nombreSaisi(cibleTexte)
  if (cibleKg === null) return { type: 'invite' }
  const barreKg = nombreSaisi(barreTexte)
  if (barreKg === null || barreKg <= 0) return { type: 'barre' }
  const resultat = calculerDisques(cibleKg, barreKg, config.disques, config.charges)
  return resultat ? { type: 'resultat', cibleKg, barreKg, resultat } : { type: 'impossible' }
}

/** Décomposition du total : disques d'un côté, des deux côtés, barre comprise. */
export function detailDisques(r: ResultatDisques, barreKg: number): { parCoteKg: number; totalDisquesKg: number; totalKg: number } {
  const parCoteKg = f32(r.disques.reduce((somme, d) => somme + f32(d.kg * d.nombre), 0))
  const totalDisquesKg = f32(parCoteKg * 2)
  return { parCoteKg, totalDisquesKg, totalKg: f32(barreKg + totalDisquesKg) }
}
