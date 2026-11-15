import { Link } from 'react-router'
import { formaterTemps } from '../plans/echeances'
import { ecartObjectifPct, formaterChrono, LIBELLE_FORME, SEUIL_ECART_OBJECTIF_PCT, ciblesCourseComplete } from './simulation'
import { LIBELLE_CATEGORIE, LIBELLE_GENRE, STATIONS } from './stations'
import { useHyrox } from './useHyrox'

const jour = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8), 12))
const dateSimulation = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(iso))

// Accueil Hyrox : objectif (la date de course est facultative), estimation actuelle, simulation en cours ou à lancer, points faibles.
export default function HyroxScreen() {
  const h = useHyrox()
  const { objectif, estimation, records } = h
  const ecart = objectif?.objectifS && estimation ? ecartObjectifPct(objectif.objectifS, estimation.totalS) : null
  const decrochees = STATIONS.filter((s) => records.parStation[s.cle] === undefined).length
  const dernieres = h.simulations.filter((s) => s.statut !== 'en_cours').slice(0, 5)

  return (
    <div className="plans hyrox">
      <h1 className="titre-ecran">Hyrox</h1>
      {h.erreur && <p role="alert">{h.erreur}</p>}

      <section className="plans__entete" aria-labelledby="hy-titre">
        <p className="plans__sur-titre">{objectif ? `${LIBELLE_CATEGORIE[objectif.categorie]} · ${LIBELLE_GENRE[objectif.genre]}`.toUpperCase() : 'PRÉPARATION GÉNÉRALE'}</p>
        <h2 id="hy-titre" className="plans__grand">
          {h.joursAvantCourse !== null && h.joursAvantCourse >= 0 ? `J-${h.joursAvantCourse}` : objectif?.resultatS ? formaterChrono(objectif.resultatS) : 'Sans date de course'}
        </h2>
        <p>
          {objectif
            ? `${objectif.nom}${objectif.date ? ` · ${jour(objectif.date)}` : ''}${objectif.lieu ? ` · ${objectif.lieu}` : ''}`
            : 'Aucun objectif pour le moment : vous pouvez vous entraîner et chronométrer des simulations sans course prévue.'}
        </p>
        <div className="outils__chiffres">
          <div className="outils__chiffre"><span className="outils__chiffre-libelle">Temps visé</span><strong>{objectif?.objectifS ? formaterTemps(objectif.objectifS) : '—'}</strong></div>
          <div className="outils__chiffre">
            <span className="outils__chiffre-libelle">Estimation actuelle</span>
            <strong>{estimation ? formaterTemps(estimation.totalS) : '—'}</strong>
            {estimation && <span className="outils__chiffre-detail">entre {formaterTemps(estimation.basS)} et {formaterTemps(estimation.hautS)}</span>}
          </div>
        </div>
      </section>

      {ecart !== null && Math.abs(ecart) > SEUIL_ECART_OBJECTIF_PCT && (
        <p className="plans__niveau" data-niveau={ecart > 0 ? 'bas' : 'bon'} role="status">
          {ecart > 0
            ? `Objectif ${Math.round(ecart)} % plus rapide que votre dernière simulation : c’est ambitieux, vous pouvez le garder ou le revoir.`
            : `Objectif ${Math.round(-ecart)} % plus lent que votre dernière simulation : vous pouvez viser plus haut.`}
        </p>
      )}

      <section className="plans__carte" aria-labelledby="hy-sim">
        <h2 id="hy-sim" className="plans__titre">Simulation</h2>
        {h.enCours ? (
          <>
            <p>Une simulation est en cours ({LIBELLE_FORME[h.enCours.forme].split(' · ')[0].toLowerCase()}).</p>
            <Link className="bouton bouton--principal hyrox__bouton" to="/hyrox/simulation">Reprendre la simulation</Link>
          </>
        ) : (
          <>
            <p>Chronométrez la course entière, la moitié, ou une seule station.</p>
            <Link className="bouton bouton--principal hyrox__bouton" to="/hyrox/simulation">Lancer une simulation</Link>
          </>
        )}
      </section>

      {dernieres.length > 0 && (
        <section className="plans__carte" aria-labelledby="hy-dern">
          <h2 id="hy-dern" className="plans__titre">Dernières simulations</h2>
          <ul className="plans__phases">
            {dernieres.map((s) => (
              <li key={s.id}>
                <Link className="plans__phase-texte" to={`/hyrox/bilan/${s.id}`}>
                  <strong>{dateSimulation(s.debutAt)} · {LIBELLE_FORME[s.forme].split(' · ')[0]}{s.reference ? ' · référence' : ''}</strong>
                  <span className="plans__phase-detail">{s.totalS !== null ? formaterChrono(s.totalS) : '—'}{s.statut === 'abandonnee' ? ' · abandonnée' : ''}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="plans__carte" aria-labelledby="hy-stations">
        <h2 id="hy-stations" className="plans__titre">Stations <span className="plans__sous">{8 - decrochees} sur 8 chronométrées</span></h2>
        {objectif?.objectifS && (
          <p className="aide">Avec {formaterTemps(objectif.objectifS)}, un kilomètre vaut environ {formaterChrono(ciblesCourseComplete(objectif.objectifS, h.repartition.partCoursesPct)[0])}.</p>
        )}
        <div className="hyrox__liens">
          <Link className="plans__lien" to="/hyrox/stations">Les 8 stations</Link>
          <Link className="plans__lien" to="/hyrox/records">Records</Link>
          <Link className="plans__lien" to="/hyrox/plan">Plan de préparation</Link>
          <Link className="plans__lien" to="/hyrox/jour-j">Jour J</Link>
          <Link className="plans__lien" to="/hyrox/objectif">{objectif ? 'Modifier l’objectif' : 'Définir un objectif'}</Link>
        </div>
      </section>
    </div>
  )
}
