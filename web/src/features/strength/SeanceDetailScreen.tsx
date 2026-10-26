import { useId, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { SupprimerInstanceDialog } from '../calendar/SupprimerInstanceDialog'
import type { BlocDetail, ExerciceDetail, InstanceDetail } from './detailSeance'
import { useDetailSeance } from './useDetailSeance'

const ETATS: Record<InstanceDetail['etat'], { libelle: string; icone: string }> = {
  planifiee: { libelle: 'Programmée', icone: '▶' },
  en_cours: { libelle: 'En cours', icone: '▶' },
  terminee: { libelle: 'Terminée', icone: '✓' },
}

function CarteExercice({ e, dense }: { e: ExerciceDetail; dense?: boolean }) {
  return (
    <li className={`detail__exo${e.progression ? ' detail__exo--progression' : ''}${dense ? ' detail__exo--dense' : ''}`}>
      <p className="detail__exo-tete">
        {e.supersetGroupe && (
          <span className="detail__groupe" aria-label={`Groupe ${e.supersetGroupe}`}>
            {e.supersetGroupe}
          </span>
        )}
        <strong className="detail__exo-nom">{e.nom}</strong>
        {e.progression && <span className="badge badge--progression">↗ Progression</span>}
        {e.bilateral && (
          <span className="badge badge--bilateral" title="Bilatéral : un côté puis l'autre">
            G+D<span className="visuellement-cache"> (bilatéral)</span>
          </span>
        )}
      </p>
      {e.equipement && <p className="seance__details">{e.equipement}</p>}
      <p className="detail__cible">
        <strong>{e.series}</strong>
        {e.charge && <span> @ {e.charge}</span>}
        {e.repos && <span className="detail__repos">repos {e.repos}</span>}
      </p>
      {e.avertissement && (
        <p className="detail__avertissement">
          <span aria-hidden="true">⚠️ </span>
          <span className="visuellement-cache">Attention : </span>
          {e.avertissement}
        </p>
      )}
      {e.progression && (e.systeme || e.increment) && (
        <p className="detail__progression">
          <span className="visuellement-cache">Progression : </span>
          {e.systeme && <span className="badge badge--progression">{e.systeme}</span>}
          {e.increment && <span className="badge badge--progression">{e.increment}</span>}
        </p>
      )}
    </li>
  )
}

function CadreBloc({ b }: { b: BlocDetail }) {
  const idTitre = useId()
  const style = { '--bloc-clair': b.couleurClair, '--bloc-sombre': b.couleurSombre } as CSSProperties
  return (
    <li className="detail__bloc" style={style}>
      <section aria-labelledby={idTitre}>
        <div className="detail__bloc-tete">
          <span aria-hidden="true">{b.icone}</span>
          <h3 id={idTitre} className="detail__bloc-nom">
            {b.nom}
          </h3>
          <span className="detail__bloc-type">{b.libelleType}</span>
          {b.meta && <span className="detail__bloc-meta">{b.meta}</span>}
        </div>
        <ul className="detail__exos">
          {b.exercices.map((e) => (
            <CarteExercice key={e.id} e={e} dense />
          ))}
        </ul>
      </section>
    </li>
  )
}

// Détail d'une séance type (Android SeanceDetailScreen) : résumé, composition (blocs et exercices avec leurs cibles),
// historique des séances jouées. Action principale : Lancer. Pas de 📅 ici (réservé à la liste, règle CLAUDE.md).
// Aucune logique : tout vient de useDetailSeance.
export default function SeanceDetailScreen() {
  const e = useDetailSeance()
  const m = e.lancement
  const idComposition = useId()
  const idHistorique = useId()

  if (e.chargement) return <p>Chargement…</p>
  if (!e.detail) {
    return (
      <>
        <h1>Séance introuvable</h1>
        <p role="alert" className="import__erreur">
          {e.erreur}
        </p>
        <Link to="/strength" className="bouton lien-bouton">
          Retour aux séances types
        </Link>
      </>
    )
  }
  const d = e.detail

  return (
    <>
      <nav aria-label="Fil d'Ariane">
        <Link to="/strength" className="detail__retour">
          <span aria-hidden="true">← </span>Séances types
        </Link>
      </nav>

      <header className="detail__hero">
        <h1>{d.nom}</h1>
        <p className="detail__sous-titre">
          {d.directe ? 'Séance directe' : 'Séance type'}
          {d.archivee && <span className="instances__badge instances__badge--neutre">Archivée</span>}
        </p>
        <ul className="detail__stats" aria-label="Résumé de la séance">
          <li>
            <strong>{d.stats.exercices}</strong> <span>exercice{d.stats.exercices > 1 ? 's' : ''}</span>
          </li>
          <li>
            <strong>{d.stats.progression}</strong> <span>en progression</span>
          </li>
          <li>
            <strong>{d.stats.series}</strong> <span>série{d.stats.series > 1 ? 's' : ''}</span>
          </li>
          <li>
            <strong>~{d.stats.dureeMin}</strong> <span>min estimées</span>
          </li>
        </ul>
        {d.muscles.length > 0 && <p className="detail__muscles">{d.muscles.join(' · ')}</p>}
        {d.notes && <p className="detail__notes">{d.notes}</p>}
      </header>

      <div className="formulaire__ligne">
        <button type="button" className="bouton bouton--principal" disabled={m.enCours} onClick={e.lancer}>
          Lancer la séance
        </button>
        <Link to={`/strength/${d.id}/edit`} className="bouton lien-bouton">
          Modifier
        </Link>
      </div>

      {m.erreur && (
        <p role="alert" className="import__erreur">
          {m.erreur}
        </p>
      )}
      {e.erreurAction && (
        <p role="alert" className="import__erreur">
          {e.erreurAction}
        </p>
      )}

      <section aria-labelledby={idComposition}>
        <h2 id={idComposition}>Composition</h2>
        {d.entrees.length === 0 ? (
          <p>
            Cette séance ne contient aucun exercice. <Link to={`/strength/${d.id}/edit`}>Modifiez-la</Link> pour en ajouter.
          </p>
        ) : (
          <ul className="detail__exos">
            {d.entrees.map((entree) =>
              entree.kind === 'libre' ? (
                <CarteExercice key={entree.exercice.id} e={entree.exercice} />
              ) : (
                <CadreBloc key={entree.bloc.id} b={entree.bloc} />
              ),
            )}
          </ul>
        )}
      </section>

      <section aria-labelledby={idHistorique}>
        <h2 id={idHistorique}>Historique</h2>
        {d.instances.length === 0 ? (
          <p>Aucune séance terminée ou programmée à partir de cette séance type pour l'instant.</p>
        ) : (
          <ul className="seances__liste">
            {d.instances.map((i) => (
              <li key={i.id} className="detail__instance">
                <Link to={i.lien} className="detail__instance-lien">
                  <span aria-hidden="true">{ETATS[i.etat].icone}</span>
                  <span className="detail__instance-date">{i.dateLibelle}</span>
                  <span className={`instances__badge${i.etat === 'terminee' ? '' : ' instances__badge--neutre'}`}>{ETATS[i.etat].libelle}</span>
                </Link>
                <button type="button" className="bouton" aria-label={`Supprimer la séance du ${i.dateLibelle}`} onClick={() => e.demanderSuppression(i)}>
                  <span aria-hidden="true">🗑</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {e.aSupprimer && (
        <SupprimerInstanceDialog
          nomSeance={`${d.nom} — ${e.aSupprimer.dateLibelle}`}
          enCours={e.suppressionEnCours}
          onConfirmer={() => void e.confirmerSuppression()}
          onFermer={e.annulerSuppression}
        />
      )}
    </>
  )
}
