import { useId, useRef } from 'react'
import { usePiegeFocus } from '../usePiegeFocus'

interface Props {
  texte: string
  erreur: string | null
  enCours: boolean
  onTexte: (texte: string) => void
  onValider: () => void
  onFermer: () => void
}

// Dialogue modal « Modifier le nom » (coins arrondis 28 px) : focus sur le champ, focus piégé, Échap ferme.
export function RenommerSeanceDialog({ texte, erreur, enCours, onTexte, onValider, onFermer }: Props) {
  const racine = useRef<HTMLDivElement>(null)
  const champ = useRef<HTMLInputElement>(null)
  const idTitre = useId()
  const idChamp = useId()
  const idAide = useId()
  usePiegeFocus(racine, onFermer, champ)
  return (
    <div className="dialogue__voile">
      <div ref={racine} className="dialogue" role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            onValider()
          }}
        >
          <h2 id={idTitre}>Modifier le nom</h2>
          <p id={idAide} className="dialogue__aide">
            Ne change que cette séance : la séance type garde son nom. Un champ vide rétablit le nom de la séance type.
          </p>
          <div className="formulaire__champ">
            <label htmlFor={idChamp}>Nom de la séance</label>
            <input ref={champ} id={idChamp} type="text" value={texte} aria-describedby={idAide} onChange={(e) => onTexte(e.target.value)} />
          </div>
          {erreur && (
            <p role="alert" className="import__erreur">
              {erreur}
            </p>
          )}
          <div className="formulaire__ligne">
            <button type="button" className="bouton" disabled={enCours} onClick={onFermer}>
              Annuler
            </button>
            <button type="submit" className="bouton bouton--principal" disabled={enCours}>
              Valider
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
