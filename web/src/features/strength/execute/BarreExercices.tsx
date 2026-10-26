import type { CSSProperties, RefObject } from 'react'
import type { GroupeNav } from './navExercices'

interface Props {
  groupes: GroupeNav[]
  piste: RefObject<HTMLUListElement | null>
  onChoisir: (exerciceId: string) => void
}

// Barre horizontale défilante des exercices, regroupés par bloc (design de l'écran Android). Présentation
// seule : groupes, état actif et défilement viennent de useNavExercices.
export function BarreExercices({ groupes, piste, onChoisir }: Props) {
  return (
    <nav className="navex" aria-label="Exercices de la séance">
      <ul className="navex__piste" ref={piste}>
        {groupes.map((g) => (
          <li
            key={g.cle}
            className={g.encadre ? 'navex__groupe navex__groupe--cadre' : 'navex__groupe'}
            data-groupe-encadre={g.encadre}
            style={{ '--bloc-clair': g.couleurs.clair, '--bloc-sombre': g.couleurs.sombre } as CSSProperties}
          >
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
                    <span className="navex__nom" aria-hidden="true">
                      {b.nom}
                    </span>
                    <span className="navex__trait" aria-hidden="true" />
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
