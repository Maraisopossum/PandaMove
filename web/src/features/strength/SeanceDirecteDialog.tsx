import { useId, useRef } from 'react'
import { usePiegeFocus } from './usePiegeFocus'

interface Props {
  nom: string
  proposition: string
  erreur: string | null
  enCours: boolean
  onNom: (nom: string) => void
  onConfirmer: () => void
  onFermer: () => void
}

// Dialogue modal « Séance directe » (coins arrondis 28 px) : focus initial sur le champ du nom (non destructif),
// focus piégé, Échap ferme, le focus revient au bouton d'origine.
export function SeanceDirecteDialog({ nom, proposition, erreur, enCours, onNom, onConfirmer, onFermer }: Props) {
  const racine = useRef<HTMLDivElement>(null)
  const champ = useRef<HTMLInputElement>(null)
  const idTitre = useId()
  const idNom = useId()
  const idAide = useId()
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
          <h2 id={idTitre}>Séance directe</h2>
          <p id={idAide} className="dialogue__aide">
            Séance planifiée aujourd'hui, sans séance type associée. Vous ajoutez ses exercices pendant la séance ; elle apparaît dans « Séances programmées ».
          </p>
          <div className="formulaire__champ">
            <label htmlFor={idNom}>Nom de la séance</label>
            <input
              ref={champ}
              id={idNom}
              type="text"
              value={nom}
              placeholder={proposition}
              aria-describedby={idAide}
              onChange={(e) => onNom(e.target.value)}
            />
          </div>
          {erreur && (
            <p role="alert" className="import__erreur">
              {erreur}
            </p>
          )}
          <div className="formulaire__ligne">
            <button type="submit" className="bouton" disabled={enCours}>
              Créer et commencer
            </button>
            <button type="button" className="bouton" disabled={enCours} onClick={onFermer}>
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
