import { Link, useParams } from 'react-router'
import { ciblesCourseComplete, formaterChrono, SEGMENTS_COMPLETS } from './simulation'
import { chargeStation, estCleStation, STATION_PAR_CLE } from './stations'
import { DETAIL_STATION } from './stationsDetail'
import { useHistoriqueStation } from './useAccesHyrox'
import { useHyrox } from './useHyrox'

const dateCourte = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(iso))

// Détail d'une station : charge, évolution des temps, points clés, erreurs fréquentes, lien vers une simulation de cette station.
export default function StationDetailHyroxScreen() {
  const { cle = '' } = useParams()
  const h = useHyrox()
  const valide = estCleStation(cle)
  const passages = useHistoriqueStation(cle, valide)

  if (!valide) return <div className="plans hyrox"><h1 className="titre-ecran">Station</h1><p>Station introuvable. <Link to="/hyrox/stations">Retour aux stations</Link></p></div>

  const station = STATION_PAR_CLE[cle]
  const detail = DETAIL_STATION[cle]
  const categorie = h.objectif?.categorie ?? 'open'
  const genre = h.objectif?.genre ?? 'homme'
  const charge = chargeStation(cle, categorie, genre)
  const cible = h.objectif?.objectifS ? ciblesCourseComplete(h.objectif.objectifS, h.repartition.partCoursesPct)[SEGMENTS_COMPLETS.findIndex((c) => c.station === cle)] : null
  const meilleur = passages.length ? Math.min(...passages.map((p) => p.reelS)) : null
  const pire = passages.length ? Math.max(...passages.map((p) => p.reelS)) : 0

  return (
    <div className="plans hyrox">
      <h1 className="titre-ecran">{station.nom}</h1>
      <section className="plans__entete" aria-labelledby="hs-titre">
        <p className="plans__sur-titre">{station.effort.toUpperCase()}{charge ? ` · ${charge.toUpperCase()}` : ''}</p>
        <h2 id="hs-titre" className="plans__grand">{meilleur !== null ? formaterChrono(meilleur) : '—'}</h2>
        <p>{meilleur !== null ? 'Meilleur temps' : 'Pas encore chronométrée'}{cible ? ` · cible ${formaterChrono(cible)}` : ''}</p>
      </section>

      <section className="plans__carte" aria-labelledby="hs-evol">
        <h2 id="hs-evol" className="plans__titre">Évolution</h2>
        {passages.length === 0 ? (
          <p>Aucun temps pour le moment : lancez une simulation de cette station.</p>
        ) : (
          <ul className="hyrox__evolution">
            {passages.map((p) => (
              <li key={`${p.simulationId}-${p.debutAt}`}>
                <span className="hyrox__evolution-date">{dateCourte(p.debutAt)}</span>
                <span className="hyrox__evolution-barre" style={{ width: `${Math.max(8, (p.reelS / pire) * 100)}%` }} data-record={p.reelS === meilleur} aria-hidden="true" />
                <strong>{formaterChrono(p.reelS)}</strong>
              </li>
            ))}
          </ul>
        )}
        <Link className="bouton bouton--principal hyrox__bouton" to={`/hyrox/simulation?station=${cle}`}>Simuler cette station</Link>
      </section>

      <section className="plans__carte" aria-labelledby="hs-cles">
        <h2 id="hs-cles" className="plans__titre">Points clés</h2>
        <ul className="hyrox__puces">{detail.pointsCles.map((p) => <li key={p}>{p}</li>)}</ul>
      </section>

      <section className="plans__carte" aria-labelledby="hs-err">
        <h2 id="hs-err" className="plans__titre">Erreurs fréquentes</h2>
        <ul className="hyrox__puces">{detail.erreurs.map((e) => <li key={e}>{e}</li>)}</ul>
      </section>
      <Link className="plans__lien" to="/hyrox/stations">Les 8 stations</Link>
    </div>
  )
}
