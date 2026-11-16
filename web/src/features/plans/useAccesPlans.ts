import { useMemo } from 'react'
import { getDb } from '../../core/db/client'
import { creerObjectifPlan, lireObjectifPlan, modifierObjectifPlan, supprimerObjectifPlan, type SaisieObjectif } from '../../core/db/repos/objectifsPlan'
import { appliquerDeplacements, type Deplacement } from './ajustements'

// Accès à la base des écrans Plans : les composants n'appellent ni `getDb()` ni les dépôts (architectureEcrans.test.ts).

export function useAccesPlans() {
  return useMemo(
    () => ({
      lireObjectif: (id: string) => lireObjectifPlan(getDb(), id),
      creerObjectif: (saisie: SaisieObjectif) => creerObjectifPlan(getDb(), saisie),
      modifierObjectif: (id: string, saisie: SaisieObjectif) => modifierObjectifPlan(getDb(), id, saisie),
      supprimerObjectif: (id: string) => supprimerObjectifPlan(getDb(), id),
      /** Objectif d'un jalon : modifie la ligne `id` si elle existe, sinon la crée (avec cet identifiant s'il est connu). */
      enregistrerObjectifDeJalon: async (id: string | null, saisie: SaisieObjectif) => {
        const base = getDb()
        if (id && (await lireObjectifPlan(base, id))) await modifierObjectifPlan(base, id, saisie)
        else await creerObjectifPlan(base, id ? { ...saisie, id } : saisie)
      },
      appliquerDeplacements: (liste: readonly Deplacement[], sens: 1 | -1) => appliquerDeplacements(getDb(), liste, sens),
    }),
    [],
  )
}
