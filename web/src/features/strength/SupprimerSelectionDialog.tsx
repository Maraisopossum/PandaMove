import { DialogueConfirmation } from './edition/DialogueConfirmation'
import { textesSuppressionSelection, type CompteSelection } from './suppressionSelection'

interface Props {
  compte: CompteSelection
  erreur: string | null
  onConfirmer: () => void
  onFermer: () => void
}

// Confirmation de la suppression d'une sélection (coins arrondis 28 px, focus initial sur « Annuler »).
export function SupprimerSelectionDialog({ compte, erreur, onConfirmer, onFermer }: Props) {
  const t = textesSuppressionSelection(compte)
  return (
    <DialogueConfirmation titre={t.titre} libelleConfirmer="Supprimer" libelleAnnuler="Annuler" onConfirmer={onConfirmer} onAnnuler={onFermer}>
      {t.lignes.map((l) => (
        <p key={l}>{l}</p>
      ))}
      {erreur && (
        <p role="alert" className="import__erreur">
          {erreur}
        </p>
      )}
    </DialogueConfirmation>
  )
}
