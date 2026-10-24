import type { CSSProperties, ReactNode } from 'react'
import { Outlet } from 'react-router'
import { SyncIndicator } from '../core/sync/SyncIndicator'
import { Drawer } from './Drawer'
import type { ModuleInfo } from './modules'
import type { Deconnexion } from './useDeconnexion'
import { useAppShell } from './useAppShell'

interface VueProps {
  module: ModuleInfo
  drawer: { ouvert: boolean; basculer: () => void; fermer: () => void }
  sombre: { dark: boolean; setDark: (valeur: boolean) => void }
  deconnexion: Deconnexion
  messageAutreCompte: string | null
  demanderAbandon: () => void
  indicateurSynchro: ReactNode
  children: ReactNode
}

// Présentation pure de la coque : lien d'évitement, drawer, barre du haut colorée par module, contenu.
export function AppShellView({ module, drawer, sombre, deconnexion, messageAutreCompte, demanderAbandon, indicateurSynchro, children }: VueProps) {
  return (
    <div className="coque">
      <a className="coque__evitement" href="#contenu">
        Aller au contenu
      </a>
      <Drawer ouvert={drawer.ouvert} onNavigation={drawer.fermer} deconnexion={deconnexion} sombre={sombre} />
      {drawer.ouvert && <div className="coque__voile" aria-hidden="true" onClick={drawer.fermer} />}
      <div className="coque__corps">
        <header className="barre" style={{ '--couleur-module': module.color } as CSSProperties}>
          <button
            type="button"
            className="barre__menu"
            aria-label="Menu de navigation"
            aria-expanded={drawer.ouvert}
            aria-controls="drawer"
            onClick={drawer.basculer}
          >
            <span aria-hidden="true">☰</span>
          </button>
          <span className="barre__titre">{module.label}</span>
          {indicateurSynchro}
        </header>
        {messageAutreCompte && (
          <section role="alert" className="bandeau">
            <p>{messageAutreCompte}</p>
            <button type="button" className="bouton" onClick={demanderAbandon}>
              Abandonner les données locales
            </button>
          </section>
        )}
        <main id="contenu" tabIndex={-1} className="contenu">
          {children}
        </main>
      </div>
    </div>
  )
}

// Layout des routes authentifiées : branche la synchro, puis rend la route courante.
export function AppShell() {
  const etat = useAppShell()
  return (
    <AppShellView {...etat} indicateurSynchro={<SyncIndicator />}>
      <Outlet />
    </AppShellView>
  )
}
