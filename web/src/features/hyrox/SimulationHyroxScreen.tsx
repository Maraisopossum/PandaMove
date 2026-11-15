import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useWakeLock } from '../strength/execute/useWakeLock'
import { ecrireSonHyrox, lireSonHyrox } from './bip'
import { FORMES, formaterChrono, formaterEcart, LIBELLE_FORME, NOM_COURSE_COURT, type FormeSimulation } from './simulation'
import { CATEGORIES_HYROX, estCleStation, GENRES_HYROX, LIBELLE_CATEGORIE, LIBELLE_GENRE, STATION_PAR_CLE, STATIONS, type CategorieHyrox, type CleStation, type GenreHyrox } from './stations'
import { useSimulationHyrox } from './useSimulationHyrox'

const nomSegment = (s: { type: 'course' | 'station'; station: string | null }) => (s.type === 'course' ? NOM_COURSE_COURT : STATION_PAR_CLE[s.station as CleStation]?.nom ?? 'Station')

// Simulation chronométrée : choix de la forme, puis écran sombre gardé allumé avec le chrono du segment, l'écart à la cible et un grand
// bouton « Segment suivant ». Une simulation en cours se reprend après un rechargement (le chrono se déduit des temps enregistrés).
export default function SimulationHyroxScreen() {
  const navigate = useNavigate()
  const s = useSimulationHyrox()
  const [params] = useSearchParams()
  const stationDemandee = params.get('station')
  const [forme, setForme] = useState<FormeSimulation>(estCleStation(stationDemandee) ? 'station' : 'complete')
  const [station, setStation] = useState<CleStation>(estCleStation(stationDemandee) ? stationDemandee : 'wall_balls')
  const [categorieChoisie, setCategorie] = useState<CategorieHyrox | null>(null)
  const [genreChoisi, setGenre] = useState<GenreHyrox | null>(null)
  const categorie = categorieChoisie ?? s.objectif?.categorie ?? 'open'
  const genre = genreChoisi ?? s.objectif?.genre ?? 'homme'
  const [son, setSon] = useState(lireSonHyrox)
  const [confirmeAbandon, setConfirmeAbandon] = useState(false)
  useWakeLock(s.enMarche)

  useEffect(() => {
    if (s.terminee) navigate(`/hyrox/bilan/${s.terminee}`, { replace: true })
  }, [s.terminee, navigate])

  if (!s.pret) return <div className="plans hyrox"><h1 className="titre-ecran">Simulation</h1></div>

  if (s.simulation && s.courant) {
    const faits = s.segments.filter((x) => x.reelS !== null).length
    const cible = s.courant.cibleS
    const suivant = s.segments.find((x) => x.rang > s.courant!.rang)
    const dernier = !suivant
    return (
      <div className="hyrox-sim" role="region" aria-label="Simulation en cours">
        <p className="hyrox-sim__rang">Segment {faits + 1} sur {s.segments.length}</p>
        <h1 className="hyrox-sim__nom">{nomSegment(s.courant)}</h1>
        {s.courant.chargeLabel && <p className="hyrox-sim__charge">{s.courant.chargeLabel}</p>}
        <p className="hyrox-sim__chrono" aria-live="off">{formaterChrono(s.ecoule)}</p>
        <p className="hyrox-sim__ecart">
          {cible !== null ? <>Cible {formaterChrono(cible)} · <strong>{formaterEcart(s.ecoule - cible)}</strong></> : 'Pas de cible'}
        </p>
        {suivant && <p className="hyrox-sim__suivant">Ensuite : {nomSegment(suivant)}</p>}
        {s.erreur && <p role="alert" className="hyrox-sim__erreur">{s.erreur}</p>}
        <button type="button" className="hyrox-sim__bouton" onClick={() => void s.segmentSuivant()}>{dernier ? 'Terminer' : 'Segment suivant'}</button>
        <div className="hyrox-sim__pied">
          <button type="button" className="hyrox-sim__lien" onClick={() => { ecrireSonHyrox(!son); setSon(!son) }}>{son ? 'Couper le son' : 'Activer le son'}</button>
          {confirmeAbandon ? (
            <>
              <button type="button" className="hyrox-sim__lien" onClick={() => void s.abandonner()}>Confirmer l’abandon</button>
              <button type="button" className="hyrox-sim__lien" onClick={() => setConfirmeAbandon(false)}>Continuer</button>
            </>
          ) : (
            <button type="button" className="hyrox-sim__lien" onClick={() => setConfirmeAbandon(true)}>Abandonner</button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="plans hyrox">
      <h1 className="titre-ecran">Simulation</h1>
      <form className="plans__formulaire" onSubmit={(e) => { e.preventDefault(); void s.demarrer({ forme, station: forme === 'station' ? station : null, categorie, genre }) }}>
        <label className="formulaire__champ">
          Forme
          <select value={forme} onChange={(e) => setForme(e.target.value as FormeSimulation)}>
            {FORMES.map((f) => <option key={f} value={f}>{LIBELLE_FORME[f]}</option>)}
          </select>
        </label>
        {forme === 'station' && (
          <label className="formulaire__champ">
            Station
            <select value={station} onChange={(e) => setStation(e.target.value as CleStation)}>
              {STATIONS.map((x) => <option key={x.cle} value={x.cle}>{x.nom}</option>)}
            </select>
          </label>
        )}
        <label className="formulaire__champ">
          Catégorie
          <select value={categorie} onChange={(e) => setCategorie(e.target.value as CategorieHyrox)}>
            {CATEGORIES_HYROX.map((c) => <option key={c} value={c}>{LIBELLE_CATEGORIE[c]}</option>)}
          </select>
        </label>
        <label className="formulaire__champ">
          Genre
          <select value={genre} onChange={(e) => setGenre(e.target.value as GenreHyrox)}>
            {GENRES_HYROX.map((g) => <option key={g} value={g}>{LIBELLE_GENRE[g]}</option>)}
          </select>
        </label>
        <p className="aide">
          {s.objectif?.objectifS ? 'Chaque segment affichera son écart à la cible de votre objectif.' : 'Sans temps visé, le chrono s’affiche sans cible. Vous pouvez en définir un dans l’objectif.'}
          {' '}À chaque segment terminé, touchez le grand bouton : l’écran reste allumé.
        </p>
        {s.erreur && <p role="alert">{s.erreur}</p>}
        <button type="submit" className="bouton bouton--principal">Démarrer</button>
        <Link className="plans__lien" to="/hyrox">Annuler</Link>
      </form>
    </div>
  )
}
