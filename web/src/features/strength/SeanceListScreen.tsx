import { Link } from 'react-router'
import { lireGroupes } from './catalog/filtreCatalogue'
import { libelleMuscle } from './catalog/libelles'
import { AssignDialog } from './AssignDialog'
import { LancerDialog } from './LancerDialog'
import { SupprimerDialog } from './SupprimerDialog'
import { useListeSeancesEcran } from './useListeSeancesEcran'

// Liste des séances modèles. Seul écran de renforcement à porter le bouton d'affectation au
// calendrier : jamais sur l'édition, le détail ni le bilan (règle CLAUDE.md).
export default function SeanceListScreen() {
  const l = useListeSeancesEcran()
  const a = l.affectation
  const d = l.suppression
  const m = l.lancement

  return (
    <>
      <h1>Séances types</h1>
      <div className="formulaire__ligne">
        <Link to="/strength/new" className="bouton lien-bouton">
          <span aria-hidden="true">＋ </span>Nouvelle séance
        </Link>
        <Link to="/strength/catalog" className="bouton lien-bouton">
          Catalogue d'exercices
        </Link>
      </div>

      {l.erreur && (
        <p role="alert" className="import__erreur">
          {l.erreur}
        </p>
      )}
      {a.confirmation && (
        <div className="formulaire__ligne">
          <p role="status">{a.confirmation}</p>
          {a.instanceCreee && (
            <Link to={`/strength/instance/${a.instanceCreee}`} className="bouton lien-bouton">
              Ouvrir la séance
            </Link>
          )}
        </div>
      )}

      {!l.charge ? (
        <p>Chargement…</p>
      ) : l.seances.length === 0 ? (
        <p>Aucune séance. Créez votre première séance avec « Nouvelle séance ».</p>
      ) : (
        <ul className="seances__liste">
          {l.seances.map((s) => {
            const muscles = lireGroupes(s.groupesMusculaires).map(libelleMuscle).join(', ')
            const nb = l.nbExercices[s.id] ?? 0
            return (
              <li key={s.id} className="seance__carte">
                <button type="button" className="seance__texte seance__lancer" aria-label={`Lancer ${s.nom} maintenant`} onClick={() => m.ouvrir(s)}>
                  <span className="seance__nom">{s.nom}</span>
                  <span className="seance__details">
                    {muscles || 'Aucun muscle'} · {s.dureeEstimeeMin} min · {nb} exercice{nb > 1 ? 's' : ''}
                  </span>
                </button>
                <div className="seance__actions">
                  <button type="button" className="bouton" aria-label="Affecter à une date" onClick={() => a.ouvrir(s)}>
                    <span aria-hidden="true">📅</span>
                  </button>
                  <Link to={`/strength/${s.id}/edit`} className="bouton lien-bouton" aria-label={`Modifier ${s.nom}`}>
                    Modifier
                  </Link>
                  <button type="button" className="bouton" aria-label={`Archiver ${s.nom}`} onClick={() => void l.demanderArchivage(s)}>
                    Archiver
                  </button>
                  <button type="button" className="bouton" aria-label={`Supprimer ${s.nom}`} onClick={() => void d.ouvrir(s)}>
                    Supprimer
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {a.cible && (
        <AssignDialog
          nomSeance={a.cible.nom}
          date={a.date}
          erreur={a.erreur}
          enCours={a.enCours}
          onDate={a.setDate}
          onConfirmer={() => void a.confirmer()}
          onFermer={a.fermer}
        />
      )}

      {m.cible && (
        <LancerDialog
          nomSeance={m.cible.nom}
          erreur={m.erreur}
          enCours={m.enCours}
          onConfirmer={() => void m.confirmer()}
          onFermer={m.fermer}
        />
      )}

      {d.cible && d.historique && (
        <SupprimerDialog
          nomSeance={d.cible.nom}
          historique={d.historique}
          enCours={d.enCours}
          onChoisir={(mode) => void d.confirmer(mode)}
          onFermer={d.fermer}
        />
      )}
    </>
  )
}
