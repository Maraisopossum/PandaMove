// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { createMemoryRouter, Link, Outlet, RouterProvider, useLocation, type RouteObject } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { AppShellView } from './AppShell'
import { MODULES } from './modules'
import { parentDe } from './parents'
import { construireRoutes } from './routes'
import { useRetour } from './useRetour'

afterEach(cleanup)

function cheminsDesRoutes(routes: RouteObject[], prefixe = ''): string[] {
  return routes.flatMap((r) => {
    const chemin = r.path ? `${prefixe}/${r.path}`.replace(/\/+/g, '/') : prefixe
    return [...(r.index ? [prefixe || '/'] : []), ...(r.path && r.path !== '*' ? [chemin] : []), ...cheminsDesRoutes(r.children ?? [], chemin)]
  })
}
const ROUTES = cheminsDesRoutes(construireRoutes(createElement('div'), false))
const concret = (chemin: string) => chemin.replace(/:[^/]+/g, 'x')
const existe = (chemin: string) => ROUTES.some((r) => new RegExp(`^${r.replace(/:[^/]+/g, '[^/]+')}$`).test(chemin))

// Écrans racines : l'Accueil et le premier écran de chaque module (le menu y mène) n'ont pas de retour
const RACINES = new Set(['/', ...Object.values(MODULES).map((m) => m.path)])

describe('arborescence des écrans (parents)', () => {
  it('chaque route a un parent, sauf les écrans racines des modules', () => {
    for (const r of ROUTES) {
      const chemin = concret(r)
      if (RACINES.has(chemin)) expect(parentDe(chemin), `${chemin} est une racine : pas de retour`).toBeNull()
      else expect(parentDe(chemin), `aucun parent pour ${chemin} : ajoutez une règle dans parents.ts`).not.toBeNull()
    }
  })

  it('le parent est une vraie route, du même module, et la remontée finit toujours sur une racine (pas de boucle)', () => {
    for (const r of ROUTES) {
      let chemin = concret(r)
      const module = chemin.split('/')[1]
      for (let pas = 0; pas < 6; pas++) {
        const parent = parentDe(chemin)
        if (!parent) break
        const adresse = parent.vers.split('?')[0]
        expect(existe(adresse), `${chemin} → ${adresse} n'est pas une route`).toBe(true)
        expect(adresse).not.toBe(chemin)
        // L'administration remonte vers le Profil (d'où on y accède) ; hors cela le parent reste dans le module
        if (chemin !== '/admin') expect(adresse.split('/')[1], `${chemin} quitte son module`).toBe(module)
        chemin = adresse
      }
      expect(RACINES.has(chemin) || chemin === '/profile', `${r} ne remonte pas jusqu'à une racine (bloqué sur ${chemin})`).toBe(true)
    }
  })

  it.each([
    ['/strength/instance/x/report', '/strength/done'],
    ['/strength/instance/x', '/strength/planned'],
    ['/strength/x/edit', '/strength'],
    ['/running/x/edit', '/running'],
    ['/plans/semaine/2026-11-09', '/plans/semaine'],
    ['/hyrox/stations/skierg', '/hyrox/stations'],
    ['/hyrox/bilan/x', '/hyrox'],
    ['/nutrition/aliments/new', '/nutrition/aliments'],
    ['/nutrition/aliments', '/nutrition'],
    ['/mobility/seance', '/mobility/apercu'],
    ['/mobility/apercu', '/mobility'],
    ['/breathing/session/x/30', '/breathing'],
    ['/outils/donnees', '/outils'],
    ['/profile/modules', '/profile'],
    ['/admin/comptes', '/admin'],
    ['/admin', '/profile'],
  ])('%s remonte vers %s', (chemin, attendu) => {
    expect(parentDe(chemin)?.vers).toBe(attendu)
  })

  it('le journal de nutrition garde le jour consulté ; un jour invalide est ignoré', () => {
    expect(parentDe('/nutrition/ajouter', '?date=2026-11-10&repas=diner')?.vers).toBe('/nutrition?date=2026-11-10')
    expect(parentDe('/nutrition/photo', '?date=2026-11-10')?.vers).toBe('/nutrition?date=2026-11-10')
    expect(parentDe('/nutrition/photo', '?date=n-importe-quoi')?.vers).toBe('/nutrition')
    expect(parentDe('/nutrition/entree/abc')?.vers).toBe('/nutrition')
  })

  it('une adresse inconnue ou la racine n’a pas de retour ; la barre oblique finale est ignorée', () => {
    expect(parentDe('/')).toBeNull()
    expect(parentDe('/n-importe-quoi')).toBeNull()
    expect(parentDe('/strength/planned/')?.vers).toBe('/strength')
  })
})

