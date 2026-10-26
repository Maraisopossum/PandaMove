// Types d'inventaire matériel (miroir de EquipmentInventory.kt / EquipmentCategory.kt).

/** Barre/poignée + disques. `disques` : poids unitaire (kg, clé en chaîne) -> quantité totale possédée. */
export interface DisquesConfig {
  barreKg: number
  disques: Record<string, number>
}

/** Matériel modulable à crans (kettlebell ajustable, poulie/câble). */
export interface PlageConfig {
  minKg: number
  maxKg: number
  pasKg: number
}

/** Haltères : poids fixes possédés et/ou haltères chargeables. */
export interface HalteresConfig {
  poidsFixes: number[]
  chargeable: DisquesConfig | null
}

export interface EquipmentInventaire {
  halteres: HalteresConfig
  barre: DisquesConfig | null
  kettlebell: PlageConfig | null
  cable: PlageConfig | null
}

export type EquipmentCategory =
  | 'POIDS_DE_CORPS'
  | 'HALTERES'
  | 'BARRE'
  | 'KETTLEBELL'
  | 'MACHINE'
  | 'CABLE'
  | 'BANC'
  | 'RACK'
  | 'BARRE_TRACTION'
  | 'ELASTIQUE'
  | 'ACCESSOIRES'
