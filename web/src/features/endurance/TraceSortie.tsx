import type { Sortie } from '../../core/db/repos/sorties'
import { courbeSerie, lireSerie, lireTrace, projeterTrace } from './statsSorties'

const COURBES = [
  { champ: 'fc', libelle: 'Fréquence cardiaque', unite: 'bpm' },
  { champ: 'w', libelle: 'Puissance', unite: 'W' },
  { champ: 'a', libelle: 'Altitude', unite: 'm' },
] as const

// Tracé GPS (SVG, sans fond de carte : fonctionne hors ligne) et courbes de la sortie importée. Rien si la sortie est saisie à la main.
export function TraceSortie({ sortie }: { sortie: Pick<Sortie, 'trace' | 'serie'> }) {
  const trace = lireTrace(sortie)
  const serie = lireSerie(sortie)
  const points = projeterTrace(trace, 320, 220)
  const courbes = COURBES.flatMap((c) => {
    const courbe = courbeSerie(serie, c.champ, 320, 70)
    return courbe ? [{ ...c, courbe }] : []
  })
  if (!points && courbes.length === 0) return null
  const liste = points.split(' ')
  const [dx, dy] = liste[0].split(',')
  const [fx, fy] = (liste.at(-1) ?? '').split(',')
  return (
    <section className="sorties__trace" aria-label="Tracé et courbes">
      {points && (
        <svg viewBox="0 0 320 220" role="img" aria-label="Tracé du parcours">
          <polyline points={points} fill="none" className="sorties__trace-ligne" />
          <circle cx={dx} cy={dy} r={5} className="sorties__trace-depart" />
          <circle cx={fx} cy={fy} r={5} className="sorties__trace-arrivee" />
        </svg>
      )}
      {courbes.map(({ champ, libelle, unite, courbe }) => (
        <figure key={champ} className="sorties__courbe">
          <figcaption>
            {libelle}{' '}
            <span className="outils__chiffre-detail">
              {courbe.min} à {courbe.max} {unite}
            </span>
          </figcaption>
          <svg viewBox="0 0 320 70" role="img" aria-label={`${libelle} de ${courbe.min} à ${courbe.max} ${unite}`}>
            <polyline points={courbe.points} fill="none" className="sorties__courbe-ligne" />
          </svg>
        </figure>
      ))}
    </section>
  )
}
