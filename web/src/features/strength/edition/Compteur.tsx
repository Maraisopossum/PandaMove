import { useId } from 'react'
import { useChampNombre } from '../useChampNombre'
import { avancerCompteur } from './pasCompteur'

interface Props {
  libelle: string
  valeur: number
  min?: number
  pas?: number
  /** Unité affichée après la valeur (« s », « kg ») ; purement visuelle */
  unite?: string
  onChange: (v: number) => void
}

// Compteur à la façon des steppers Android (− valeur +), avec saisie directe au clavier : boutons de 44 px.
export function Compteur({ libelle, valeur, min = 0, pas = 1, unite, onChange }: Props) {
  const id = useId()
  const { texte, changer } = useChampNombre(valeur, false, (v) => onChange(v ?? Number.NaN))
  return (
    <div className="compteur">
      <label htmlFor={id} className="compteur__libelle">
        {libelle}
      </label>
      <div className="compteur__boite">
        <button
          type="button"
          className="compteur__bouton"
          aria-label={`Diminuer : ${libelle}`}
          disabled={Number.isFinite(valeur) && valeur <= min}
          onClick={() => onChange(avancerCompteur(valeur, -1, pas, min))}
        >
          <span aria-hidden="true">−</span>
        </button>
        <input id={id} className="compteur__valeur" type="text" inputMode="decimal" value={texte} onChange={(e) => changer(e.target.value)} />
        {unite && (
          <span className="compteur__unite" aria-hidden="true">
            {unite}
          </span>
        )}
        <button type="button" className="compteur__bouton" aria-label={`Augmenter : ${libelle}`} onClick={() => onChange(avancerCompteur(valeur, 1, pas, min))}>
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </div>
  )
}
