import { useId, useRef } from 'react'
import { usePiegeFocus } from '../strength/usePiegeFocus'

interface Props {
  nomSeance: string
  date: string
  enCours: boolean
  onDate: (date: string) => void
  onConfirmer: () => void
  onFermer: () => void
}

// Dialogue modal « Changer la date » (coins arrondis 28 px). Focus initial sur le champ date
// (non destructif), focus piégé, Échap ferme, le focus revient au bouton d'origine.
export function DateDialog({ nomSeance, date, enCours, onDate, onConfirmer, onFermer }: Props) {
  const racine = useRef<HTMLDivElement>(null)
  const champ = useRef<HTMLInputElement>(null)
  const idTitre = useId()
  const idDate = useId()
  usePiegeFocus(racine, onFermer, champ)

  return (
    <div className="dialogue__voile">
      <div ref={racine} className="dialogue" role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onConfirmer()
          }}
        >
          <h2 id={idTitre}>Changer la date de « {nomSeance} »</h2>
          <div className="formulaire__champ">
            <label htmlFor={idDate}>Nouvelle date</label>
            <input ref={champ} id={idDate} type="date" value={date} onChange={(e) => onDate(e.target.value)} required />
          </div>
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
