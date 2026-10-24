import { useId, useRef } from 'react'
import { usePiegeFocus } from './usePiegeFocus'

interface Props {
  nomSeance: string
  date: string
  erreur: string | null
  enCours: boolean
  onDate: (date: string) => void
  onConfirmer: () => void
  onFermer: () => void
}

// Dialogue modal d'affectation à une date (coins arrondis 28 px, comme AssignSessionDialogs Android).
// Focus piégé, Échap ferme, le focus revient au bouton d'origine.
export function AssignDialog({ nomSeance, date, erreur, enCours, onDate, onConfirmer, onFermer }: Props) {
  const racine = useRef<HTMLDivElement>(null)
  const idTitre = useId()
  const idDate = useId()
  usePiegeFocus(racine, onFermer)

  return (
    <div className="dialogue__voile">
      <div ref={racine} className="dialogue" role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onConfirmer()
          }}
        >
          <h2 id={idTitre}>Affecter « {nomSeance} »</h2>
          <div className="formulaire__champ">
            <label htmlFor={idDate}>Date de la séance</label>
            <input id={idDate} type="date" value={date} onChange={(e) => onDate(e.target.value)} required />
          </div>
          {erreur && (
            <p role="alert" className="import__erreur">
              {erreur}
            </p>
          )}
          <div className="formulaire__ligne">
            <button type="submit" className="bouton" disabled={enCours}>
              Confirmer
            </button>
            <button type="button" className="bouton" onClick={onFermer}>
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
