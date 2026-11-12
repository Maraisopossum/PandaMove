import type { Sport } from '../../core/db/repos/sorties'
import { formaterCoordonnees, type CarteSorties, type LieuFrequente } from './carteSorties'
import { distanceKm } from './presentation'

interface Props {
  carte: CarteSorties | null
  lieux: LieuFrequente[]
  /** Sorties avec un tracé GPS dans la période. */
  sortiesGps: number
  /** Sorties de la période (toutes). */
  sorties: number
  sport: Sport
}

// Heatmap des sorties : cellules colorées selon le nombre de sorties qui les traversent (pas de fond de carte routière :
// la figure fonctionne hors ligne). Dessous : les lieux de départ les plus fréquentés. La couleur n'est jamais seule : chaque
// cellule a son <title>, et la liste des lieux donne les chiffres.
export function HeatmapSorties({ carte, lieux, sortiesGps, sorties, sport }: Props) {
  return (
    <section aria-labelledby="se-carte" className="stats-endurance__carte">
      <h2 id="se-carte">Carte des sorties</h2>
      {!carte ? (
        <p className="aide">
          Aucun tracé GPS sur cette période. Importez des fichiers FIT de sorties en extérieur pour voir où vous passez le plus souvent.
        </p>
      ) : (
        <>
          <figure className="heatmap-sorties" aria-label={`Heatmap des ${sortiesGps} sorties avec tracé GPS`}>
            <svg viewBox={`0 0 ${carte.largeur} ${carte.hauteur}`} role="img" aria-label={`Zones parcourues, jusqu'à ${carte.max} sorties dans la même zone`}>
              <rect width={carte.largeur} height={carte.hauteur} className="heatmap-sorties__fond" />
              {carte.cellules.map((c) => (
                <rect key={`${c.x}|${c.y}`} x={c.x} y={c.y} width={carte.cote} height={carte.cote} rx={carte.cote * 0.25} className={`heatmap-sorties__cellule heatmap-sorties__cellule--${c.niveau}`}>
                  <title>{`${c.n} sortie${c.n > 1 ? 's' : ''} dans cette zone`}</title>
                </rect>
              ))}
            </svg>
            <figcaption className="heatmap-sorties__legende">
              <span>1 sortie</span>
              <span className="heatmap-sorties__echelle" aria-hidden="true">
                {[1, 2, 3, 4].map((n) => (
                  <i key={n} className={`heatmap-sorties__cellule--${n}`} />
                ))}
              </span>
              <span>{carte.max} sorties</span>
            </figcaption>
          </figure>
          <p className="aide">
            {sortiesGps} sortie{sortiesGps > 1 ? 's' : ''} avec tracé sur {sorties}. Zone la plus fréquentée : {formaterCoordonnees(carte.sommet.lat, carte.sommet.lon)} ({carte.sommet.n} sortie
            {carte.sommet.n > 1 ? 's' : ''}, cellules d'environ {carte.celluleM} m).
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
