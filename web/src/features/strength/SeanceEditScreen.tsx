import { ChampNombre, ChampTexte, ChampZoneTexte } from './champs'
import { LIBELLES_BLOC } from './draft'
import { BlocCarte } from './edition/BlocCarte'
import { DialogueConfirmation } from './edition/DialogueConfirmation'
import { EchauffementDialog } from './edition/EchauffementDialog'
import { ExerciceCarte } from './edition/ExerciceCarte'
import { GardeSortie } from './edition/GardeSortie'
import { MenuAjoutBloc } from './edition/MenuAjoutBloc'
import { SelecteurDialog } from './edition/SelecteurDialog'
import { useEcranEdition } from './useEcranEdition'

// Création / modification d'un modèle de séance (parité Android SeanceCreateScreen). Écran d'ÉDITION : aucun
// bouton d'affectation au calendrier ici (réservé à l'écran liste). Toute la logique est dans useEcranEdition.
export default function SeanceEditScreen() {
  const s = useEcranEdition()
  const d = s.draft

  if (!s.charge) return <p>Chargement…</p>

  return (
    <div className="edition">
      <h1>{s.enCreation ? 'Nouvelle séance' : 'Modifier la séance'}</h1>
      <form
        className="edition__formulaire"
        aria-label="Séance"
        onSubmit={(e) => {
          e.preventDefault()
          void s.soumettre()
        }}
      >
        <section className="edition__infos" aria-label="Informations de la séance">
          <ChampTexte libelle="Nom de la séance" valeur={d.nom} onChange={s.setNom} />
          <ChampZoneTexte libelle="Notes" valeur={d.notes} onChange={s.setNotes} />
          <ChampNombre libelle="Durée estimée (min)" valeur={d.dureeEstimeeMin} onChange={s.setDuree} />
          <p className="aide">
            {s.groupesAffiches.length > 0
              ? `Muscles travaillés : ${s.groupesAffiches.join(', ')}.`
              : 'Les muscles travaillés se déduisent des exercices ajoutés.'}
          </p>
        </section>

        <button type="button" className="edition__ajout-rapide" onClick={() => s.selecteur.ouvrir(null)}>
          <span aria-hidden="true">🔍</span>
          <span className="edition__ajout-texte">Rechercher ou ajouter un exercice…</span>
          <span className="badge badge--progression">Bibliothèque</span>
        </button>
        <div className="edition__outils">
          <button type="button" className="bouton" onClick={s.echauffement.ouvrir}>
            Ajouter un échauffement
          </button>
        </div>

        {d.items.length === 0 && (
          <p className="aide edition__vide">
            Séance vide : cherchez un exercice pour commencer, ou ajoutez un bloc (échauffement, superset, circuit…) pour les regrouper.
          </p>
        )}
        <ol className="edition__items">
          {d.items.map((item) =>
            item.kind === 'libre' ? (
              <ExerciceCarte
                key={item.exercice.id}
                exercice={item.exercice}
                typeBloc={null}
                materiel={s.materiel}
                peutMonter={s.peutDeplacer(item.exercice.id, -1)}
                peutDescendre={s.peutDeplacer(item.exercice.id, 1)}
                actions={s.actionsExercice(item.exercice.id)}
              />
            ) : (
              <BlocCarte
                key={item.bloc.id}
                bloc={item.bloc}
                materiel={s.materiel}
                peutMonter={s.peutDeplacer(item.bloc.id, -1)}
                peutDescendre={s.peutDeplacer(item.bloc.id, 1)}
                actions={s.actionsBloc(item.bloc)}
                actionsExercice={s.actionsExercice}
                peutDeplacerExercice={s.peutDeplacer}
              />
            ),
          )}
        </ol>

        <MenuAjoutBloc onAjouter={s.ajouterBloc} />

        <div className="edition__barre">
          {s.erreur && (
            <ul role="alert" className="import__erreur erreurs__liste">
              {s.erreur.split('\n').map((ligne) => (
                <li key={ligne}>{ligne}</li>
              ))}
            </ul>
          )}
          <div className="formulaire__ligne">
            <button type="submit" className="bouton bouton--principal" disabled={s.enregistrement}>
              Enregistrer
            </button>
            <button type="button" className="bouton" onClick={s.annuler}>
              Annuler
            </button>
          </div>
        </div>
      </form>

      {s.selecteur.ouvert && <SelecteurDialog selecteur={s.selecteur} titreCible={s.titreSelecteur} />}
      {s.echauffement.ouvert && (
        <EchauffementDialog modeles={s.echauffement.modeles} erreur={s.echauffement.erreur} onChoisir={(id) => void s.echauffement.choisir(id)} onFermer={s.echauffement.fermer} />
      )}
      {s.suppressionBloc.enAttente && (
        <DialogueConfirmation
          titre="Supprimer ce bloc ?"
          libelleConfirmer="Supprimer le bloc"
          libelleAnnuler="Garder le bloc"
          onConfirmer={s.suppressionBloc.confirmer}
          onAnnuler={s.suppressionBloc.annuler}
        >
          <p>
            « {s.suppressionBloc.enAttente.nom || LIBELLES_BLOC[s.suppressionBloc.enAttente.type]} » et ses {s.suppressionBloc.enAttente.exercices.length}{' '}
            exercice{s.suppressionBloc.enAttente.exercices.length > 1 ? 's' : ''} seront retirés de la séance (au prochain enregistrement).
          </p>
        </DialogueConfirmation>
      )}
      <GardeSortie modifieRef={s.modifieRef} />
    </div>
  )
}
