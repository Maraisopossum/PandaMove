import { Link } from 'react-router'
import { PandaIllustration } from '../../core/images/PandaIllustration'
import { AssignDialog } from './AssignDialog'
import { BarreSelection } from './BarreSelection'
import { CarteDemarrage } from '../demarrage/CarteDemarrage'
import { CarteSelectionnable } from './CarteSelectionnable'
import { MenuActions } from './MenuActions'
import { SeanceDirecteDialog } from './SeanceDirecteDialog'
import { SupprimerDialog } from './SupprimerDialog'
import { SupprimerSelectionDialog } from './SupprimerSelectionDialog'
import { useListeSeancesEcran } from './useListeSeancesEcran'

// Liste des séances types (modèles). Seul écran de renforcement à porter le bouton d'affectation au calendrier :
// jamais sur l'édition, le détail ni le bilan (règle CLAUDE.md). Aucune logique ici : cartes, textes et états
// viennent de useListeSeancesEcran.
export default function SeanceListScreen() {
  const l = useListeSeancesEcran()
  const a = l.affectation
  const d = l.suppression
  const m = l.lancement
  const sd = l.directe
  const sel = l.selection
  const ds = l.suppressionSelection

  return (
    <>
      <h1>Séances types</h1>
      <p className="ecran__aide">
        Vos séances types, des modèles réutilisables : lancez-en une maintenant, planifiez-la au calendrier avec 📅, ou ouvrez-la pour voir son détail.
      </p>
      <CarteDemarrage />
      {!sel.mode && (
        <div className="formulaire__ligne">
          <Link to="/strength/new" className="bouton bouton--principal lien-bouton">
            <span aria-hidden="true">＋ </span>Nouvelle séance
          </Link>
          <button type="button" className="bouton" onClick={sd.ouvrir}>
            Séance directe
          </button>
          <Link to="/strength/catalog" className="bouton lien-bouton">
            Catalogue d'exercices
          </Link>
          {!l.vide && (
            <button type="button" className="bouton" onClick={() => sel.entrer()}>
              Sélectionner
            </button>
          )}
        </div>
      )}
      {sel.mode && <BarreSelection nombre={sel.nombre} onSupprimer={ds.demander} onQuitter={sel.quitter} />}

      {(l.erreur ?? m.erreur) && (
        <p role="alert" className="import__erreur">
          {l.erreur ?? m.erreur}
        </p>
      )}
      {l.notice && (
        <div className="formulaire__ligne">
          <p role="status">{l.notice.texte}</p>
          {l.notice.lien && (
            <Link to={l.notice.lien.vers} className="bouton lien-bouton">
              {l.notice.lien.libelle}
            </Link>
          )}
        </div>
      )}

      {l.rechercheVisible && (
        <div className="formulaire__champ">
          <label htmlFor="recherche-seances">Rechercher une séance</label>
          <input
            id="recherche-seances"
            type="search"
            value={l.requete}
            placeholder="Nom, muscle, note…"
            onChange={(e) => l.setRequete(e.target.value)}
          />
        </div>
      )}

      {!l.charge ? (
        <p>Chargement…</p>
      ) : l.vide ? (
        <div className="calendrier__vide">
          <PandaIllustration image={l.pandaVide} sizes="96px" decoratif className="calendrier__panda" />
          <div>
            <p>
              <strong>Aucune séance type pour l'instant.</strong>
            </p>
            <p>
              Une séance type est un modèle réutilisable (exercices, séries, charges). Créez-la une fois, puis lancez-la ou
              planifiez-la quand vous voulez.
            </p>
            <Link to="/strength/new" className="bouton bouton--principal lien-bouton">
              Créer ma première séance
            </Link>
          </div>
        </div>
      ) : l.aucunResultat ? (
        <p>Aucune séance ne correspond à « {l.requete.trim()} ».</p>
      ) : (
        <>
          {l.aucuneActive && <p>Aucune séance type active : créez-en une, ou restaurez une séance archivée ci-dessous.</p>}
          <ul className="seances__liste">
            {l.cartes.map(({ seance: s, details, notes, actions }) => (
              <CarteSelectionnable
                key={s.id}
                lien={`/strength/${s.id}`}
                designation={s.nom}
                mode={sel.mode}
                choisie={sel.estSelectionne(s.id)}
                onBasculer={() => sel.basculer(s.id)}
                onAppuiLong={() => sel.entrer(s.id)}
                actions={
                  <>
                    <button type="button" className="bouton bouton--principal" aria-label={`Lancer ${s.nom} maintenant`} disabled={m.enCours} onClick={() => void m.lancer(s)}>
                      Lancer
                    </button>
                    <button type="button" className="bouton" aria-label={`Affecter ${s.nom} au calendrier`} onClick={() => a.ouvrir(s)}>
                      <span aria-hidden="true">📅</span>
                    </button>
                    <MenuActions libelle={`Plus d'actions pour ${s.nom}`} actions={actions} />
                  </>
                }
              >
                <span className="seance__nom">{s.nom}</span>
                <span className="seance__details">{details}</span>
                {notes && <span className="seance__notes">{notes}</span>}
              </CarteSelectionnable>
            ))}
          </ul>
        </>
      )}

      {l.archivees.length > 0 && (
        <section aria-labelledby="titre-archivees">
          <h2 id="titre-archivees">Séances archivées</h2>
          <p className="ecran__aide">
            Masquées de la liste, conservées pour l'historique. Désarchivez-les pour les retrouver ; sélectionnées puis supprimées, elles sont effacées définitivement.
          </p>
          <ul className="seances__liste">
            {l.archivees.map(({ seance: s, details, actions }) => (
              <CarteSelectionnable
                key={s.id}
                lien={`/strength/${s.id}`}
                designation={`${s.nom} (archivée)`}
                classe="seance__carte--archivee"
                mode={sel.mode}
                choisie={sel.estSelectionne(s.id)}
                onBasculer={() => sel.basculer(s.id)}
                onAppuiLong={() => sel.entrer(s.id)}
                actions={<MenuActions libelle={`Plus d'actions pour ${s.nom} (archivée)`} actions={actions} />}
              >
                <span className="seance__nom">
                  {s.nom} <span className="instances__badge instances__badge--neutre">Archivée</span>
                </span>
                <span className="seance__details">{details}</span>
              </CarteSelectionnable>
            ))}
          </ul>
        </section>
      )}

      {a.cible && (
        <AssignDialog
          nomSeance={a.cible.nom}
          form={a.form}
          erreur={a.erreur}
          apercu={a.apercu}
          enCours={a.enCours}
          onMode={a.choisirMode}
          onChamp={a.modifier}
          onAjouterDate={a.ajouterDate}
          onRetirerDate={a.retirerDate}
          onConfirmer={() => void a.confirmer()}
          onFermer={a.fermer}
        />
      )}

      {sd.ouvert && (
        <SeanceDirecteDialog
          nom={sd.nom}
          proposition={sd.proposition}
          erreur={sd.erreur}
          enCours={sd.enCours}
          onNom={sd.setNom}
          onConfirmer={() => void sd.confirmer()}
          onFermer={sd.fermer}
        />
      )}

      {ds.ouvert && (
        <SupprimerSelectionDialog
          compte={l.compteSelection}
          erreur={ds.erreur}
          onConfirmer={() => void ds.confirmer(sel.identifiants)}
          onFermer={ds.fermer}
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
