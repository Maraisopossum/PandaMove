import { Link } from 'react-router'
import { ChampChoix, ChampNombre, ChampNombreFacultatif, ChampTexte, Grille } from './champs'
import { LIBELLES_BLOC, TYPES_BLOC, type TypeBloc } from './draft'
import { ExerciceEditeur } from './ExerciceEditeur'
import { useEcranEdition } from './useEcranEdition'

const OPTIONS_BLOC = TYPES_BLOC.map((t) => ({ valeur: t, libelle: LIBELLES_BLOC[t] }))

// Création / modification d'un modèle de séance. Écran d'ÉDITION : aucun bouton d'affectation au
// calendrier ici (réservé à l'écran liste). Toute la logique est dans useEcranEdition.
export default function SeanceEditScreen() {
  const s = useEcranEdition()
  const d = s.draft

  if (!s.charge) return <p>Chargement…</p>

  return (
    <>
      <h1>{s.enCreation ? 'Nouvelle séance' : 'Modifier la séance'}</h1>
      <form
        className="catalogue__formulaire"
        aria-label="Séance"
        onSubmit={(e) => {
          e.preventDefault()
          void s.soumettre()
        }}
      >
        <ChampTexte libelle="Nom de la séance" valeur={d.nom} onChange={s.setNom} />
        <ChampNombre libelle="Durée estimée (min)" valeur={d.dureeEstimeeMin} onChange={s.setDuree} />
        <ChampTexte libelle="Notes" valeur={d.notes} onChange={s.setNotes} />

        {d.blocs.map((b, ib) => (
          <fieldset key={b.id} className="formulaire__groupe bloc">
            <legend>{b.nom || LIBELLES_BLOC[b.type]}</legend>
            <Grille>
              <ChampTexte libelle="Nom du bloc" valeur={b.nom} onChange={(v) => s.modifierBloc(b.id, { nom: v })} />
              <ChampChoix libelle="Type de bloc" valeur={b.type} options={OPTIONS_BLOC} onChange={(v) => s.modifierBloc(b.id, { type: v as TypeBloc })} />
              <ChampNombreFacultatif libelle="Durée du bloc (min)" valeur={b.dureeMin} onChange={(v) => s.modifierBloc(b.id, { dureeMin: v })} />
              <ChampNombre libelle="Repos entre exercices (s)" valeur={b.tempsReposInterSec} onChange={(v) => s.modifierBloc(b.id, { tempsReposInterSec: v })} />
              <ChampNombre libelle="Repos en fin de tour (s)" valeur={b.tempsReposFinRoundSec} onChange={(v) => s.modifierBloc(b.id, { tempsReposFinRoundSec: v })} />
            </Grille>
            <div className="formulaire__ligne">
              <button type="button" className="bouton" aria-label={`Monter le bloc ${b.nom}`} disabled={ib === 0} onClick={() => s.deplacerBloc(b.id, ib - 1)}>
                <span aria-hidden="true">↑</span> Monter le bloc
              </button>
              <button type="button" className="bouton" aria-label={`Descendre le bloc ${b.nom}`} disabled={ib === d.blocs.length - 1} onClick={() => s.deplacerBloc(b.id, ib + 1)}>
                <span aria-hidden="true">↓</span> Descendre le bloc
              </button>
              <button type="button" className="bouton" aria-label={`Supprimer le bloc ${b.nom}`} onClick={() => s.supprimerBloc(b.id)}>
                Supprimer le bloc
              </button>
            </div>

            <ol className="bloc__exercices">
              {b.exercices.map((e) => (
                <li key={e.id} className="exercice__carte">
                  <details>
                    <summary>{e.exerciseNom}</summary>
                    <ExerciceEditeur exercice={e} onChange={(patch) => s.modifierExercice(e.id, patch)} />
                  </details>
                  <div className="formulaire__ligne">
                    <button type="button" className="bouton" aria-label={`Monter ${e.exerciseNom}`} onClick={() => s.monter(e.id)}>
                      <span aria-hidden="true">↑</span>
                    </button>
                    <button type="button" className="bouton" aria-label={`Descendre ${e.exerciseNom}`} onClick={() => s.descendre(e.id)}>
                      <span aria-hidden="true">↓</span>
                    </button>
                    <button type="button" className="bouton" aria-label={`Retirer ${e.exerciseNom}`} onClick={() => s.supprimerExercice(e.id)}>
                      Retirer
                    </button>
                  </div>
                </li>
              ))}
            </ol>

            {s.blocSelecteur === b.id ? (
              <div className="selecteur" role="group" aria-label="Choisir un exercice">
                <ChampTexte libelle="Rechercher un exercice" valeur={s.recherche} onChange={s.setRecherche} />
                {s.catalogue.length === 0 ? (
                  <p>Aucun exercice ne correspond.</p>
                ) : (
                  <ul className="catalogue__liste selecteur__liste">
                    {s.catalogue.map((x) => (
                      <li key={x.id}>
                        <button type="button" className="bouton selecteur__choix" onClick={() => s.choisirExercice(x.id)}>
                          {x.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" className="bouton" onClick={s.fermerSelecteur}>
                  Fermer la liste
                </button>
              </div>
            ) : (
              <button type="button" className="bouton" onClick={() => s.ouvrirSelecteur(b.id)}>
                Ajouter un exercice
              </button>
            )}
          </fieldset>
        ))}

        <div className="formulaire__ligne">
          <button type="button" className="bouton" onClick={() => s.ajouterBloc()}>
            Ajouter un bloc
          </button>
        </div>

        {s.erreur && (
          <ul role="alert" className="import__erreur erreurs__liste">
            {s.erreur.split('\n').map((ligne) => (
              <li key={ligne}>{ligne}</li>
            ))}
          </ul>
        )}

        <div className="formulaire__ligne">
          <button type="submit" className="bouton" disabled={s.enregistrement}>
            Enregistrer
          </button>
          <Link to="/strength" className="bouton lien-bouton">
            Annuler
          </Link>
        </div>
      </form>
    </>
  )
}
