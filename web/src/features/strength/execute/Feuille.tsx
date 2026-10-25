import { useId, useRef, type ReactNode } from 'react'
import { usePiegeFocus } from '../usePiegeFocus'

interface Props {
  titre: string
  onFermer: () => void
  /** Libellé du bouton de fermeture (« Fermer » par défaut) */
  libelleFermer?: string
  children: ReactNode
}

// Feuille du bas (dialogue modal arrondi 28 px) pour les outils de l'exécution : minuteur, disques, montée en charge.
// Focus piégé, Échap et « Fermer » ferment, le focus revient au bouton d'origine. Présentation seule.
export function Feuille({ titre, onFermer, libelleFermer = 'Fermer', children }: Props) {
  const racine = useRef<HTMLDivElement>(null)
  const idTitre = useId()
  usePiegeFocus(racine, onFermer)
  return (
    <div className="dialogue__voile dialogue__voile--bas">
      <div ref={racine} className="dialogue dialogue--feuille" role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1}>
        <h2 id={idTitre}>{titre}</h2>
        {children}
        <div className="formulaire__ligne">
          <button type="button" className="bouton" onClick={onFermer}>
            {libelleFermer}
          </button>
        </div>
      </div>
    </div>
  )
}
