import type { Sortie } from '../../core/db/repos/sorties'
import { formaterDate } from './presentation'
import { lireTrace, projeterTrace } from './statsSorties'

const L = 390
const H = 220

// Bandeau du haut d'une sortie : tracé sur un fond de repères discrets (sans carte routière : hors ligne), titre et date en
// surimpression. Sans tracé (salle, saisie manuelle), un simple en-tête texte.
export function BandeauSortie({ sortie }: { sortie: Pick<Sortie, 'trace' | 'titre' | 'date' | 'enSalle'> }) {
  const points = projeterTrace(lireTrace(sortie), L, H - 40, 28)
  const liste = points.split(' ')
  const [dx, dy] = (liste[0] ?? '').split(',')
  const [fx, fy] = (liste.at(-1) ?? '').split(',')
  const date = formaterDate(sortie.date) + (sortie.enSalle ? ' · en salle' : '')
  if (!points) {
    return (
      <header className="sorties__entete">
        <p className="sorties__surtitre">{date}</p>
        <h1 className="titre-ecran">{sortie.titre}</h1>
      </header>
    )
  }
  return (
    <header className="sorties__bandeau">
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label="Tracé du parcours" >
        <path d="M0 50 Q90 34 160 60 T390 44" className="sorties__bandeau-repere sorties__bandeau-repere--large" />
        <path d="M0 170 Q120 142 200 176 T390 150" className="sorties__bandeau-repere" />
        <path d="M120 0 Q140 110 110 220" className="sorties__bandeau-repere" />
        <path d="M300 0 Q280 100 320 220" className="sorties__bandeau-repere" />
        <g transform="translate(0 6)">
          <polyline points={points} className="sorties__bandeau-contour" />
          <polyline points={points} className="sorties__bandeau-ligne" />
          <circle cx={dx} cy={dy} r={7} className="sorties__bandeau-depart" />
          <circle cx={fx} cy={fy} r={5} className="sorties__bandeau-arrivee" />
        </g>
      </svg>
      <div className="sorties__bandeau-texte">
        <p className="sorties__bandeau-date">{date}</p>
        <h1>{sortie.titre}</h1>
      </div>
    </header>
  )
}
