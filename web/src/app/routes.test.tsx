// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createMemoryRouter, matchRoutes, Outlet, RouterProvider } from 'react-router'
import { MODULES, moduleActif } from './modules'
import { construireRoutes } from './routes'

afterEach(cleanup)

// Coque neutre : on ne teste ici que la table de routes, pas la synchro ni le drawer.
const coque = <Outlet />
const routes = (dev: boolean) => construireRoutes(coque, dev)

// Chemins d'exemple pour les routes à paramètre
const CHEMINS_ATTENDUS = [
  '/',
  '/strength',
  '/strength/new',
  '/strength/abc/edit',
  '/strength/instance/abc',
  '/strength/instance/abc/report',
  '/calendar',
  '/stats',
  '/profile',
  '/profile/equipment',
  '/strength/catalog',
  '/import',
]

function routeFeuille(chemin: string, dev = false) {
  const correspondances = matchRoutes(routes(dev), chemin)
  return correspondances?.[correspondances.length - 1]?.route
}

describe('table de routes', () => {
  it('chaque module pointe vers une route déclarée (pas la route générique)', () => {
    for (const { path } of Object.values(MODULES)) {
      const feuille = routeFeuille(path)
      expect(feuille, path).toBeDefined()
      expect(feuille?.path, path).not.toBe('*')
    }
  })

  it('déclare toutes les routes de la phase 1', () => {
    for (const chemin of CHEMINS_ATTENDUS) {
      expect(routeFeuille(chemin)?.path, chemin).not.toBe('*')
    }
  })

  it('une route inconnue rend la page « introuvable »', () => {
    const routeur = createMemoryRouter(routes(false), { initialEntries: ['/nimporte/quoi'] })
    render(<RouterProvider router={routeur} />)
    expect(screen.getByRole('heading', { name: 'Page introuvable' })).toBeDefined()
  })

  it('une route connue rend son écran', () => {
    const routeur = createMemoryRouter(routes(false), { initialEntries: ['/stats'] })
    render(<RouterProvider router={routeur} />)
    expect(screen.getByRole('heading', { name: 'Statistiques' })).toBeDefined()
  })

  it("/debug/write n'est pas enregistrée hors développement", () => {
    expect(routeFeuille('/debug/write', false)?.path).toBe('*')
  })

  it('/debug/write est enregistrée en développement', () => {
    expect(routeFeuille('/debug/write', true)?.path).toBe('debug/write')
  })
})

describe('moduleActif', () => {
  it("retrouve le module d'après le chemin, y compris les sous-routes", () => {
    expect(moduleActif('/')).toBe('home')
    expect(moduleActif('/strength')).toBe('strength')
    expect(moduleActif('/strength/instance/abc/report')).toBe('strength')
    expect(moduleActif('/stats')).toBe('stats')
  })

  it("retombe sur l'accueil pour un chemin inconnu", () => {
    expect(moduleActif('/nimporte/quoi')).toBe('home')
  })

  it('ne confond pas un préfixe de chemin avec un module', () => {
    expect(moduleActif('/strengthening')).toBe('home')
  })
})

describe('MODULES', () => {
  it('strength est violet et stats est orange (DESIGN.md)', () => {
    expect(MODULES.strength.color).toBe('#7C5CBF')
    expect(MODULES.stats.color).toBe('#BF360C')
  })
})
