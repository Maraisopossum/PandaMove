import { Link, useParams } from 'react-router'
import { ProgressionRecapDialog } from './ProgressionRecapDialog'
import { useEcranBilan } from './useEcranBilan'

// Bilan d'une séance terminée (spec §5) : résumé, bilan par exercice et récap de progression
// proposé (Oui / Non / Ajuster). Aucune logique ici : tout vient de useEcranBilan.
// Pas d'affectation au calendrier sur cet écran (réservée à la liste des séances).
export default function ReportScreen() {
  const { id = '' } = useParams()
  const b = useEcranBilan(id)

  return (
    <div className="bilan">
      <h1>{b.chargement || !b.trouvee ? 'Bilan de séance' : `Bilan — ${b.nomSeance}`}</h1>

      {b.erreur && !b.recapOuvert && (
        <p role="alert" className="import__erreur">
          {b.erreur}
        </p>
      )}

      {b.chargement ? (
        <p>Chargement…</p>
      ) : !b.trouvee ? (
        <Link to="/strength" className="bouton lien-bouton">
          Retour aux séances
        </Link>
      ) : !b.terminee ? (
        <>
          <p>Cette séance n'est pas encore terminée : le bilan sera disponible à la fin.</p>
          <Link to={b.lienSeance} className="bouton lien-bouton bouton--principal">
            Reprendre la séance
          </Link>
        </>
      ) : (
        <>
          <section aria-label="Résumé">
            <dl className="bilan__kpis">
              <div className="bilan__kpi">
                <dt>Tonnage</dt>
                <dd>{b.tonnage}</dd>
              </div>
              <div className="bilan__kpi">
                <dt>Séries</dt>
                <dd>{b.series}</dd>
              </div>
              <div className="bilan__kpi">
                <dt>Durée</dt>
                <dd>{b.duree}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="bilan-exercices">
            <h2 id="bilan-exercices">Exercices</h2>
            {b.exercices.length === 0 ? (
              <p>Aucun exercice enregistré pour cette séance.</p>
            ) : (
              <ul className="bilan__liste">
                {b.exercices.map((e) => (
                  <li key={e.exerciceId} className="bilan__exercice">
                    <p className="bilan__nom">{e.nom}</p>
                    <p className="bilan__series">{e.libelleSeries}</p>
                    <p className="bilan__statut">{e.libelleStatut}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {b.recap.length > 0 && (
            <section aria-labelledby="bilan-progression">
              <h2 id="bilan-progression">Progression</h2>
              <ul className="bilan__liste">
                {b.recap.map((l) => (
                  <li key={l.exerciceId} className="bilan__exercice">
                    <p className="bilan__nom">{l.nom}</p>
                    {l.texte && <p className="bilan__series">{l.texte}</p>}
                    <p className="bilan__statut">{l.libelleEtat}</p>
                  </li>
                ))}
              </ul>
              {b.aDesDecisions && (
                <button type="button" className="bouton bouton--principal" onClick={b.ouvrirRecap}>
                  Voir le récap de progression
                </button>
              )}
            </section>
          )}

          <Link to="/strength" className="bouton lien-bouton">
            Retour aux séances
          </Link>

          {b.recapOuvert && (
            <ProgressionRecapDialog
              lignes={b.recap}
              erreur={b.erreur}
              onAccepter={(exId) => void b.accepter(exId)}
              onRefuser={(exId) => void b.refuser(exId)}
              onAjuster={(exId, kg) => void b.ajuster(exId, kg)}
              onFermer={b.fermerRecap}
            />
          )}
        </>
      )}
    </div>
  )
}
