import { useId, useRef } from 'react'
import { useMenu } from '../useMenu'

interface Props {
  /** Repos restant, déjà formaté (« 01:23 ») */
  texte: string
  /** Quelques secondes avant la fin : le badge se renforce */
  urgent: boolean
  onAllonger: () => void
  onEcourter: () => void
  onArreter: () => void
}

// Badge de repos cliquable : ouvre le menu « Allonger de 30 s / Écourter de 30 s / Arrêter » (Android). Logique dans useMenu.
export function MenuRepos({ texte, urgent, onAllonger, onEcourter, onArreter }: Props) {
  const conteneur = useRef<HTMLDivElement>(null)
  const bouton = useRef<HTMLButtonElement>(null)
  const liste = useRef<HTMLUListElement>(null)
  const m = useMenu({ conteneur, bouton, liste })
  const idListe = useId()
  const actions = [
    { id: 'plus', libelle: 'Allonger de 30 s', onChoisir: onAllonger },
    { id: 'moins', libelle: 'Écourter de 30 s', onChoisir: onEcourter },
    { id: 'stop', libelle: 'Arrêter le repos', onChoisir: onArreter },
  ]
  return (
    <div className="menu execution__menu-repos" ref={conteneur}>
      <button
        ref={bouton}
        type="button"
        className={`execution__badge-repos${urgent ? ' execution__badge-repos--urgent' : ''}`}
        aria-haspopup="menu"
        aria-expanded={m.ouvert}
        aria-controls={m.ouvert ? idListe : undefined}
        onClick={m.basculer}
        onKeyDown={m.surToucheBouton}
      >
        Repos : {texte}
      </button>
      {m.ouvert && (
        <ul ref={liste} id={idListe} role="menu" aria-label="Réglages du repos" className="menu__liste" onKeyDown={m.surToucheListe}>
          {actions.map((a) => (
            <li key={a.id} role="none">
              <button type="button" role="menuitem" tabIndex={-1} className="menu__item" onClick={() => m.choisir(a.onChoisir)}>
                {a.libelle}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
