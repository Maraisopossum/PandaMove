// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestDb } from '../test/sqliteDb'

const base = createTestDb()
vi.mock('../core/db/client', () => ({ getDb: () => base }))
vi.mock('../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import OrganiserModulesScreen from '../features/profile/OrganiserModulesScreen'
import HomeScreen from '../features/home/HomeScreen'
import { Drawer } from './Drawer'
import { CLE_ORDRE_MODULES, deplacer, MODULES_ORDONNABLES, modulesDuMenu, normaliser, PREFERENCES_DEFAUT, tuilesAccueil } from './ordreModules'
import { MODULES } from './modules'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('préférences d’ordre des modules', () => {
  it('par défaut : tous les modules, neuf accès rapides en trois rangées, l’Accueil en tête du menu', () => {
    expect(PREFERENCES_DEFAUT.ordre).toEqual(MODULES_ORDONNABLES)
    expect(modulesDuMenu(PREFERENCES_DEFAUT)[0]).toBe('home')
    expect(modulesDuMenu(PREFERENCES_DEFAUT)).toHaveLength(Object.keys(MODULES).length)
    expect(tuilesAccueil(PREFERENCES_DEFAUT)).toEqual(['strength', 'running', 'cycling', 'hyrox', 'plans', 'calendar', 'nutrition', 'mobility', 'breathing'])
    // Tous les modules du registre sont couverts : un module ajouté à MODULES doit entrer dans l'ordre
    expect([...MODULES_ORDONNABLES, 'home'].sort()).toEqual(Object.keys(MODULES).sort())
  })

  it('normalise une valeur stockée : ids inconnus et doublons écartés, modules manquants ajoutés en fin', () => {
    const p = normaliser({ ordre: ['nutrition', 'inconnu', 'nutrition', 'hyrox', 'home'], tuiles: ['hyrox', 'zzz', 'hyrox'] })
    expect(p.ordre.slice(0, 2)).toEqual(['nutrition', 'hyrox'])
    expect(p.ordre).toHaveLength(MODULES_ORDONNABLES.length)
    expect(new Set(p.ordre).size).toBe(p.ordre.length)
    expect(p.tuiles).toEqual(['hyrox'])
    expect(normaliser(null)).toEqual(PREFERENCES_DEFAUT)
    expect(normaliser({ ordre: 'x', tuiles: 'y' }).tuiles).toEqual([...PREFERENCES_DEFAUT.tuiles])
    expect(normaliser({ tuiles: [] }).tuiles).toEqual([])
  })

  it('déplace d’un rang, sans sortir de la liste', () => {
    expect(deplacer(['strength', 'running', 'cycling'], 'running', -1)).toEqual(['running', 'strength', 'cycling'])
    expect(deplacer(['strength', 'running', 'cycling'], 'running', 1)).toEqual(['strength', 'cycling', 'running'])
    expect(deplacer(['strength', 'running'], 'strength', -1)).toEqual(['strength', 'running'])
    expect(deplacer(['strength', 'running'], 'running', 1)).toEqual(['strength', 'running'])
  })

  it('les accès rapides suivent l’ordre du menu, restreints aux modules cochés', () => {
    expect(tuilesAccueil({ ordre: ['nutrition', 'hyrox', 'strength'], tuiles: ['strength', 'nutrition'] })).toEqual(['nutrition', 'strength'])
  })
})

describe('écran Organiser les modules', () => {
  const monter = () =>
    render(
      <MemoryRouter>
        <OrganiserModulesScreen />
        <MenuDeNavigation />
      </MemoryRouter>,
    )

  // Drawer et Accueil lisent les mêmes préférences : un changement dans l'écran se voit aussitôt dans les deux
  function MenuDeNavigation() {
    return <Drawer ouvert onNavigation={() => {}} deconnexion={{ avertissement: null, enCours: false, deconnecter: async () => {} }} sombre={{ dark: false, setDark: () => {} }} />
  }

  it('monte et descend un module : le menu et l’écran suivent, le réglage est mémorisé', () => {
    monter()
    const liste = screen.getByRole('list', { name: 'Modules, dans l’ordre du menu' })
    const nom = (i: number) => within(liste).getAllByRole('listitem')[i].querySelector('.modules-ordre__nom')?.textContent
    expect(nom(0)).toBe('Accueil')
    expect(nom(1)).toBe('Renforcement')
    fireEvent.click(within(liste).getByRole('button', { name: 'Descendre Renforcement' }))
    expect(nom(1)).toBe('Course')
    expect(nom(2)).toBe('Renforcement')
    expect(JSON.parse(localStorage.getItem(CLE_ORDRE_MODULES)!).ordre.slice(0, 2)).toEqual(['running', 'strength'])
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' })
    expect(within(nav).getAllByRole('link').slice(0, 3).map((l) => l.textContent)).toEqual(['Accueil', 'Course', 'Renforcement'])
    // aux extrémités, le déplacement est désactivé
    expect((within(liste).getByRole('button', { name: 'Monter Course' }) as HTMLButtonElement).disabled).toBe(true)
    expect((within(liste).getByRole('button', { name: 'Descendre Import' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('coche et décoche l’accueil, puis rétablit l’ordre par défaut', () => {
    monter()
    const case_ = screen.getByRole('checkbox', { name: 'Afficher Statistiques sur l’accueil' }) as HTMLInputElement
    expect(case_.checked).toBe(false)
    fireEvent.click(case_)
    expect(JSON.parse(localStorage.getItem(CLE_ORDRE_MODULES)!).tuiles).toContain('stats')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Afficher Hyrox sur l’accueil' }))
    expect(JSON.parse(localStorage.getItem(CLE_ORDRE_MODULES)!).tuiles).not.toContain('hyrox')
    fireEvent.click(screen.getByRole('button', { name: 'Rétablir l’ordre par défaut' }))
    expect(localStorage.getItem(CLE_ORDRE_MODULES)).toBeNull()
    expect((screen.getByRole('checkbox', { name: 'Afficher Hyrox sur l’accueil' }) as HTMLInputElement).checked).toBe(true)
  })
})

describe('Accueil configurable', () => {
  it('affiche les accès rapides choisis, dans l’ordre choisi, et un lien pour les organiser', () => {
    localStorage.setItem(CLE_ORDRE_MODULES, JSON.stringify({ ordre: ['nutrition', 'strength'], tuiles: ['strength', 'nutrition'] }))
    render(
      <MemoryRouter>
        <HomeScreen />
      </MemoryRouter>,
    )
    const acces = screen.getByRole('navigation', { name: 'Accès rapides' })
    expect(within(acces).getAllByRole('link').map((l) => l.getAttribute('aria-label'))).toEqual(['Nutrition', 'Renforcement'])
    expect(screen.getByRole('link', { name: 'Organiser les modules' }).getAttribute('href')).toBe('/profile/modules')
  })
})