// Coque réduite à la barre du haut : le bouton Retour et l'historique, sans synchro ni menu
function Coque() {
  const retour = useRetour()
  const { pathname, search } = useLocation()
  return (
    <>
      <AppShellView
        module={MODULES.nutrition}
        drawer={{ ouvert: false, basculer: () => {}, fermer: () => {} }}
        refBascule={{ current: null }}
        refDrawer={{ current: null }}
        sombre={{ dark: false, setDark: () => {} }}
        deconnexion={{ avertissement: null, enCours: false, deconnecter: async () => {} }}
        messageAutreCompte={null}
        demanderAbandon={() => {}}
        retour={retour}
        indicateurSynchro={null}
      >
        <Outlet />
      </AppShellView>
      <p data-testid="lieu">{pathname + search}</p>
    </>
  )
}

function monter(initial: string[], index?: number) {
  const routes: RouteObject[] = [
    {
      element: <Coque />,
      children: ['/', '/nutrition', '/nutrition/photo', '/nutrition/aliments', '/nutrition/aliments/new', '/hyrox/stations'].map((path) => ({
        path,
        element: <Link to={path === '/nutrition' ? '/nutrition/photo?date=2026-11-10' : '/nutrition'}>Aller</Link>,
      })),
    },
  ]
  const routeur = createMemoryRouter(routes, { initialEntries: initial, initialIndex: index })
  render(<RouterProvider router={routeur} />)
  return routeur
}

describe('bouton Retour de la barre du haut', () => {
  it('absent sur un écran racine, présent sur un sous-écran avec le nom de la destination', () => {
    monter(['/nutrition'])
    expect(screen.queryByRole('button', { name: /^Retour/ })).toBeNull()
    cleanup()
    monter(['/nutrition/photo'])
    expect(screen.getByRole('button', { name: 'Retour : Journal de nutrition' })).toBeTruthy()
  })

  it('arrivé depuis le parent : revient en arrière dans l’historique, sans l’allonger', () => {
    const routeur = monter(['/nutrition'])
    fireEvent.click(screen.getByRole('link', { name: 'Aller' }))
    expect(screen.getByTestId('lieu').textContent).toBe('/nutrition/photo?date=2026-11-10')
    fireEvent.click(screen.getByRole('button', { name: 'Retour : Journal de nutrition' }))
    expect(screen.getByTestId('lieu').textContent).toBe('/nutrition')
    expect(routeur.state.historyAction).toBe('POP')
  })

  it('adresse ouverte directement : remplace l’écran par son parent, le retour du système ne rouvre pas l’écran quitté', () => {
    const routeur = monter(['/', '/nutrition/aliments/new'], 1)
    fireEvent.click(screen.getByRole('button', { name: 'Retour : Mes aliments' }))
    expect(screen.getByTestId('lieu').textContent).toBe('/nutrition/aliments')
    expect(routeur.state.historyAction).toBe('REPLACE')
    // Un seul « retour du système » ramène à l'accueil (pas à l'écran de saisie quitté)
    void routeur.navigate(-1)
  })
})
