import { useId, useRef } from 'react'
import { usePiegeFocus } from './usePiegeFocus'

interface Props {
  nomSeance: string
  erreur: string | null
  enCours: boolean
  onConfirmer: () => void
  onFermer: () => void
}

// Dialogue modal « Lancer « {nom} » maintenant ? » (coins arrondis 28 px). Focus piégé sur « Lancer »,
// Échap / Annuler ferment, le focus revient à la carte d'origine.
export function LancerDialog({ nomSeance, erreur, enCours, onConfirmer, onFermer }: Props) {
  const racine = useRef<HTMLDivElement>(null)
  const boutonLancer = useRef<HTMLButtonElement>(null)
  const idTitre = useId()
  usePiegeFocus(racine, onFermer, boutonLancer)

  return (
    <div className="dialogue__voile">
      <div ref={racine} className="dialogue" role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1}>
        <h2 id={idTitre}>Lancer « {nomSeance} » maintenant ?</h2>
        <p>La séance sera planifiée aujourd'hui et le chronomètre démarrera tout de suite.</p>
        {erreur && (
          <p role="alert" className="import__erreur">
            {erreur}
          </p>
        )}
        <div className="formulaire__ligne">
          <button ref={boutonLancer} type="button" className="bouton" disabled={enCours} onClick={onConfirmer}>
            Lancer
          </button>
          <button type="button" className="bouton" disabled={enCours} onClick={onFermer}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
