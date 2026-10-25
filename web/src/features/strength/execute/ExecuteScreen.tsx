import { useId } from 'react'
import { Link, useParams } from 'react-router'
import { MenuActions } from '../MenuActions'
import { DialogueConfirmation } from '../edition/DialogueConfirmation'
import { PandaIllustration } from '../../../core/images/PandaIllustration'
import { BarreExercices } from './BarreExercices'
import { BandeauLive } from './BandeauLive'
import { FeuilleDisques } from './FeuilleDisques'
import { FeuilleMinuteur } from './FeuilleMinuteur'
import { FeuilleMontee } from './FeuilleMontee'
import { MenuRepos } from './MenuRepos'
import { LancementCircuit } from './circuit/LancementCircuit'
import { OverlayCircuit } from './circuit/OverlayCircuit'
import { useEcranExecution } from './useEcranExecution'
import { TableauSeries } from './TableauSeries'
import { texteCibles, type ExerciceVue } from './vue'

// Séance en cours (spec §5) : tout est écrit en base locale d'abord, l'affichage est relu ensuite.
// Aucune logique ici : données et actions viennent de useEcranExecution.
export default function ExecuteScreen() {
  const { id = '' } = useParams()
  const e = useEcranExecution(id)
  const actif = e.nav.exerciceActif

  return (
    <div className="execution">
      <header className="execution__entete">
        {e.pandaMotivation !== undefined && (
          <PandaIllustration image={e.pandaMotivation} sizes="96px" decoratif className="execution__panda" />
        )}
        <h1>{e.chargement ? 'Séance' : e.nomSeance}</h1>
        <p className="execution__chrono" role="timer" aria-live="off" aria-label={e.libelleChrono}>
          {e.chrono}
        </p>
        {e.enPause && <p className="execution__etat">En pause</p>}
        {e.terminee && <p className="execution__etat">Séance terminée</p>}
        {e.repos.restantMs !== null &&
          (e.repos.termine ? (
            <p className="execution__repos" aria-live="off">
              Repos terminé
            </p>
          ) : (
            <MenuRepos texte={e.repos.texte} urgent={e.repos.urgent} onAllonger={e.repos.allonger} onEcourter={e.repos.ecourter} onArreter={e.repos.arreter} />
          ))}
        {!e.terminee && (
          <div className="execution__outils">
            <button type="button" className="bouton" onClick={() => e.ouvrirFeuille('minuteur')}>
              <span aria-hidden="true">⏱ </span>Minuteur
            </button>
            {e.trouvee && <MenuActions libelle="Actions de la séance" actions={e.menuSeance} />}
          </div>
        )}
      </header>

      {/* Résultat du circuit / du minuteur (terminé, arrêté, interrompu) : annoncé poliment, vide sinon */}
      <p className="circuit-message" role="status">
        {e.circuit.message}
      </p>

      {e.erreur && (
        <p role="alert" className="import__erreur">
          {e.erreur}
        </p>
      )}

      {e.chargement ? (
        <p>Chargement…</p>
      ) : e.exercices.length === 0 ? (
        <div className="execution__vide">
          <p>Aucun exercice enregistré pour cette séance.</p>
          {!e.terminee && e.trouvee && (
            <button type="button" className="bouton bouton--principal" onClick={e.modifierExercices}>
              Ajouter des exercices
            </button>
          )}
        </div>
      ) : (
        <>
          <BarreExercices groupes={e.nav.groupes} piste={e.nav.piste} onChoisir={e.nav.choisir} />
          {actif && e.nav.blocActif && (
            <section className="execution__bloc">
              <h2>{e.nav.blocActif.nom}</h2>
              {e.nav.libelleTypeBloc && <span className="execution__type-bloc">{e.nav.libelleTypeBloc}</span>}
              {e.circuit.lancement && (
                <LancementCircuit lancement={e.circuit.lancement} recap={e.circuit.recap} erreur={e.circuit.erreur} onLancer={e.circuit.lancer} />
              )}
              <CarteExercice
                key={actif.id}
                exercice={actif}
                tableau={e.tableau}
                historique={e.historique}
                lectureSeule={e.terminee}
                outils={e.outilsExercice}
                bandeau={e.bandeau}
                note={e.noteExercice}
              />
            </section>
          )}
          <section className="execution__notes">
            <label htmlFor="notes-seance">Commentaire de séance</label>
            <textarea
              id="notes-seance"
              rows={2}
              value={e.notes.texte}
              readOnly={e.terminee}
              placeholder="Notes sur la séance"
              onChange={(ev) => e.notes.changer(ev.target.value)}
              onBlur={e.notes.sortir}
            />
          </section>
        </>
      )}

      {e.trouvee && (
        <div className="execution__actions">
          {e.terminee ? (
            <Link to={e.lienBilan} className="bouton lien-bouton bouton--principal">
              Voir le bilan
            </Link>
          ) : !e.demarre ? (
            <button type="button" className="bouton bouton--principal" onClick={() => void e.demarrer()}>
              Démarrer
            </button>
          ) : (
            <>
              {e.enPause ? (
                <button type="button" className="bouton" onClick={() => void e.reprendre()}>
                  Reprendre
                </button>
              ) : (
                <button type="button" className="bouton" onClick={() => void e.pause()}>
                  Pause
                </button>
              )}
              <button type="button" className="bouton bouton--principal" onClick={e.fin.demander}>
                Terminer la séance
              </button>
            </>
          )}
        </div>
      )}
      {e.fin.ouverte && (
        <DialogueConfirmation
          titre={e.fin.message.titre}
          libelleConfirmer="Terminer"
          libelleAnnuler="Annuler"
          destructif={false}
          onConfirmer={() => void e.fin.confirmer()}
          onAnnuler={e.fin.annuler}
        >
          {e.fin.message.lignes.map((ligne) => (
            <p key={ligne}>{ligne}</p>
          ))}
        </DialogueConfirmation>
      )}
      {e.suppression.ouverte && (
        <DialogueConfirmation
          titre="Supprimer la séance ?"
          libelleConfirmer="Supprimer"
          libelleAnnuler="Annuler"
          onConfirmer={() => void e.suppression.confirmer()}
          onAnnuler={e.suppression.annuler}
        >
          <p>Cette séance planifiée sera supprimée, avec ses séries déjà saisies. La séance type n’est pas touchée.</p>
          {e.suppression.erreur && (
            <p role="alert" className="import__erreur">
              {e.suppression.erreur}
            </p>
          )}
        </DialogueConfirmation>
      )}
      {e.feuille === 'minuteur' && (
        <FeuilleMinuteur
          restantMs={e.repos.restantMs}
          derniereSec={e.minuteurManuel.derniereSec}
          onDemarrer={e.minuteurManuel.demarrer}
          onAllonger={e.repos.allonger}
          onEcourter={e.repos.ecourter}
          onArreter={e.repos.arreter}
          onFermer={e.fermerFeuille}
        />
      )}
      {e.feuille === 'disques' && (
        <FeuilleDisques inventaire={e.outilsExercice.inventaire} chargeInitiale={e.outilsExercice.chargeDisques} onFermer={e.fermerFeuille} />
      )}
      {e.feuille === 'echauffement' && actif && e.outilsExercice.montee.etat && (
        <FeuilleMontee
          nomExercice={actif.nom}
          etat={e.outilsExercice.montee.etat}
          maintenantMs={e.maintenantMs}
          onProtocole={e.outilsExercice.montee.changerProtocole}
          onFait={e.outilsExercice.montee.cocher}
          onFermer={e.fermerFeuille}
        />
      )}
      {e.circuit.affichage && <OverlayCircuit affichage={e.circuit.affichage} onArreter={e.circuit.arreter} />}
    </div>
  )
}

