import { Link } from 'react-router'
import { PandaIllustration } from '../../core/images/PandaIllustration'
import { DateDialog } from '../calendar/DateDialog'
import { SupprimerInstanceDialog } from '../calendar/SupprimerInstanceDialog'
import { AssignDialog } from './AssignDialog'
import { BarreSelection } from './BarreSelection'
import { CarteInstance } from './CarteInstance'
import { CarteSelectionnable } from './CarteSelectionnable'
import { MenuActions } from './MenuActions'
import { SeanceDirecteDialog } from './SeanceDirecteDialog'
import { SupprimerDialog } from './SupprimerDialog'
import { SupprimerSelectionDialog } from './SupprimerSelectionDialog'
import { useListeSeancesEcran } from './useListeSeancesEcran'

// Écran « Renforcement » à sections, comme l'Android : séances types, séances programmées, séances terminées
// (5 + « Voir les N autres »), séances archivées. Une seule sélection (appui long / « Sélectionner ») porte sur toutes
// les sections. Les entrées « Séances programmées » et « Séances terminées » du menu ouvrent les vues complètes de
// ces deux sections. Seules les séances types portent le bouton d'affectation au calendrier : jamais l'édition, le
// détail ni le bilan (règle CLAUDE.md). Aucune logique ici : cartes, textes et états viennent de useListeSeancesEcran.
export default function SeanceListScreen() {
  const l = useListeSeancesEcran()
  const a = l.affectation
  const d = l.suppression
  const m = l.lancement
  const sd = l.directe
  const sel = l.selection
  const ds = l.suppressionSelection
  const prog = l.programmees
  const fin = l.terminees
  const aDeplacer = prog.aDeplacer ?? fin.aDeplacer
  const erreur = l.erreur ?? m.erreur ?? l.erreurInstances

  return (
    <>
      <h1>Renforcement</h1>
      <p className="ecran__aide">
        Vos séances types (des modèles réutilisables : « Lancer », 📅 pour les planifier), puis vos séances programmées et terminées.
      </p>
      {!sel.mode && (
        <div className="formulaire__ligne">
          {!l.vide && (
            <Link to="/strength/new" className="bouton bouton--principal lien-bouton">
              <span aria-hidden="true">＋ </span>Nouvelle séance
            </Link>
          )}
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

      {erreur && (
        <p role="alert" className="import__erreur">
          {erreur}
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
      ) : (
        <>
          {(l.aTypes || l.aucuneActive) && (
            <section aria-labelledby="titre-types">
              <h2 id="titre-types">Séances types</h2>
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
              {l.aucunResultat ? (
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
            </section>
          )}

          {prog.lignes.length > 0 && (
            <section aria-labelledby="titre-programmees">
              <h2 id="titre-programmees">Séances programmées</h2>
              <ul className="seances__liste">
                {prog.lignes.map((x) => (
                  <CarteInstance key={x.id} ligne={x} selection={sel} onChangerDate={prog.demanderDeplacement} onSupprimer={prog.demanderSuppression} />
                ))}
              </ul>
            </section>
          )}

          {fin.lignes.length > 0 && (
            <section aria-labelledby="titre-terminees">
              <h2 id="titre-terminees">Séances terminées</h2>
              <ul className="seances__liste">
                {l.termineesVisibles.map((x) => (
                  <CarteInstance key={x.id} ligne={x} selection={sel} onChangerDate={fin.demanderDeplacement} onSupprimer={fin.demanderSuppression} />
                ))}
              </ul>
              {(l.nbTermineesCachees > 0 || l.toutesTerminees) && (
                <button type="button" className="bouton" aria-expanded={l.toutesTerminees} onClick={l.basculerTerminees}>
                  {l.toutesTerminees ? 'Réduire' : `Voir les ${l.nbTermineesCachees} autres`}
                </button>
              )}
            </section>
          )}
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

      {aDeplacer && (
        <DateDialog
          nomSeance={aDeplacer.ligne.designation}
          date={aDeplacer.date}
          enCours={prog.enCours}
          onDate={prog.aDeplacer ? prog.choisirDate : fin.choisirDate}
          onConfirmer={() => void (prog.aDeplacer ? prog.confirmerDeplacement() : fin.confirmerDeplacement())}
          onFermer={prog.aDeplacer ? prog.fermerDeplacement : fin.fermerDeplacement}
        />
      )}
      {prog.aSupprimer && (
        <SupprimerInstanceDialog
          nomSeance={prog.aSupprimer.designation}
          enCours={prog.enCours}
          onConfirmer={() => void prog.confirmerSuppression()}
          onFermer={prog.fermerSuppression}
        />
      )}
      {fin.aSupprimer && (
        <SupprimerInstanceDialog
          nomSeance={fin.aSupprimer.designation}
          enCours={fin.enCours}
          onConfirmer={() => void fin.confirmerSuppression()}
          onFermer={fin.fermerSuppression}
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
