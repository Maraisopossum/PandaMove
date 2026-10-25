import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'

// Menu d'actions (motif WAI-ARIA « menu button ») : ouverture au clic ou à la flèche, navigation aux flèches
// (circulaire), Début / Fin, Échap ferme et rend le focus au bouton, Tab ferme, un clic ailleurs ferme.
// Les refs sont créées par le composant (conteneur, bouton, liste) et passées ici.
export interface RefsMenu {
  conteneur: RefObject<HTMLDivElement | null>
  bouton: RefObject<HTMLButtonElement | null>
  liste: RefObject<HTMLUListElement | null>
}

export function useMenu({ conteneur, bouton, liste }: RefsMenu) {
  const [ouvert, setOuvert] = useState(false)
  // Entrée à focaliser à l'ouverture : la première (clic, flèche bas) ou la dernière (flèche haut)
  const depart = useRef<'premier' | 'dernier'>('premier')

  const entrees = () => Array.from(liste.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])

  // À l'ouverture, le focus entre dans le menu (première ou dernière entrée selon la touche utilisée)
  useEffect(() => {
    if (!ouvert) return
    const e = Array.from(liste.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    ;(depart.current === 'dernier' ? e[e.length - 1] : e[0])?.focus()
  }, [ouvert, liste])

  useEffect(() => {
    if (!ouvert) return
    const dehors = (ev: MouseEvent) => {
      if (conteneur.current && !conteneur.current.contains(ev.target as Node)) setOuvert(false)
    }
    document.addEventListener('mousedown', dehors)
    return () => document.removeEventListener('mousedown', dehors)
  }, [ouvert, conteneur])

  const ouvrir = useCallback((position: 'premier' | 'dernier' = 'premier') => {
    depart.current = position
    setOuvert(true)
  }, [])

  // `rendreFocus` : le focus revient au bouton (Échap, choix d'une action) ; sinon on le laisse où il va (Tab, clic ailleurs)
  const fermer = useCallback((rendreFocus: boolean) => {
    setOuvert(false)
    if (rendreFocus) bouton.current?.focus()
  }, [bouton])

  const basculer = useCallback(() => (ouvert ? fermer(false) : ouvrir('premier')), [ouvert, fermer, ouvrir])

  const surToucheBouton = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        ouvrir('premier')
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        ouvrir('dernier')
      }
    },
    [ouvrir],
  )

  const surToucheListe = (e: KeyboardEvent) => {
    const items = entrees()
    const i = items.indexOf(document.activeElement as HTMLElement)
    const aller = (n: number) => {
      e.preventDefault()
      items[(n + items.length) % items.length]?.focus()
    }
    if (e.key === 'ArrowDown') aller(i + 1)
    else if (e.key === 'ArrowUp') aller(i - 1)
    else if (e.key === 'Home') aller(0)
    else if (e.key === 'End') aller(items.length - 1)
    else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      fermer(true)
    } else if (e.key === 'Tab') fermer(false)
  }

  // Choix d'une action : le menu se ferme, le focus revient au bouton AVANT l'action (un dialogue ouvert par
  // l'action mémorise ainsi un élément qui existe encore pour lui rendre le focus à sa fermeture)
  const choisir = useCallback(
    (action: () => void) => {
      fermer(true)
      action()
    },
    [fermer],
  )

  return { ouvert, basculer, surToucheBouton, surToucheListe, choisir }
}
