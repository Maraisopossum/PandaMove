import { Link } from 'react-router'
import { PandaIllustration } from '../../core/images/PandaIllustration'
import { DateDialog } from '../calendar/DateDialog'
import { SupprimerInstanceDialog } from '../calendar/SupprimerInstanceDialog'
import { useEcranListeInstances } from './useEcranListeInstances'
import type { TypeListeInstances } from './useListeInstances'

// Sous-menus « Séances programmées » et « Séances terminées » du module Renforcement.
// Pas d'affectation (📅) ici : elle n'existe que sur la liste des séances types. Chaque ligne s'ouvre (exécution ou
// bilan) ; les séances non terminées peuvent changer de date, toutes peuvent être supprimées après confirmation.
// Aucune logique : lignes, textes et états viennent de useEcranListeInstances.
export default function ListeInstancesScreen({ type }: { type: TypeListeInstances }) {
  const e = useEcranListeInstances(type)

  return (
    <>
      <h1>{e.titre}</h1>

      {e.erreur && (
        <div className="formulaire__ligne">
          <p role="alert" className="import__erreur">
            {e.erreur}
          </p>
          <button type="button" className="bouton" onClick={() => void e.recharger()}>
            Réessayer
          </button>
        </div>
      )}
      {e.erreurAction && (
        <p role="alert" className="import__erreur">
          {e.erreurAction}
        </p>
      )}

      {e.chargement ? (
        <p>Chargement…</p>
      ) : e.vide ? (
        <div className="calendrier__vide">
          <PandaIllustration image={e.pandaVide} sizes="96px" decoratif className="calendrier__panda" />
          <div>
            <p>{e.texteVide}</p>
            <p className="ecran__aide">
              {type === 'programmees'
                ? 'Planifiez une séance depuis « Séances types », ou lancez-la tout de suite.'
                : 'Elles apparaissent ici dès que vous terminez une séance.'}
            </p>
            <Link to="/strength" className="bouton lien-bouton">
              Voir les séances types
            </Link>
          </div>
        </div>
      ) : (
        e.lignes.length > 0 && (
          <ul className="seances__liste">
            {e.lignes.map((l) => (
              <li key={l.id} className="seance__carte">
                <Link to={l.lien} className="seance__texte seance__ouvrir">
                  <span className="seance__nom">
                    {l.nom}
                    {l.enCours && <span className="instances__badge">En cours</span>}
                  </span>
                  <span className="seance__details">
                    {l.date}
                    {l.details && <> · {l.details}</>}
                  </span>
                </Link>
                <div className="seance__actions">
                  {l.peutChangerDate && (
                    <button type="button" className="bouton" aria-label={`Changer la date de ${l.designation}`} onClick={() => e.demanderDeplacement(l)}>
                      Changer la date
                    </button>
                  )}
                  <button type="button" className="bouton" aria-label={`Supprimer ${l.designation}`} onClick={() => e.demanderSuppression(l)}>
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {e.aDeplacer && (
        <DateDialog
          nomSeance={e.aDeplacer.ligne.designation}
          date={e.aDeplacer.date}
          enCours={e.enCours}
          onDate={e.choisirDate}
          onConfirmer={() => void e.confirmerDeplacement()}
          onFermer={e.fermerDeplacement}
        />
      )}
      {e.aSupprimer && (
        <SupprimerInstanceDialog
          nomSeance={e.aSupprimer.designation}
          enCours={e.enCours}
          onConfirmer={() => void e.confirmerSuppression()}
          onFermer={e.fermerSuppression}
        />
      )}
    </>
  )
}
