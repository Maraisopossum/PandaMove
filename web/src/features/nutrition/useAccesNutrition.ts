import { useMemo } from 'react'
import { lier } from '../../core/db/lierALaBase'
import {
  ajouterEntree, ajouterEntrees, alimentsFrequents, basculerFavori, creerAliment, enregistrerObjectifsNutrition, lireAliment, lireAlimentParCodeBarres, lireEntree,
  lireObjectifsNutrition, lireTotauxParJour, listerAliments, modifierAliment, modifierEntree, supprimerAliment, supprimerEntree,
} from '../../core/db/repos/nutrition'

/** Accès à la base des écrans Nutrition (dépôts liés à la base de l'application) : les composants n'appellent ni `getDb()` ni les dépôts. */
export function useAccesNutrition() {
  return useMemo(
    () => ({
      ajouterEntree: lier(ajouterEntree),
      ajouterEntrees: lier(ajouterEntrees),
      lireEntree: lier(lireEntree),
      modifierEntree: lier(modifierEntree),
      supprimerEntree: lier(supprimerEntree),
      creerAliment: lier(creerAliment),
      lireAliment: lier(lireAliment),
      lireAlimentParCodeBarres: lier(lireAlimentParCodeBarres),
      modifierAliment: lier(modifierAliment),
      supprimerAliment: lier(supprimerAliment),
      basculerFavori: lier(basculerFavori),
      listerAliments: lier(listerAliments),
      alimentsFrequents: lier(alimentsFrequents),
      lireTotauxParJour: lier(lireTotauxParJour),
      lireObjectifs: lier(lireObjectifsNutrition),
      enregistrerObjectifs: lier(enregistrerObjectifsNutrition),
    }),
    [],
  )
}