function CarteExercice({
  exercice: ex, tableau, historique, lectureSeule, outils, bandeau, note,
}: {
  exercice: ExerciceVue
  tableau: ReturnType<typeof useEcranExecution>['tableau']
  historique: string[]
  lectureSeule: boolean
  outils: ReturnType<typeof useEcranExecution>['outilsExercice']
  bandeau: ReturnType<typeof useEcranExecution>['bandeau']
  note: ReturnType<typeof useEcranExecution>['noteExercice']
}) {
  const idTitre = useId()
  const idNote = useId()
  return (
    <article className="execution__exercice" aria-labelledby={idTitre}>
      <h3 id={idTitre} className="execution__nom">
        {ex.nom}
      </h3>
      {ex.libelleSuperset && <span className="execution__superset">{ex.libelleSuperset}</span>}
      {ex.enchaineAvec && <p className="execution__enchainement">Enchaîne sans repos avec {ex.enchaineAvec}</p>}
      {bandeau && !lectureSeule && <BandeauLive nomExercice={ex.nom} bandeau={bandeau} />}
      <p className="execution__cibles">{texteCibles(ex)}</p>
      {ex.consigne && (
        <p className="execution__consigne">
          <span aria-hidden="true">💬 </span>
          {ex.consigne}
        </p>
      )}
      {ex.isBilateral && <p className="execution__consigne">Exercice unilatéral : une ligne par côté (G puis D).</p>}
      <div className="execution__note">
        <label htmlFor={idNote}>Note sur {ex.nom}</label>
        <textarea
          id={idNote}
          rows={1}
          value={note.texte}
          readOnly={lectureSeule}
          placeholder="Note sur cet exercice…"
          onChange={(ev) => note.changer(ev.target.value)}
        />
      </div>
      {!lectureSeule && (
        <div className="execution__outils-exercice">
          {outils.monteeDisponible && (
            <button type="button" className="bouton" onClick={outils.ouvrirMontee}>
              <span aria-hidden="true">⚡ </span>Montée en charge
            </button>
          )}
          <button type="button" className="bouton" onClick={outils.ouvrirDisques}>
            <span aria-hidden="true">🏋 </span>Disques
          </button>
        </div>
      )}
      <TableauSeries nomExercice={ex.nom} tableau={tableau} lectureSeule={lectureSeule} historique={historique} />
    </article>
  )
}
