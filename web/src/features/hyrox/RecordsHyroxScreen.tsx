import { Link } from 'react-router'
import { formaterChrono } from './simulation'
import { STATIONS } from './stations'
import { useHyrox } from './useHyrox'

const dateCourte = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(iso))

// Records : meilleur temps par station, meilleur kilomètre, progression des simulations complètes.
export default function RecordsHyroxScreen() {
  const h = useHyrox()
  const completes = h.simulations.filter((s) => s.forme === 'complete' && s.statut === 'terminee' && s.totalS !== null).slice().reverse()
  const meilleur = completes.length ? Math.min(...completes.map((s) => s.totalS!)) : null

  return (
    <div className="plans hyrox">
      <h1 className="titre-ecran">Records</h1>
      {h.erreur && <p role="alert">{h.erreur}</p>}

      <section className="plans__carte" aria-labelledby="hr-stations">
        <h2 id="hr-stations" className="plans__titre">Meilleurs temps</h2>
        <ul className="plans__phases">
          <li><span className="plans__phase-texte"><strong>1 km de course</strong><span className="plans__phase-detail">{h.records.meilleurKm !== null ? formaterChrono(h.records.meilleurKm) : 'pas encore chronométré'}</span></span></li>
          {STATIONS.map((s) => (
            <li key={s.cle}>
              <span className="plans__phase-texte"><strong>{s.nom}</strong><span className="plans__phase-detail">{h.records.parStation[s.cle] !== undefined ? formaterChrono(h.records.parStation[s.cle]!) : 'pas encore chronométré'}</span></span>
            </li>
          ))}
        </ul>
      </section>

      <section className="plans__carte" aria-labelledby="hr-prog">
        <h2 id="hr-prog" className="plans__titre">Simulations complètes {meilleur !== null && <span className="plans__sous">meilleur : {formaterChrono(meilleur)}</span>}</h2>
        {completes.length === 0 ? (
          <p>Aucune simulation complète terminée pour le moment.</p>
        ) : (
          <ul className="plans__phases">
            {completes.map((s) => (
              <li key={s.id}>
                <Link className="plans__phase-texte" to={`/hyrox/bilan/${s.id}`}>
                  <strong>{dateCourte(s.debutAt)}{s.reference ? ' · référence' : ''}</strong>
                  <span className="plans__phase-detail">{formaterChrono(s.totalS!)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Link className="plans__lien" to="/hyrox">Retour à Hyrox</Link>
    </div>
  )
}
