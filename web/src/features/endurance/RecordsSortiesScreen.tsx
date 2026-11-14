import { Link } from 'react-router'
import { dateIsoLocale } from '../../core/common/dates'
import type { Sport } from '../../core/db/repos/sorties'
import { CHEMIN_SPORT } from './chemins'
import { formaterDate, formaterDuree } from './presentation'
import { ancienneteRecord, courbeEvolution, valeurAutre } from './presentationRecords'
import { useRecordsSorties, useToutesLesSorties } from './useRecordsSorties'

const MAINTENANT = () => new Date()
const allure = (secParKm: number) => `${formaterDuree(secParKm)} /km`

// Records d'un sport (`/running/records`, `/cycling/records`) : meilleurs temps par distance et évolution du 5 km (course) ou
// meilleurs efforts de puissance (vélo), puis les autres records. Calculs dans recordsSorties.ts.
export default function RecordsSortiesScreen({ sport, maintenant = MAINTENANT }: { sport: Sport; maintenant?: () => Date }) {
  const { sorties, charge, erreur } = useToutesLesSorties()
  const { records } = useRecordsSorties(sorties, sport)
  const aujourdhui = dateIsoLocale(maintenant())
  const chemin = CHEMIN_SPORT[sport]
  const courbe = courbeEvolution(records.evolution5k)
  const evolution = records.evolution5k.length >= 2 ? records.evolution5k[0].dureeS - records.evolution5k[records.evolution5k.length - 1].dureeS : null

  return (
    <div className={`sorties sorties--${sport}`}>
      <header>
        <p className="sorties__retour-haut">
          <Link to={chemin} className="sorties__semaine-lien">
            ← {sport === 'course' ? 'Course' : 'Vélo'}
          </Link>
        </p>
        <h1 className="titre-ecran">Records</h1>
      </header>

      <nav aria-label="Sport" className="sorties__bascule">
        <Link to="/running/records" aria-current={sport === 'course' ? 'page' : undefined}>
          Course
        </Link>
        <Link to="/cycling/records" aria-current={sport === 'velo' ? 'page' : undefined}>
          Vélo
        </Link>
      </nav>

      {erreur && <p role="alert">{erreur}</p>}
      {!charge && !erreur && <p role="status">Chargement…</p>}

      {charge && !erreur && sport === 'course' && (
        <>
          <section className="sorties__carte-records" aria-labelledby="rec-distances">
            <div className="sorties__semaine-tete">
              <h2 id="rec-distances">Meilleurs temps</h2>
              <span className="aide">toutes sorties</span>
            </div>
            <ul className="sorties__records-table">
              {records.distances.map(({ definition, record }) => {
                const age = record ? ancienneteRecord(record.date, aujourdhui) : null
                return (
                  <li key={definition.id}>
                    <span className="sorties__rt-distance">{definition.libelle}</span>
                    <span className="sorties__rt-corps">
                      <strong>{record ? formaterDuree(record.dureeS) : '—'}</strong>
                      <span>{record ? `${formaterDate(record.date)} · ${allure(record.allure)}` : 'Aucune sortie assez longue ou détaillée'}</span>
                    </span>
                    {age && <span className={age.recent ? 'sorties__rt-badge sorties__rt-badge--nouveau' : 'sorties__rt-badge'}>{age.texte}</span>}
                  </li>
                )
              })}
            </ul>
            <p className="aide">
              Calculés sur le meilleur tronçon continu de chaque sortie importée d’un fichier (trace et vitesse détaillées). Une sortie saisie
              à la main ne compte que pour sa distance totale.
            </p>
          </section>

          {courbe && (
            <section className="sorties__carte-records" aria-labelledby="rec-evolution">
              <div className="sorties__semaine-tete">
                <h2 id="rec-evolution">Évolution sur 5 km</h2>
                {evolution !== null && evolution > 0 && <span className="sorties__ecart sorties__ecart--hausse">−{formaterDuree(evolution)} depuis {courbe.points[0].mois}</span>}
              </div>
              <svg
                className="sorties__evolution"
                viewBox={`0 0 ${courbe.largeur} ${courbe.hauteur}`}
                role="img"
                aria-label={`Meilleur 5 km par mois : ${courbe.points.map((p) => `${p.mois} ${formaterDuree(p.dureeS)}`).join(', ')}`}
              >
                {courbe.graduationsY.map((t) => (
                  <g key={t.y} aria-hidden="true">
                    <line x1={courbe.zone.gauche} x2={courbe.largeur - courbe.zone.droite} y1={t.y} y2={t.y} className="stats__trait-grille" />
                    <text x={courbe.zone.gauche - 6} y={t.y + 4} textAnchor="end" className="stats__etiquette">
                      {t.libelle}
                    </text>
                  </g>
                ))}
                {courbe.graduationsX.map((t) => (
                  <text key={t.x} x={t.x} y={courbe.hauteur - 6} textAnchor="middle" className="stats__etiquette" aria-hidden="true">
                    {t.libelle}
                  </text>
                ))}
                <polyline points={courbe.polyligne} fill="none" className="stats__courbe" />
                {courbe.points.map((p, i) => (
                  <circle key={p.dateIso} cx={p.x} cy={p.y} r={i === courbe.points.length - 1 ? 7 : 4.5} className={i === courbe.points.length - 1 ? 'stats__point stats__point--dernier' : 'stats__point'} />
                ))}
              </svg>
              <p className="aide">Un point par mois : votre meilleur 5 km du mois. Le plus bas est le plus rapide.</p>
            </section>
          )}
        </>
      )}

      {charge && !erreur && sport === 'velo' && (
        <section className="sorties__carte-records" aria-labelledby="rec-efforts">
          <div className="sorties__semaine-tete">
            <h2 id="rec-efforts">Meilleurs efforts</h2>
            <span className="aide">puissance moyenne</span>
          </div>
          <ul className="sorties__records-table">
            {records.efforts.map(({ definition, record }) => {
              const age = record ? ancienneteRecord(record.date, aujourdhui) : null
              return (
                <li key={definition.id}>
                  <span className="sorties__rt-distance">{definition.libelle}</span>
                  <span className="sorties__rt-corps">
                    <strong>{record ? `${record.watts} W` : '—'}</strong>
                    <span>{record ? formaterDate(record.date) : 'Aucune sortie assez longue ou mesurée'}</span>
                  </span>
                  {age && <span className={age.recent ? 'sorties__rt-badge sorties__rt-badge--nouveau' : 'sorties__rt-badge'}>{age.texte}</span>}
                </li>
              )
            })}
          </ul>
          <p className="aide">
            Calculés sur la puissance mesurée des sorties importées d’un fichier. Un effort n’est proposé que si l’espacement des mesures
            est assez fin pour sa durée.
          </p>
        </section>
      )}

      {charge && !erreur && (
        <section className="sorties__carte-records" aria-labelledby="rec-autres">
          <h2 id="rec-autres">Autres records</h2>
          {records.autres.length === 0 ? (
            <p className="aide">Aucune sortie pour l’instant.</p>
          ) : (
            <dl className="sorties__autres">
              {records.autres.map((a) => (
                <div key={a.id}>
                  <dt>{a.nom}</dt>
                  <dd>
                    <strong>{valeurAutre(a)}</strong>{' '}
                    <span>{a.id === 'meilleure-semaine' ? `semaine du ${formaterDate(a.date)}` : formaterDate(a.date)}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}
    </div>
  )
}
