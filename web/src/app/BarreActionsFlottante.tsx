import type { ReactNode } from 'react'

interface Props {
  /** Libellé accessible du groupe d'actions (ex. « Actions de la séance »). */
  libelle: string
  /** Bouton secondaire à gauche (ex. Pause), facultatif. */
  secondaire?: ReactNode
  /** Action principale (CTA), pleine largeur restante. */
  principal: ReactNode
}

// Barre d'actions fixée en bas de l'écran (design system Stitch, §4.D) : action secondaire + CTA principal.
// Présentation seule : les boutons et leurs gestionnaires viennent de l'écran appelant.
export function BarreActionsFlottante({ libelle, secondaire, principal }: Props) {
  return (
    <div className="execution__actions-flottantes" role="group" aria-label={libelle}>
      {secondaire && <div className="execution__actions-flottantes__secondaire">{secondaire}</div>}
      <div className="execution__actions-flottantes__principal">{principal}</div>
    </div>
  )
}
