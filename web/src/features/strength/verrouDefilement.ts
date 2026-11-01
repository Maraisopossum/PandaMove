// Verrou du défilement de la page pendant qu'un dialogue modal est ouvert : sans lui, un geste dans le dialogue
// qui atteint le bout de sa liste « chaîne » vers la page derrière (sur téléphone, la page défile à la place du
// dialogue). Compteur : plusieurs dialogues empilés ne restituent le défilement que quand le dernier se ferme.
let verrous = 0
let overflowOrigine = ''

/** Verrouille le défilement de la page ; renvoie la fonction qui libère CE verrou (idempotente). */
export function verrouillerDefilement(): () => void {
  if (verrous === 0) {
    overflowOrigine = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  verrous += 1
  let libere = false
  return () => {
    if (libere) return
    libere = true
    verrous -= 1
    if (verrous === 0) document.body.style.overflow = overflowOrigine
  }
}
