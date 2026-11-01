import type { CSSProperties, RefObject } from 'react'
import { progressionNav, type GroupeNav } from './navExercices'

interface Props {
  groupes: GroupeNav[]
  piste: RefObject<HTMLUListElement | null>
  onChoisir: (exerciceId: string) => void
}

// Barre horizontale défilante des exercices, regroupés par bloc (maquette Stitch : en-tête « Progression des
// exercices », groupes encadrés étiquetés « Bloc n », badge actif avec son statut). Présentation seule :
// groupes, état actif et défilement viennent de useNavExercices.
export function BarreExercices({ groupes, piste, onChoisir }: Props) {
  const { rang, total } = progressionNav(groupes)
  return (
    <nav className="navex" aria-label="Exercices de la séance">
      <div className="navex__entete">
        <span className="navex__titre">Progression des exercices</span>
        {rang > 0 && (
          <span className="navex__compteur">
            {rang} sur {total}
          </span>
        )}
      </div>
      <ul className="navex__piste" ref={piste}>
        {groupes.map((g) => (
          <li
            key={g.cle}
            className={g.encadre ? 'navex__groupe navex__groupe--cadre' : 'navex__groupe'}
            data-groupe-encadre={g.encadre}
            style={{ '--bloc-clair': g.couleurs.clair, '--bloc-sombre': g.couleurs.sombre } as CSSProperties}
          >
            {g.encadre && (
              <p className="navex__etiquette">
                <span className="navex__rang">Bloc {g.rang}</span>
                <span className="navex__bloc">{g.nom}</span>
              </p>
            )}
            <ul className="navex__badges">
              {g.badges.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    className="navex__badge"
                    data-nav-id={b.id}
                    aria-label={b.nomAccessible}
                    aria-current={b.actif ? 'true' : undefined}
                    onClick={() => onChoisir(b.id)}
                  >
                    <span className="navex__pastille" aria-hidden="true">
                      {b.libelle}
                      {b.termine && <span className="navex__coche">✓</span>}
                    </span>
                    <span className="navex__texte" aria-hidden="true">
                      <span className="navex__nom">{b.nom}</span>
                      <span className="navex__statut">{b.statut}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  )
}
