import { Link } from 'react-router'
import type { Db } from '../../core/db/Db'
import { useDemarrage } from './useDemarrage'

// Carte « Pour commencer » (3 étapes) de l'accueil et du module Renforcement : elle disparaît dès que la première séance
// existe, ou si l'utilisateur la masque. Aucune logique ici : étapes et actions viennent de useDemarrage.
export function CarteDemarrage({ db }: { db?: Db }) {
  const { demarrage, masquer } = useDemarrage(db)
  if (!demarrage?.visible) return null
  return (
    <section className="demarrage" aria-labelledby="demarrage-titre">
      <h2 id="demarrage-titre">Pour commencer</h2>
      <ol className="demarrage__etapes">
        {demarrage.etapes.map((e, i) => (
          <li key={e.id} className={e.fait ? 'demarrage__etape demarrage__etape--faite' : 'demarrage__etape'}>
            <span className="demarrage__numero" aria-hidden="true">
              {e.fait ? '✓' : i + 1}
            </span>
            <div className="demarrage__texte">
              <p className="demarrage__titre">
                {e.titre}
                {e.fait && <span className="instances__badge instances__badge--neutre"> Fait</span>}
              </p>
              <p className="demarrage__aide">{e.aide}</p>
              {!e.fait && (
                <Link to={e.lien} className={e.id === 'seance' ? 'bouton bouton--principal lien-bouton' : 'bouton lien-bouton'}>
                  {e.libelleLien}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className="bouton" onClick={masquer}>
        Masquer ces conseils
      </button>
    </section>
  )
}
