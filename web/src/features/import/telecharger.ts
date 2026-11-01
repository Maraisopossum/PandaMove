// Téléchargement et copie de texte générés localement (aucun envoi réseau).

/** Déclenche le téléchargement d'un fichier texte ; renvoie false si le navigateur ne le permet pas. */
export function telechargerTexte(nom: string, contenu: string, type: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([contenu], { type: `${type};charset=utf-8` }))
    const lien = document.createElement('a')
    lien.href = url
    lien.download = nom
    lien.rel = 'noopener'
    document.body.appendChild(lien)
    lien.click()
    lien.remove()
    // Révocation différée : certains navigateurs mobiles lisent le blob après le clic
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    return true
  } catch {
    return false
  }
}

/** Copie dans le presse-papiers ; renvoie false si l'API est absente ou refusée. */
export async function copierTexte(texte: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false
    await navigator.clipboard.writeText(texte)
    return true
  } catch {
    return false
  }
}
