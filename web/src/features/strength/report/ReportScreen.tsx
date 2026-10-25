import { Link, useParams } from 'react-router'
import { PandaIllustration } from '../../../core/images/PandaIllustration'
import { ProgressionRecapDialog } from './ProgressionRecapDialog'
import { useEcranBilan } from './useEcranBilan'

// Rapport d'une séance terminée (miroir d'InstanceReportScreen Android) : en-tête et chiffres clés en haut,
// détail repliable par exercice (tableau des séries), note, récap de progression proposé (Oui / Non / Ajuster)
// et partage. Aucune logique ici : tout vient de useEcranBilan. Pas d'affectation au calendrier sur cet écran
// (réservée à la liste des séances).
export default function ReportScreen() {
  const { id = '' } = useParams()
  const b = useEcranBilan(id)

  return (
    <div className="bilan">
      <h1>Rapport de séance</h1>

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
          <p>Cette séance n'est pas encore terminée : le rapport sera disponible à la fin.</p>
          <Link to={b.lienSeance} className="bouton lien-bouton bouton--principal">
            Reprendre la séance
          </Link>
        </>
      ) : (
        <>
          <PandaIllustration image={b.pandaVictoire} sizes="120px" className="bilan__panda" />
          <section aria-label="Résumé" className="bilan__entete">
            <h2>{b.nomSeance}</h2>
            {b.dateLongue && <p className="bilan__date">{b.dateLongue}</p>}
            {b.notesSeance.trim() && <p className="bilan__notes">{b.notesSeance}</p>}
            <dl className="bilan__kpis">
              <div className="bilan__kpi">
                <dt>Durée</dt>
                <dd>{b.duree}</dd>
              </div>
              <div className="bilan__kpi">
                <dt>Tonnage</dt>
                <dd>{b.tonnage}</dd>
              </div>
              <div className="bilan__kpi">
                <dt>Séries</dt>
                <dd>{b.series}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="bilan-exercices">
            <h2 id="bilan-exercices">Exercices</h2>
            {b.exercices.length === 0 ? (
              <p>Aucun exercice enregistré pour cette séance.</p>
            ) : (
              b.groupes.map((g) => (
                <div key={g.cle} className="bilan__groupe">
                  {g.titre && <p className="bilan__bloc">{g.titre}</p>}
                  <ul className="bilan__liste">
                    {g.exercices.map((e) => (
                      <li key={e.exerciceId} className="bilan__exercice">
                        <details>
                          <summary className="bilan__resume">
                            <span className="bilan__nom">{e.nom}</span>
                            <span className="bilan__series">{e.libelleSeries}</span>
                            <span className="bilan__statut">{e.libelleStatut}</span>
                          </summary>
                          <p className="bilan__cible">Cible : {e.cible}</p>
                          {e.note && <p className="bilan__cible">Note : {e.note}</p>}
                          {e.libelleProgression && <p className="bilan__cible">Progression : {e.libelleProgression}</p>}
                          {e.lignes.length === 0 ? (
                            <p>Aucune série enregistrée.</p>
                          ) : (
                            <table className="bilan__tableau">
                              <caption className="visuellement-cache">{`Séries de ${e.nom}`}</caption>
                              <thead>
                                <tr>
                                  <th scope="col">Série</th>
                                  <th scope="col">Reps</th>
                                  <th scope="col">Charge</th>
                                  <th scope="col">RPE</th>
                                </tr>
                              </thead>
                              <tbody>
                                {e.lignes.map((l) => (
                                  <tr key={l.libelle + l.numero} className={l.realisee ? undefined : 'bilan__ligne--barree'}>
                                    <th scope="row">
                                      {l.libelle}
                                      {!l.realisee && <span className="bilan__non-validee"> (non validée)</span>}
                                    </th>
                                    <td>{l.reps}</td>
                                    <td>{l.charge}</td>
                                    <td>{l.rpe}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </details>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>

          {b.notesInstance.trim() && (
            <section aria-labelledby="bilan-note">
              <h2 id="bilan-note">Note de séance</h2>
              <p className="bilan__note">{b.notesInstance}</p>
            </section>
          )}

          {b.recap.length > 0 && (
            <section aria-labelledby="bilan-progression">
              <h2 id="bilan-progression">Progression</h2>
              <ul className="bilan__liste">
                {b.recap.map((l) => (
                  <li key={l.exerciceId} className="bilan__exercice bilan__exercice--plat">
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

          <section aria-labelledby="bilan-partage" className="bilan__partage">
            <h2 id="bilan-partage">Exporter</h2>
            <div className="formulaire__ligne">
              <button type="button" className="bouton" onClick={() => void b.copier()}>
                Copier le résumé
              </button>
              <button type="button" className="bouton" onClick={b.telecharger}>
                Télécharger le rapport (HTML)
              </button>
              {b.peutPartager && (
                <button type="button" className="bouton" onClick={() => void b.partager()}>
                  Partager
                </button>
              )}
            </div>
          </section>

          <div className="formulaire__ligne">
            <Link to={b.lienCorrection} className="bouton lien-bouton">
              Corriger la séance
            </Link>
            <Link to="/strength" className="bouton lien-bouton">
              Retour aux séances
            </Link>
            <Link to="/strength/done" className="bouton lien-bouton">
              Séances terminées
            </Link>
          </div>

          {b.recapOuvert && (
            <ProgressionRecapDialog
              lignes={b.recap}
              sousTitre={b.sousTitreRecap}
              erreur={b.erreur}
              enCours={b.enCours}
              onValider={(lot) => void b.valider(lot)}
              onFermer={b.fermerRecap}
            />
          )}
        </>
      )}
      <p role="status" className="bilan__annonce">
        {b.annonce}
      </p>
    </div>
  )
}
