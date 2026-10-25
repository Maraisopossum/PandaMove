interface Props {
  nombre: number
  onSupprimer: () => void
  onQuitter: () => void
}

// Barre d'actions du mode sélection (Android : barre « N sélectionnés » avec corbeille). Collée en bas de l'écran pour
// rester à portée du pouce ; le nombre est annoncé aux lecteurs d'écran.
export function BarreSelection({ nombre, onSupprimer, onQuitter }: Props) {
  return (
    <div className="selection__barre" role="region" aria-label="Sélection">
      <p role="status" className="selection__nombre">
        {nombre === 0 ? 'Aucun élément sélectionné' : nombre === 1 ? '1 sélectionné' : `${nombre} sélectionnés`}
      </p>
      <button type="button" className="bouton bouton--alerte" disabled={nombre === 0} onClick={onSupprimer}>
        Supprimer
      </button>
      <button type="button" className="bouton" onClick={onQuitter}>
        Annuler la sélection
      </button>
    </div>
  )
}
