import { useCallback } from 'react'
import { genererHtml, nomFichierRapport, texteResume, type RapportExport } from './exportRapport'

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
      const blob = new Blob([genererHtml(rapport)], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const lien = document.createElement('a')
      lien.href = url
      lien.download = nomFichierRapport(rapport.nom, date)
      document.body.appendChild(lien)
      lien.click()
      lien.remove()
      URL.revokeObjectURL(url)
      annoncer('Rapport téléchargé.')
    } catch {
      annoncer('Le téléchargement a échoué.')
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

  return { copier, telecharger, partager, peutPartager }
}
