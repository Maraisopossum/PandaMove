import { nombreLignes } from './lignesSeries'
import type { ExerciceVue } from './vue'

export interface MessageFin {
  titre: string
  lignes: string[]
}

const TEXTE_ANDROID = 'Les résultats seront sauvegardés et la séance marquée comme terminée.'

// Confirmation de fin de séance. Le texte de base est celui de l'Android (écran du rapport : « Terminer la séance ? »).
// Le web y ajoute deux précisions utiles : aucune série validée (rapport vide), et le nombre de séries prévues non
// validées, qui ne seront pas comptées. Fonction pure.
export function messageFin(exercices: ExerciceVue[]): MessageFin {
  const validees = exercices.reduce((n, e) => n + e.series.filter((s) => s.terminee).length, 0)
  const prevues = exercices.reduce((n, e) => n + nombreLignes(e), 0)
  const restantes = prevues - validees
  const lignes: string[] = []
  if (validees === 0) lignes.push('Aucune série n’est validée : le rapport sera vide.')
  lignes.push(TEXTE_ANDROID)
  if (validees > 0 && restantes > 0) {
    lignes.push(
      restantes === 1
        ? '1 série prévue n’est pas validée : elle ne sera pas comptée.'
        : `${restantes} séries prévues ne sont pas validées : elles ne seront pas comptées.`,
    )
  }
  return { titre: 'Terminer la séance ?', lignes }
}
