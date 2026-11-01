import { useId } from 'react'
import { libelleDuree, libelleSecondes, type DetailDuree } from './dureeEstimee'

// Durée estimée de la séance : affichage CALCULÉ en direct (aucune saisie), avec le détail repliable.
export function AffichageDuree({ minutes, detail }: { minutes: number; detail: DetailDuree }) {
  const idAide = useId()
  return (
    <div className="duree-estimee">
      <p className="duree-estimee__ligne">
        <span>Durée estimée</span>
        <strong className="duree-estimee__valeur" aria-describedby={idAide}>
          {libelleDuree(minutes)}
        </strong>
      </p>
      <p id={idAide} className="aide">
        Calculée d’après les séries, répétitions et repos.
      </p>
      {detail.lignes.length > 0 && (
        <details className="plus-options">
          <summary>Voir le détail du calcul</summary>
          <ul className="duree-estimee__detail">
            {detail.lignes.map((l, i) => (
              <li key={`${i}-${l.libelle}`}>
                <span>{l.libelle}</span>
                <span>{libelleSecondes(l.sec)}</span>
              </li>
            ))}
            {detail.transitionsSec > 0 && (
              <li>
                <span>Transitions entre exercices</span>
                <span>{libelleSecondes(detail.transitionsSec)}</span>
              </li>
            )}
          </ul>
        </details>
      )}
    </div>
  )
}
