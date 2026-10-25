// Fichier d'export : nom daté et téléchargement par le navigateur. Le fichier n'est jamais envoyé
// ailleurs : il est seulement remis au gestionnaire de téléchargements du navigateur.

// Délai avant de libérer l'URL du Blob : Safari iOS peut annuler un téléchargement dont l'URL est
// révoquée trop tôt (il la lit après le retour de click()).
export const DELAI_REVOCATION_MS = 60_000

const deuxChiffres = (n: number) => String(n).padStart(2, '0')

/** `pandamove-export-AAAA-MM-JJ.json`, à la date locale de l'utilisateur. */
export function nomFichierExport(maintenant: Date): string {
  const date = `${maintenant.getFullYear()}-${deuxChiffres(maintenant.getMonth() + 1)}-${deuxChiffres(maintenant.getDate())}`
  return `pandamove-export-${date}.json`
}

/** Télécharge `contenu` sous le nom `nom` (Blob JSON + lien <a download> temporaire). */
export function telechargerJson(nom: string, contenu: string): void {
  const url = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }))
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nom
  lien.rel = 'noopener'
  lien.style.display = 'none'
  document.body.appendChild(lien)
  try {
    lien.click()
  } finally {
    lien.remove()
    // Libération différée (voir DELAI_REVOCATION_MS)
    setTimeout(() => URL.revokeObjectURL(url), DELAI_REVOCATION_MS)
  }
}
