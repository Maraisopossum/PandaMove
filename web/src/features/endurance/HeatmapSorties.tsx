import { useMemo } from 'react'
import type { Sport } from '../../core/db/repos/sorties'
import { formaterCoordonnees, type CarteSorties, type LieuFrequente } from './carteSorties'
import { FondCarte, MentionOsm } from './FondCarte'
import { calculerVue, type Trace } from './mercatorCarte'
import { distanceKm } from './presentation'

interface Props {
  carte: CarteSorties | null
  /** Tracés de la période : dessinés en lignes sur le fond de carte. */
  traces: Trace[]
  lieux: LieuFrequente[]
  /** Sorties avec un tracé GPS dans la période. */
  sortiesGps: number
  /** Sorties de la période (toutes). */
  sorties: number
  sport: Sport
}

const L = 320
const H = 320

// Carte des sorties : tous les tracés de la période superposés sur un fond de carte OpenStreetMap ; chaque tracé est
// translucide, donc les passages répétés ressortent plus foncés. Les lieux de départ les plus fréquents sont numérotés sur la
// carte et listés dessous. Hors ligne, le fond disparaît et les tracés restent visibles.
export function HeatmapSorties({ carte, traces, lieux, sortiesGps, sorties, sport }: Props) {
  const vue = useMemo(() => calculerVue(traces, L, H, 28), [traces])
  return (
    <section aria-labelledby="se-carte" className="stats-endurance__carte">
      <h2 id="se-carte">Carte des sorties</h2>
      {!carte || !vue ? (
        <p className="aide">
          Aucun tracé GPS sur cette période. Importez des fichiers FIT de sorties en extérieur pour voir où vous passez le plus souvent.
        </p>
      ) : (
        <>
          <figure className="heatmap-sorties" aria-label={`Carte des ${sortiesGps} sorties avec tracé GPS`}>
            <div className="heatmap-sorties__cadre">
              <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label={`Tracés des sorties superposés, jusqu'à ${carte.max} passages dans la même zone`}>
                <rect width={L} height={H} className="heatmap-sorties__fond" />
                <FondCarte vue={vue} />
                {vue.lignes.map((points, i) => (
                  <polyline key={i} points={points} className="heatmap-sorties__trace" />
                ))}
                {lieux.slice(0, 3).map((l, i) => {
                  const [x, y] = vue.projeter(l.lat, l.lon)
                  return (
                    <g key={`${l.lat}|${l.lon}`} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} className="heatmap-sorties__repere">
                      <circle r={9} />
                      <text y={3.5} textAnchor="middle">
                        {i + 1}
                      </text>
                    </g>
                  )
                })}
              </svg>
              <MentionOsm />
            </div>
            <figcaption className="heatmap-sorties__legende">
              <span>1 passage</span>
              <span className="heatmap-sorties__degrade" aria-hidden="true" />
              <span>{carte.max} passages</span>
            </figcaption>
          </figure>
          <p className="aide">
            {sortiesGps} sortie{sortiesGps > 1 ? 's' : ''} avec tracé sur {sorties}. Zone la plus fréquentée : {formaterCoordonnees(carte.sommet.lat, carte.sommet.lon)} ({carte.sommet.n} sortie
            {carte.sommet.n > 1 ? 's' : ''}).
          </p>
          {lieux.length > 0 && (
            <>
              <h3 className="stats-endurance__sous-titre">Lieux de départ les plus fréquents</h3>
              <ol className="stats-endurance__lieux">
                {lieux.map((l, i) => (
                  <li key={`${l.lat}|${l.lon}`}>
                    <span className="stats-endurance__rang" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span>
                      <strong>
                        {l.sorties} départ{l.sorties > 1 ? 's' : ''}
                      </strong>{' '}
                      · {distanceKm(l.distanceM)} km {sport === 'course' ? 'courus' : 'roulés'}
                      <br />
                      <span className="outils__chiffre-detail">{formaterCoordonnees(l.lat, l.lon)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </section>
  )
}
