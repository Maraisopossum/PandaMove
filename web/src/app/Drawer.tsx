import { Fragment, type CSSProperties, type Ref } from 'react'
import { NavLink } from 'react-router'
import { MODULES, urlIcone } from './modules'
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
      <div className="drawer__entete">
        <span className="drawer__logo" aria-hidden="true">
          P
        </span>
        <div>
          <p className="drawer__marque">PandaMove</p>
          <p className="drawer__signature">Fitness &amp; Training</p>
        </div>
      </div>
      <div className="drawer__liens">
      {Object.values(MODULES).map(({ path, label, color, icone, sousLiens }) => {
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
              <img className="drawer__puce" src={urlIcone(icone)} alt="" width={30} height={30} decoding="async" />
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
      </div>
      <div className="drawer__pied">
        <button type="button" className="bouton drawer__sombre" aria-pressed={sombre.dark} onClick={() => sombre.setDark(!sombre.dark)}>
          Mode sombre
          <span className="drawer__interrupteur" aria-hidden="true" />
        </button>
        <button type="button" className="bouton drawer__deconnexion" disabled={deconnexion.enCours} onClick={() => void deconnexion.deconnecter()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
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
