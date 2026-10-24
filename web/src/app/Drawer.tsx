import type { CSSProperties, Ref } from 'react'
import { NavLink } from 'react-router'
import { MODULES } from './modules'
import type { Deconnexion } from './useDeconnexion'

interface Props {
  refNav?: Ref<HTMLElement>
  ouvert: boolean
  onNavigation: () => void
  deconnexion: Deconnexion
  sombre: { dark: boolean; setDark: (valeur: boolean) => void }
}

// Drawer de navigation : permanent au-dessus de 1024 px, rétractable en dessous (voir app.css).
export function Drawer({ refNav, ouvert, onNavigation, deconnexion, sombre }: Props) {
  return (
    <nav ref={refNav} id="drawer" className={`drawer${ouvert ? ' drawer--ouvert' : ''}`} aria-label="Navigation principale">
      <p className="drawer__marque">PandaMove</p>
      {Object.values(MODULES).map(({ path, label, color }) => (
        <NavLink
          key={path}
          to={path}
          end={path === '/'}
          className="drawer__lien"
          style={{ '--couleur-module': color } as CSSProperties}
          onClick={onNavigation}
        >
          {label}
        </NavLink>
      ))}
      <div className="drawer__pied">
        <button type="button" className="bouton" aria-pressed={sombre.dark} onClick={() => sombre.setDark(!sombre.dark)}>
          Mode sombre
        </button>
        <button type="button" className="bouton" disabled={deconnexion.enCours} onClick={() => void deconnexion.deconnecter()}>
          Se déconnecter
        </button>
        {deconnexion.avertissement && (
          <p role="alert" className="drawer__alerte">
            {deconnexion.avertissement}
          </p>
        )}
      </div>
    </nav>
  )
}
