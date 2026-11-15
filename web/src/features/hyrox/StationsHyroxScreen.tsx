import { Link } from 'react-router'
import { ciblesCourseComplete, formaterChrono, SEGMENTS_COMPLETS } from './simulation'
import { chargeStation, LIBELLE_CATEGORIE, LIBELLE_GENRE, STATIONS } from './stations'
import { useHyrox } from './useHyrox'

// Les 8 stations : effort, charge selon la catégorie et le genre de l'objectif, conseil, record et cible.
export default function StationsHyroxScreen() {
  const h = useHyrox()
  const categorie = h.objectif?.categorie ?? 'open'
  const genre = h.objectif?.genre ?? 'homme'
  const cibles = h.objectif?.objectifS ? ciblesCourseComplete(h.objectif.objectifS, h.repartition.partCoursesPct) : null

  return (
    <div className="plans hyrox">
      <h1 className="titre-ecran">Les 8 stations</h1>
      <p className="aide">
        Charges {LIBELLE_CATEGORIE[categorie]} · {LIBELLE_GENRE[genre]}{h.objectif ? '' : ' (aucun objectif : valeurs par défaut)'}.
        Elles viennent du règlement connu à la rédaction : vérifiez-les avec celui de la saison avant votre course.
      </p>
      <ul className="hyrox__stations">
        {STATIONS.map((s, i) => {
          const charge = chargeStation(s.cle, categorie, genre)
          const record = h.records.parStation[s.cle]
          const cible = cibles?.[SEGMENTS_COMPLETS.findIndex((c) => c.station === s.cle)]
          return (
            <li key={s.cle} className="plans__carte">
              <h2 className="plans__titre"><Link to={`/hyrox/stations/${s.cle}`}>{i + 1}. {s.nom}</Link> <span className="plans__sous">{s.effort}{charge ? ` · ${charge}` : ''}</span></h2>
              <p>{s.conseil}</p>
              <p className="aide">
                Record : {record !== undefined ? formaterChrono(record) : 'pas encore chronométré'}
                {cible !== undefined && cible > 0 ? ` · cible ${formaterChrono(cible)}` : ''}
              </p>
            </li>
          )
        })}
      </ul>
      <Link className="plans__lien" to="/hyrox/simulation">Simuler une station</Link>
    </div>
  )
}
