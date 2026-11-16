import type { CSSProperties, Ref } from 'react'
import { NavLink } from 'react-router'
import { MODULES, urlIcone } from './modules'
import { modulesDuMenu, usePreferencesModules } from './ordreModules'
import type { Deconnexion } from './useDeconnexion'

interface Props {
  refNav?: Ref<HTMLElement>
  ouvert: boolean
  onNavigation: () => void
  deconnexion: Deconnexion
  sombre: { dark: boolean; setDark: (valeur: boolean) => void }
}

// Drawer de navigation : les modules seulement (pas de sous-menus), dans l'ordre choisi par l'utilisateur (Profil, Organiser les modules).
// Permanent au-dessus de 1024 px, rétractable en dessous (voir app.css).
export function Drawer({ refNav, ouvert, onNavigation, deconnexion, sombre }: Props) {
  const { preferences } = usePreferencesModules()
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
      {modulesDuMenu(preferences).map((id) => {
        const { path, label, color, icone } = MODULES[id]
        return (
          <NavLink
            key={id}
            to={path}
            end={path === '/'}
            className="drawer__lien"
            style={{ '--couleur-module': color } as CSSProperties}
            onClick={onNavigation}
          >
            <img className="drawer__puce" src={urlIcone(icone)} alt="" width={30} height={30} decoding="async" />
            {label}
          </NavLink>
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
