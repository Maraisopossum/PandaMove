import type { EquipmentStocke } from '../../../core/import/equipment'
import { chargesAtteignablesPourEquipement, rawEquipmentToCategory } from '../../../core/progression/inventory'
import { avancerCompteur } from '../edition/pasCompteur'

// Pas des boutons − / + du tableau de séries (maquette « Steppers + / − »). Fonctions pures.

export const PAS_REPOS_SEC = 5
export const PAS_CHARGE_DEFAUT_KG = 2.5
// Tolérance de comparaison des charges (écart de flottant 32 bits du portage de l'inventaire)
const EPSILON = 0.01

// Répétitions, durée et repos : un pas fixe, jamais sous `min`, sans dérive de flottant.
export function valeurSuivante(valeur: number | null, sens: -1 | 1, pas: number, min: number): number {
  return avancerCompteur(valeur ?? Number.NaN, sens, pas, min)
}

// Pas simple d'un exercice : celui déclaré pour sa catégorie de matériel (« Mon matériel »), sinon 2,5 kg.
function pasSimple(equipement: string[], materiel: EquipmentStocke): number {
  for (const brut of equipement) {
    const categorie = rawEquipmentToCategory(brut)
    const pas = categorie ? materiel.pasParCategorie[categorie] : undefined
    if (pas !== undefined && pas > 0) return pas
  }
  return PAS_CHARGE_DEFAUT_KG
}

// Charge après un appui sur − / + : avec un inventaire structuré (barre + disques, haltères, câble),
// la charge réellement composable la plus proche dans le sens demandé ; sinon (ou au-delà des extrêmes)
// un pas simple. Jamais sous 0.
export function chargeSuivante(valeur: number | null, sens: -1 | 1, equipement: string[], materiel: EquipmentStocke): number {
  const base = valeur !== null && Number.isFinite(valeur) ? valeur : 0
  const charges = chargesAtteignablesPourEquipement(materiel, equipement)
  const voisine = sens === 1 ? charges.find((c) => c > base + EPSILON) : [...charges].reverse().find((c) => c < base - EPSILON)
  if (voisine !== undefined) return voisine
  return avancerCompteur(base, sens, pasSimple(equipement, materiel), 0)
}
