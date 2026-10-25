import { useId, useRef, type ReactNode } from 'react'
import { usePiegeFocus } from '../usePiegeFocus'

interface Props {
  titre: string
  children: ReactNode
  libelleConfirmer: string
  libelleAnnuler: string
  /** La confirmation détruit quelque chose : bouton d'alerte, focus initial sur « annuler » */
  destructif?: boolean
  onConfirmer: () => void
  onAnnuler: () => void
}

// Dialogue de confirmation modal (coins arrondis 28 px). Le focus entre sur le choix non destructif,
// Tab reste piégé, Échap annule et le focus revient à l'élément d'origine.
export function DialogueConfirmation({ titre, children, libelleConfirmer, libelleAnnuler, destructif = true, onConfirmer, onAnnuler }: Props) {
  const racine = useRef<HTMLDivElement>(null)
  const boutonAnnuler = useRef<HTMLButtonElement>(null)
  const idTitre = useId()
  usePiegeFocus(racine, onAnnuler, boutonAnnuler)
  return (
    <div className="dialogue__voile">
      <div ref={racine} className="dialogue" role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1}>
        <h2 id={idTitre}>{titre}</h2>
        {children}
        <div className="formulaire__ligne">
          <button ref={boutonAnnuler} type="button" className="bouton" onClick={onAnnuler}>
            {libelleAnnuler}
          </button>
          <button type="button" className={destructif ? 'bouton bouton--alerte' : 'bouton bouton--principal'} onClick={onConfirmer}>
            {libelleConfirmer}
          </button>
        </div>
      </div>
    </div>
  )
}
