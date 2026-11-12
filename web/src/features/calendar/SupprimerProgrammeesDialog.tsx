import { useId, useRef } from 'react'
import { usePiegeFocus } from '../../core/ui/usePiegeFocus'

interface Props {
  /** Nombre de séances de cardio programmées qui seraient supprimées. */
  nombre: number
  enCours: boolean
  onConfirmer: () => void
  onFermer: () => void
}

// Confirmation de la suppression de toutes les séances de cardio programmées. Action destructive : le focus initial est
// sur « Annuler ». Sans séance à supprimer, le dialogue le dit simplement.
export function SupprimerProgrammeesDialog({ nombre, enCours, onConfirmer, onFermer }: Props) {
  const racine = useRef<HTMLDivElement>(null)
  const boutonAnnuler = useRef<HTMLButtonElement>(null)
  const idTitre = useId()
  usePiegeFocus(racine, onFermer, boutonAnnuler)

  return (
    <div className="dialogue__voile">
      <div ref={racine} className="dialogue" role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1}>
        <h2 id={idTitre}>Supprimer les séances programmées ?</h2>
        {nombre === 0 ? (
          <p>Aucune séance de cardio programmée à supprimer.</p>
        ) : (
          <>
            <p>
              {nombre} séance{nombre > 1 ? 's' : ''} de course et de vélo, de toutes les dates, {nombre > 1 ? 'seront supprimées' : 'sera supprimée'}. Les séances déjà
              validées et le renforcement sont conservés.
            </p>
            <p>
              <strong>Cette action est définitive.</strong>
            </p>
          </>
        )}
        <div className="formulaire__ligne">
          {nombre > 0 && (
            <button type="button" className="bouton" disabled={enCours} onClick={onConfirmer}>
              Tout supprimer
            </button>
          )}
          <button ref={boutonAnnuler} type="button" className="bouton" onClick={onFermer}>
            {nombre === 0 ? 'Fermer' : 'Annuler'}
          </button>
        </div>
      </div>
    </div>
  )
}
