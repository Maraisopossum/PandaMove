import { useId, useRef } from 'react'
import { usePiegeFocus } from '../usePiegeFocus'
import type { OptionsSortie } from './sortie'

interface Props {
  options: OptionsSortie
  enCours: boolean
  onRester: () => void
  onMenu: () => void
  onAnnuler: () => void
}

// Dialogue « Quitter la séance ? » (Android : Rester ici / Aller dans le menu / Annuler la séance), coins arrondis 28 px.
// Le focus entre sur « Rester ici » (choix non destructif), Tab reste piégé, Échap = rester.
export function DialogueSortie({ options, enCours, onRester, onMenu, onAnnuler }: Props) {
  const racine = useRef<HTMLDivElement>(null)
  const boutonRester = useRef<HTMLButtonElement>(null)
  const idTitre = useId()
  const idAide = useId()
  usePiegeFocus(racine, onRester, boutonRester)
  return (
    <div className="dialogue__voile">
      <div ref={racine} className="dialogue" role="dialog" aria-modal="true" aria-labelledby={idTitre} aria-describedby={idAide} tabIndex={-1}>
        <h2 id={idTitre}>{options.titre}</h2>
        <p id={idAide} className="dialogue__aide">
          {options.aide}
        </p>
        <div className="dialogue__choix">
          <button ref={boutonRester} type="button" className="bouton bouton--principal" onClick={onRester}>
            {options.rester}
          </button>
          <button type="button" className="bouton" disabled={enCours} onClick={onMenu}>
            {options.menu}
          </button>
          <button type="button" className="bouton bouton--alerte" disabled={enCours} onClick={onAnnuler}>
            {options.annuler}
          </button>
        </div>
      </div>
    </div>
  )
}
