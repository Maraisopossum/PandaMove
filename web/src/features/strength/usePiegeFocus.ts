import { useEffect, useRef, type RefObject } from 'react'

const FOCALISABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Dialogue modal accessible : à l'ouverture le focus entre dans `conteneur` (sur `focusInitial` si fourni,
// ex. un bouton non destructif ; sinon sur le premier élément focalisable) ; Tab / Maj+Tab y restent
// piégés ; Échap appelle `onFermer` ; à la fermeture le focus revient à l'élément qui l'avait.
export function usePiegeFocus(
  conteneur: RefObject<HTMLElement | null>,
  onFermer: () => void,
  focusInitial?: RefObject<HTMLElement | null>,
) {
  // Dernière version de onFermer, sans réinstaller le piège (ce qui volerait le focus) à chaque rendu
  const fermer = useRef(onFermer)
  useEffect(() => {
    fermer.current = onFermer
  })

  useEffect(() => {
    const racine = conteneur.current
    if (!racine) return
    const precedent = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focalisables = () => Array.from(racine.querySelectorAll<HTMLElement>(FOCALISABLES))
    ;(focusInitial?.current ?? focalisables()[0] ?? racine).focus()

    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        fermer.current()
        return
      }
      if (e.key !== 'Tab') return
      const liste = focalisables()
      if (liste.length === 0) {
        e.preventDefault()
        return
      }
      const premier = liste[0]
      const dernier = liste[liste.length - 1]
      const actif = document.activeElement
      if (e.shiftKey && (actif === premier || !racine.contains(actif))) {
        e.preventDefault()
        dernier.focus()
      } else if (!e.shiftKey && (actif === dernier || !racine.contains(actif))) {
        e.preventDefault()
        premier.focus()
      }
    }
    document.addEventListener('keydown', surTouche)
    return () => {
      document.removeEventListener('keydown', surTouche)
      precedent?.focus()
    }
  }, [conteneur, focusInitial])
}
