import { useCallback } from 'react'
import { genererHtml, nomFichierRapport, texteResume, type RapportExport } from './exportRapport'
import { genererPng, nomFichierImage } from './imageRapport'

// Téléchargement d'un fichier produit dans le navigateur (lien temporaire cliqué puis retiré).
function enregistrerFichier(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nom
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  URL.revokeObjectURL(url)
}

// Partage du rapport depuis le navigateur : copier le résumé, télécharger un fichier HTML autonome,
// partager via la feuille native quand elle existe. Chaque action annonce son résultat (région vivante
// de l'écran). Rien n'est envoyé à un serveur : tout reste sur l'appareil.
export function useExportRapport(rapport: RapportExport | null, date: string, annoncer: (message: string) => void) {
  const peutPartager = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const copier = useCallback(async () => {
    if (!rapport) return
    try {
      await navigator.clipboard.writeText(texteResume(rapport))
      annoncer('Résumé copié.')
    } catch {
      annoncer('La copie a échoué. Utilisez « Télécharger le rapport (HTML) » à la place.')
    }
  }, [rapport, annoncer])

  const telecharger = useCallback(() => {
    if (!rapport) return
    try {
      enregistrerFichier(new Blob([genererHtml(rapport)], { type: 'text/html;charset=utf-8' }), nomFichierRapport(rapport.nom, date))
      annoncer('Rapport téléchargé.')
    } catch {
      annoncer('Le téléchargement a échoué.')
    }
  }, [rapport, date, annoncer])

  // Image PNG du rapport (Android : export image), dessinée sur un canvas sans bibliothèque
  const telechargerImage = useCallback(async () => {
    if (!rapport) return
    try {
      enregistrerFichier(await genererPng(rapport), nomFichierImage(rapport.nom, date))
      annoncer('Image téléchargée.')
    } catch (e) {
      console.warn('Création de l’image du rapport impossible', e)
      annoncer('La création de l’image a échoué. Utilisez « Télécharger le rapport (HTML) » à la place.')
    }
  }, [rapport, date, annoncer])

  const partager = useCallback(async () => {
    if (!rapport || !peutPartager) return
    try {
      await navigator.share({ title: `${rapport.nom} — rapport de séance`, text: texteResume(rapport) })
    } catch (e) {
      // Fermer la feuille de partage n'est pas une erreur
      if (!(e instanceof DOMException && e.name === 'AbortError')) annoncer('Le partage a échoué.')
    }
  }, [rapport, peutPartager, annoncer])

  return { copier, telecharger, telechargerImage, partager, peutPartager }
}
