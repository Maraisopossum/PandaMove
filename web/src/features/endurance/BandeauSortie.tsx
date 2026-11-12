import { useMemo } from 'react'
import type { Sortie } from '../../core/db/repos/sorties'
import { FondCarte, MentionOsm } from './FondCarte'
import { calculerVue } from './mercatorCarte'
import { formaterDate } from './presentation'
import { lireTrace } from './statsSorties'

const L = 390
const H = 230

// Bandeau du haut d'une sortie : tracé sur un fond de carte OpenStreetMap (hors ligne, le fond disparaît et le tracé reste),
// titre et date en surimpression. Sans tracé (salle, saisie manuelle), un simple en-tête texte.
export function BandeauSortie({ sortie }: { sortie: Pick<Sortie, 'trace' | 'titre' | 'date' | 'enSalle'> }) {
  const trace = useMemo(() => lireTrace(sortie), [sortie])
  // Le tracé occupe le haut du bandeau : le titre est dessous, sur le dégradé
  const vue = useMemo(() => calculerVue(trace.length >= 2 ? [trace] : [], L, H, 44), [trace])
  const date = formaterDate(sortie.date) + (sortie.enSalle ? ' · en salle' : '')
  if (!vue) {
    return (
      <header className="sorties__entete">
        <p className="sorties__surtitre">{date}</p>
        <h1 className="titre-ecran">{sortie.titre}</h1>
      </header>
    )
  }
  const liste = vue.lignes[0].split(' ')
  const [dx, dy] = liste[0].split(',')
  const [fx, fy] = (liste.at(-1) ?? '').split(',')
  return (
    <header className="sorties__bandeau">
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label="Tracé du parcours">
        <rect width={L} height={H} className="sorties__bandeau-fond" />
        <FondCarte vue={vue} />
        <polyline points={vue.lignes[0]} className="sorties__bandeau-contour" />
        <polyline points={vue.lignes[0]} className="sorties__bandeau-ligne" />
        <circle cx={dx} cy={dy} r={7} className="sorties__bandeau-depart" />
        <circle cx={fx} cy={fy} r={5} className="sorties__bandeau-arrivee" />
      </svg>
      <MentionOsm />
      <div className="sorties__bandeau-texte">
        <p className="sorties__bandeau-date">{date}</p>
        <h1>{sortie.titre}</h1>
      </div>
    </header>
  )
}
