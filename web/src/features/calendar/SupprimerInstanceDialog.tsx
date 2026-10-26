import { useId, useRef } from 'react'
import { usePiegeFocus } from '../strength/usePiegeFocus'

interface Props {
  nomSeance: string
  enCours: boolean
  onConfirmer: () => void
  onFermer: () => void
}

// Confirmation de suppression d'une séance du calendrier (coins arrondis 28 px). Action destructive :
// le focus initial est sur « Annuler ». Focus piégé, Échap ferme, le focus revient au bouton d'origine.
export function SupprimerInstanceDialog({ nomSeance, enCours, onConfirmer, onFermer }: Props) {
  const racine = useRef<HTMLDivElement>(null)
  const boutonAnnuler = useRef<HTMLButtonElement>(null)
  const idTitre = useId()
  usePiegeFocus(racine, onFermer, boutonAnnuler)

  return (
    <div className="dialogue__voile">
      <div ref={racine} className="dialogue" role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1}>
        <h2 id={idTitre}>Supprimer cette séance du calendrier ?</h2>
        <p>« {nomSeance} »</p>
        <p>
          <strong>Cette action est définitive.</strong>
        </p>
        <div className="formulaire__ligne">
          <button type="button" className="bouton" disabled={enCours} onClick={onConfirmer}>
            Supprimer
          </button>
          <button ref={boutonAnnuler} type="button" className="bouton" onClick={onFermer}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
