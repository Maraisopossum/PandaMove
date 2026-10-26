// Frontière Float 32 bits -> valeur décimale lisible.
//
// Le moteur de progression reproduit l'arithmétique Float de Kotlin : ses charges sont des doubles
// porteurs d'une valeur Float (ex. 17.69999885559082 pour 17.7f). Côté Android, Room stocke le Float
// et Float.toString affiche « 17.7 » (plus courte écriture décimale qui identifie le Float). Ici, on
// ramène la valeur à 7 chiffres significatifs (précision d'un Float) AVANT de l'écrire dans
// objectifs_progression ou de l'afficher : la base contient 17.7, jamais 17.69999885559082.
// Une valeur déjà décimale (22.5, 0.1 + 0.2 = 0.30000000000000004) est rendue lisible de la même façon.
export function chargeLisible(f: number): number {
  return Number(f.toPrecision(7))
}
