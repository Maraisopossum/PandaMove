import { z } from 'zod'
import type { DisquesConfig, EquipmentCategory, EquipmentInventaire, HalteresConfig, PlageConfig } from '../progression/types'
import { DisquesConfigSchema, PlageConfigSchema, type EquipmentConfigDto } from './schema'

// Import de « Mon matériel » : le plan ne produit pas de ligne user_settings mais un PATCH, appliqué
// sur l'inventaire existant avec les règles de DataImportManager.kt (section 9) :
//  - selectedCategories : écrasé ;
//  - pasParCategorie : fusionné clé par clé (setPas par entrée) ;
//  - halteres : remplacé (défaut si null dans le fichier) ;
//  - barre / kettlebell / cable : remplacés seulement s'ils sont fournis (sinon l'existant est gardé).

/** Patch matériel ; les clés barre/kettlebell/cable ne sont PRÉSENTES que si non nulles dans le fichier. */
export interface EquipmentPatch {
  selectedCategories: string[]
  pasParCategorie: Record<string, number>
  halteres: HalteresConfig
  barre?: DisquesConfig
  kettlebell?: PlageConfig
  cable?: PlageConfig
}

/** Forme stockée dans user_settings.equipment_json : inventaire + catégories + pas. */
export type EquipmentStocke = EquipmentInventaire & {
  selectedCategories: string[]
  pasParCategorie: Record<string, number>
}

const EQUIPMENT_CATEGORIES: readonly string[] = [
  'POIDS_DE_CORPS', 'HALTERES', 'BARRE', 'KETTLEBELL', 'MACHINE', 'CABLE', 'BANC', 'RACK',
  'BARRE_TRACTION', 'ELASTIQUE', 'ACCESSOIRES',
] satisfies readonly EquipmentCategory[]

const HALTERES_DEFAUT: HalteresConfig = { poidsFixes: [], chargeable: null }

/** Construit le patch depuis la config du fichier (catégories inconnues filtrées comme le Kotlin). */
export function construirePatch(config: EquipmentConfigDto): EquipmentPatch {
  const pas: Record<string, number> = {}
  for (const [cat, valeur] of Object.entries(config.pasParCategorie)) {
    if (EQUIPMENT_CATEGORIES.includes(cat)) pas[cat] = valeur
  }
  const patch: EquipmentPatch = {
    selectedCategories: config.selectedCategories.filter((c) => EQUIPMENT_CATEGORIES.includes(c)),
    pasParCategorie: pas,
    halteres: config.halteres ?? { ...HALTERES_DEFAUT },
  }
  if (config.barre) patch.barre = config.barre
  if (config.kettlebell) patch.kettlebell = config.kettlebell
  if (config.cable) patch.cable = config.cable
  return patch
}

// Lecture défensive de l'existant : chaque partie invalide est remplacée par sa valeur vide.
const lire = <T>(schema: z.ZodType<T>, valeur: unknown): T | null => {
  const r = schema.safeParse(valeur)
  return r.success ? r.data : null
}

function lireExistant(existant: unknown): Record<string, unknown> {
  let v = existant
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v)
    } catch {
      return {}
    }
  }
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

/**
 * Applique un patch matériel sur l'inventaire existant (objet, chaîne JSON de equipment_json,
 * ou null/malformé -> inventaire vide). Fonction pure : renvoie le nouvel objet à stocker.
 */
export function mergeEquipment(existant: unknown, patch: EquipmentPatch): EquipmentStocke {
  const base = lireExistant(existant)
  const pasExistants = lire(z.record(z.string(), z.number()), base.pasParCategorie) ?? {}
  return {
    halteres: patch.halteres,
    barre: patch.barre ?? lire(DisquesConfigSchema, base.barre),
    kettlebell: patch.kettlebell ?? lire(PlageConfigSchema, base.kettlebell),
    cable: patch.cable ?? lire(PlageConfigSchema, base.cable),
    selectedCategories: patch.selectedCategories,
    pasParCategorie: { ...pasExistants, ...patch.pasParCategorie },
  }
}
