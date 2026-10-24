import { useState } from 'react'
import { analyserSaisie, texteNombre } from './saisie'

// Texte brut d'un champ numérique : l'utilisateur voit exactement ce qu'il tape (« 2. », « 2,5 »),
// la valeur parsée est validée immédiatement (pas d'attente du blur : Enregistrer juste après la
// frappe prend bien en compte la dernière saisie). Quand `valeur` change depuis l'extérieur
// (chargement, réinitialisation), le texte est resynchronisé, sauf si le texte courant la produit déjà.
export function useChampNombre(valeur: number | null, facultatif: boolean, onCommit: (v: number | null) => void) {
  const [texte, setTexte] = useState(() => texteNombre(valeur))
  const [valeurVue, setValeurVue] = useState(valeur)

  if (!Object.is(valeurVue, valeur)) {
    setValeurVue(valeur)
    if (!Object.is(analyserSaisie(texte, facultatif).valeur, valeur)) setTexte(texteNombre(valeur))
  }

  const changer = (saisie: string) => {
    const analyse = analyserSaisie(saisie, facultatif)
    if (!analyse.accepte) return
    setTexte(saisie)
    onCommit(analyse.valeur)
  }
  return { texte, changer }
}
