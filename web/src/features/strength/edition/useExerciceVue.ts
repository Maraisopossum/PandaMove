import { useMemo } from 'react'
import type { EquipmentStocke } from '../../../core/import/equipment'
import type { ExerciceDraft, TypeBloc } from '../draft'
import { aideSysteme, apercuMontee, avertissementsProgression, indiceCharge, optionsIncrement } from './progressionConfig'
import { reglesExercice } from './regles'
import { resumeExercice } from './resume'

// Tout ce que la carte d'un exercice affiche et qui se calcule (règles du contexte, résumé, indice de charge,
// aperçu de la montée) : les composants ne font que lire ce résultat.
export function useExerciceVue(e: ExerciceDraft, typeBloc: TypeBloc | null, materiel: EquipmentStocke) {
  return useMemo(
    () => ({
      regles: reglesExercice(typeBloc),
      resume: resumeExercice(e),
      indice: indiceCharge(e, materiel),
      options: optionsIncrement(e),
      apercu: e.progressionActivee ? apercuMontee(e, materiel) : null,
      avertissements: avertissementsProgression(e),
      aide: aideSysteme(e.systemeProgression),
    }),
    [e, typeBloc, materiel],
  )
}

export type ExerciceVue = ReturnType<typeof useExerciceVue>
