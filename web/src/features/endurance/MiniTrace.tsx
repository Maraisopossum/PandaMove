import type { Sortie } from '../../core/db/repos/sorties'
import { courbeSerie, lireSerie, lireTrace, projeterTrace } from './statsSorties'

const T = 84

// Vignette d'une sortie dans la liste : son tracé GPS, sinon (salle, saisie sans fichier) la courbe de puissance ou de
// vitesse, sinon un picto neutre. Décoratif : les chiffres de la carte portent l'information.
export function MiniTrace({ sortie }: { sortie: Pick<Sortie, 'trace' | 'serie' | 'sport'> }) {
  const points = projeterTrace(lireTrace(sortie), T, T, 12)
  const courbe = points ? null : (courbeSerie(lireSerie(sortie), 'w', T, T - 20) ?? courbeSerie(lireSerie(sortie), 'v', T, T - 20))
  const liste = points.split(' ')
  const [dx, dy] = (liste[0] ?? '').split(',')
  return (
    <svg className="sorties__vignette" width={T} height={T} viewBox={`0 0 ${T} ${T}`} aria-hidden="true" focusable="false">
      {points ? (
        <>
          <polyline points={points} className="sorties__vignette-ligne" />
          <circle cx={dx} cy={dy} r={4} className="sorties__vignette-depart" />
        </>
      ) : courbe ? (
        <g transform="translate(0 10)">
          <polyline points={courbe.points} className="sorties__vignette-ligne" />
        </g>
      ) : (
        <path d="M14 58h22l8-22 10 30 8-18h8" className="sorties__vignette-ligne" />
      )}
    </svg>
  )
}
