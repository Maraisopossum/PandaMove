import { Link } from 'react-router'
import { PandaIllustration } from '../../core/images/PandaIllustration'
import { useEcranListeInstances } from './useEcranListeInstances'
import type { TypeListeInstances } from './useListeInstances'

// Sous-menus « Séances programmées » et « Séances terminées » du module Renforcement.
// Pas d'affectation (📅) ici : elle n'existe que sur la liste des séances types.
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

      {e.chargement ? (
        <p>Chargement…</p>
      ) : e.vide ? (
        <div className="calendrier__vide">
          <PandaIllustration image={e.pandaVide} sizes="96px" decoratif className="calendrier__panda" />
          <div>
            <p>{e.texteVide}</p>
            <Link to="/strength" className="bouton lien-bouton">
              Voir les séances types
            </Link>
          </div>
        </div>
      ) : (
        e.lignes.length > 0 && (
          <ul className="seances__liste">
            {e.lignes.map((l) => (
              <li key={l.id}>
                <Link to={l.lien} className="seance__carte instances__lien">
                  <span className="seance__texte">
                    <span className="seance__nom">{l.nom}</span>
                    <span className="seance__details">
                      {l.date}
                      {l.details && <> · {l.details}</>}
                    </span>
                  </span>
                  {l.enCours && <span className="instances__badge">En cours</span>}
                </Link>
              </li>
            ))}
          </ul>
        )
      )}
    </>
  )
}
