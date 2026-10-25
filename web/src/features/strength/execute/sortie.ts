import { nombreLignes } from './lignesSeries'
import type { ExerciceVue } from './vue'

// Sortie de l'écran d'exécution : fonctions pures (textes et conditions de l'Android, InstanceExecuteScreen).

/** Au moins une série validée (Android : hasProgress). */
export function aProgression(exercices: ExerciceVue[]): boolean {
  return exercices.some((e) => e.series.some((s) => s.terminee))
}

/**
 * Toutes les séries prévues sont validées et aucune ligne ne reste non validée (Android : allDone, qui rend
 * `isCompleted` vrai pendant la séance et désactive le BackHandler). Faux sans exercice.
 */
export function toutesSeriesValidees(exercices: ExerciceVue[]): boolean {
  return exercices.length > 0 && exercices.every((e) => e.series.length >= nombreLignes(e) && e.series.every((s) => s.terminee))
}

/**
 * Le dialogue de sortie s'applique tant que la séance n'est pas terminée, sauf si tout est déjà validé : il n'y a
 * alors rien à perdre ni à annuler (comme l'Android, où le retour part directement).
 */
export function gardeSortieActive({ trouvee, terminee, exercices }: { trouvee: boolean; terminee: boolean; exercices: ExerciceVue[] }): boolean {
  return trouvee && !terminee && !toutesSeriesValidees(exercices)
}

export interface OptionsSortie {
  titre: string
  rester: string
  menu: string
  annuler: string
  aide: string
}

/** Libellés du dialogue « Quitter la séance ? » (res/values/strings.xml de l'Android). */
export function optionsSortie(progression: boolean): OptionsSortie {
  return {
    titre: 'Quitter la séance ?',
    rester: 'Rester ici',
    menu: progression ? 'Aller dans le menu' : 'Quitter sans enregistrer',
    annuler: 'Annuler la séance',
    aide: progression
      ? 'Vos séries sont enregistrées : la séance reste en cours, vous pourrez la reprendre.'
      : 'Aucune série n’est validée : la séance sera remise à zéro.',
  }
}
