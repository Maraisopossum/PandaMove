import { Fragment, type CSSProperties, type Ref } from 'react'
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
      {Object.values(MODULES).map(({ path, label, color, sousLiens }) => {
        const style = { '--couleur-module': color } as CSSProperties
        return (
          <Fragment key={path}>
            {/* Module à sous-menus : section courante (aria-current="true"), la page courante étant le sous-lien */}
            <NavLink
              to={path}
              end={path === '/'}
              aria-current={sousLiens ? 'true' : 'page'}
              className="drawer__lien"
              style={style}
              onClick={onNavigation}
            >
              {label}
            </NavLink>
            {sousLiens && (
              <ul className="drawer__sousliens" aria-label={label}>
                {sousLiens.map((s) => (
                  <li key={s.path}>
                    {/* `end` sur le chemin du module : /strength n'est pas actif sur /strength/planned */}
                    <NavLink to={s.path} end={s.path === path} className="drawer__lien drawer__souslien" style={style} onClick={onNavigation}>
                      {s.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </Fragment>
        )
      })}
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
