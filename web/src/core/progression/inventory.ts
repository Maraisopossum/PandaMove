// Portage de EquipmentInventory.kt / EquipmentCategory.kt (fonctions pures).
//
// Précision flottante : Kotlin travaille en Float 32 bits, JS en 64 bits. Chaque opération
// arithmétique est donc passée par Math.fround pour reproduire l'accumulation Float. Le Kotlin
// n'arrondit PAS à 0,01 kg : seule la tolérance epsilon (0.01f) de chargeNonComposableHint existe.
import type {
  DisquesConfig,
  EquipmentCategory,
  EquipmentInventaire,
  HalteresConfig,
  PlageConfig,
} from './types'

const f32 = Math.fround

// Plafond défensif de paires par dénomination (contre une saisie aberrante).
const MAX_PAIRES_PAR_DENOMINATION = 30

// Tri numérique croissant sans doublon (équivalent de distinct().sorted() sur des Float).
function uniqueTries(valeurs: number[]): number[] {
  return [...new Set(valeurs)].sort((a, b) => a - b)
}

function chargesDisques(cfg: DisquesConfig): number[] {
  let sommes = new Set<number>([0])
  for (const [cle, quantite] of Object.entries(cfg.disques)) {
    const poidsUnitaire = f32(Number(cle))
    // Quantité / 2 (division entière) bornée à [0, plafond] : un disque par côté.
    const maxPaires = Math.min(Math.max(Math.trunc(quantite / 2), 0), MAX_PAIRES_PAR_DENOMINATION)
    if (maxPaires <= 0) continue
    const nouvelles = new Set<number>()
    for (const somme of sommes) {
      for (let n = 0; n <= maxPaires; n++) nouvelles.add(f32(somme + f32(n * 2 * poidsUnitaire)))
    }
    sommes = nouvelles
  }
  const barre = f32(cfg.barreKg)
  return uniqueTries([...sommes].map((s) => f32(barre + s)))
}

function chargesPlage(cfg: PlageConfig): number[] {
  const min = f32(cfg.minKg)
  const max = f32(cfg.maxKg)
  const pas = f32(cfg.pasKg)
  if (pas <= 0 || max <= min) return [min]
  const paliers: number[] = []
  for (let v = min; v < max; v = f32(v + pas)) paliers.push(v)
  return uniqueTries([...paliers, max])
}

function chargesHalteres(cfg: HalteresConfig): number[] {
  const fixes = cfg.poidsFixes.map(f32)
  const chargeables = cfg.chargeable ? chargesDisques(cfg.chargeable) : []
  return uniqueTries([...fixes, ...chargeables])
}

/** Charges totales réellement composables (triées, sans doublon). */
export function chargesAtteignables(cfg: DisquesConfig | PlageConfig | HalteresConfig): number[] {
  if ('poidsFixes' in cfg) return chargesHalteres(cfg)
  if ('pasKg' in cfg) return chargesPlage(cfg)
  return chargesDisques(cfg)
}

/** Reproduit `rawEquipmentToCategory` (l'ordre des branches compte, comme le `when` Kotlin). */
export function rawEquipmentToCategory(raw: string): EquipmentCategory | null {
  if (raw.startsWith('Machine') || raw === 'Smith machine') return 'MACHINE'
  if (raw.startsWith('Câble') || raw === 'Corde') return 'CABLE'
  if (raw === 'Barre de traction') return 'BARRE_TRACTION'
  if (raw === 'Barres parallèles') return 'BARRE_TRACTION'
  if (raw.startsWith('Banc') || raw === 'GHD / Banc à lombaires') return 'BANC'
  if (raw === 'Kettlebell') return 'KETTLEBELL'
  if (raw.startsWith('Kettlebell') || raw.startsWith('Haltère')) return 'HALTERES'
  if (
    raw === 'Poids de corps / Haltère' ||
    raw === 'Poids de corps / Barre' ||
    raw === 'Poids de corps / Partenaire' ||
    raw === 'Poids de corps / Tapis'
  ) {
    return 'POIDS_DE_CORPS'
  }
  if (raw === 'Poids de corps') return 'POIDS_DE_CORPS'
  if (
    raw.startsWith('Barre') ||
    raw === 'Trap bar / Hex bar' ||
    raw === 'Landmine' ||
    raw === 'Disques de fonte'
  ) {
    return 'BARRE'
  }
  if (raw === 'Rack' || raw === 'Barre de tirage' || raw === 'Plateforme') return 'RACK'
  if (raw === 'Élastique') return 'ELASTIQUE'
  if (raw === 'Ab wheel' || raw === 'Wrist roller' || raw === 'Banc / appui' || raw === 'Banc / step') {
    return 'ACCESSOIRES'
  }
  return null
}

/** `null` pour les catégories sans inventaire structuré (pas simple, ex. MACHINE). */
export function chargesAtteignablesPour(inv: EquipmentInventaire, category: EquipmentCategory): number[] | null {
  switch (category) {
    case 'HALTERES': {
      const charges = chargesHalteres(inv.halteres)
      return charges.length > 0 ? charges : null
    }
    case 'BARRE':
      return inv.barre ? chargesDisques(inv.barre) : null
    case 'KETTLEBELL':
      return inv.kettlebell ? chargesPlage(inv.kettlebell) : null
    case 'CABLE':
      return inv.cable ? chargesPlage(inv.cable) : null
    default:
      return null
  }
}

/** Union des charges composables pour les catégories correspondant à l'équipement déclaré. */
export function chargesAtteignablesPourEquipement(inv: EquipmentInventaire, equipment: string[]): number[] {
  const charges = equipment.flatMap((raw) => {
    const categorie = rawEquipmentToCategory(raw)
    return categorie ? (chargesAtteignablesPour(inv, categorie) ?? []) : []
  })
  return uniqueTries(charges)
}

/**
 * Charge composable la plus proche si `chargeKg` n'en fait pas partie ; `null` si déjà composable
 * (à epsilon près) ou si la liste est vide. Égalité de distance : la première gagne (minByOrNull).
 */
export function chargeNonComposableHint(charges: number[], chargeKg: number, epsilon: number = 0.01): number | null {
  const eps = f32(epsilon)
  const cible = f32(chargeKg)
  if (charges.length === 0 || charges.some((c) => Math.abs(f32(c - cible)) < eps)) return null
  let meilleure = charges[0]
  for (const c of charges) {
    if (Math.abs(f32(c - cible)) < Math.abs(f32(meilleure - cible))) meilleure = c
  }
  return meilleure
}
