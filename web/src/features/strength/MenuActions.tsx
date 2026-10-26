import { useId, useRef } from 'react'
import { useMenu } from './useMenu'

export interface ActionMenu {
  id: string
  libelle: string
  onChoisir: () => void
  /** Action destructive : le libellé reste explicite (la couleur n'est qu'un renfort) */
  destructive?: boolean
}

interface Props {
  /** Nom accessible du bouton et du menu, ex. « Plus d'actions pour Pull » */
  libelle: string
  actions: ActionMenu[]
}

// Bouton « ⋮ » ouvrant un menu d'actions secondaires. Toute la logique (clavier, focus) est dans useMenu.
export function MenuActions({ libelle, actions }: Props) {
  const conteneur = useRef<HTMLDivElement>(null)
  const bouton = useRef<HTMLButtonElement>(null)
  const liste = useRef<HTMLUListElement>(null)
  const m = useMenu({ conteneur, bouton, liste })
  const idListe = useId()
  return (
    <div className="menu" ref={conteneur}>
      <button
        ref={bouton}
        type="button"
        className="bouton"
        aria-haspopup="menu"
        aria-expanded={m.ouvert}
        aria-controls={m.ouvert ? idListe : undefined}
        aria-label={libelle}
        onClick={m.basculer}
        onKeyDown={m.surToucheBouton}
      >
        <span aria-hidden="true">⋮</span>
      </button>
      {m.ouvert && (
        <ul ref={liste} id={idListe} role="menu" aria-label={libelle} className="menu__liste" onKeyDown={m.surToucheListe}>
          {actions.map((a) => (
            <li key={a.id} role="none">
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={`menu__item${a.destructive ? ' menu__item--destructive' : ''}`}
                onClick={() => m.choisir(a.onChoisir)}
              >
                {a.libelle}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
