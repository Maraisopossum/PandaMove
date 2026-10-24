// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CLE_ONBOARDING } from './onboarding'
import { OnboardingScreen } from './OnboardingScreen'
import { useOnboarding } from './useOnboarding'

function Hote() {
  const o = useOnboarding()
  return o.afficher ? <OnboardingScreen onboarding={o} /> : <p>Application</p>
}

beforeEach(() => localStorage.clear())
afterEach(cleanup)

const titre = () => screen.getByRole('heading', { level: 1 })

describe('OnboardingScreen', () => {
  it('première étape : titre focalisé, image décrite et dimensionnée, progression', () => {
    render(<Hote />)
    expect(titre().textContent).toBe('Bienvenue sur PandaMove')
    expect(document.activeElement).toBe(titre())
    expect(screen.getByText('Étape 1 sur 5')).toBeTruthy()
    const img = screen.getByRole('img')
    expect(img.getAttribute('alt')).toMatch(/panda/i)
    expect(img.getAttribute('src')).toMatch(/^\/panda\/onboarding-01-lg\.webp$/)
    expect(img.getAttribute('width')).toBe('640')
    expect(img.getAttribute('height')).toBe('960')
    // Étape 1 au-dessus de la ligne de flottaison : pas de chargement différé
    expect(img.getAttribute('loading')).toBe('eager')
    expect((screen.getByRole('button', { name: 'Précédent' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('Suivant change d’étape et déplace le focus sur le nouveau titre', () => {
    render(<Hote />)
    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }))
    expect(titre().textContent).toBe('Vos séances de renforcement')
    expect(document.activeElement).toBe(titre())
    expect(screen.getByText('Étape 2 sur 5')).toBeTruthy()
    expect(screen.getByRole('img').getAttribute('loading')).toBe('lazy')
  })

  it('flèches du clavier pour naviguer', () => {
    render(<Hote />)
    fireEvent.keyDown(titre(), { key: 'ArrowRight' })
    expect(screen.getByText('Étape 2 sur 5')).toBeTruthy()
    fireEvent.keyDown(titre(), { key: 'ArrowLeft' })
    expect(screen.getByText('Étape 1 sur 5')).toBeTruthy()
  })

  it('« Passer » ferme l’onboarding et le mémorise', () => {
    render(<Hote />)
    fireEvent.click(screen.getByRole('button', { name: 'Passer' }))
    expect(screen.getByText('Application')).toBeTruthy()
    expect(localStorage.getItem(CLE_ONBOARDING)).toBe('1')
  })

  it('dernière étape : « Commencer » ferme l’onboarding', () => {
    render(<Hote />)
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: 'Suivant' }))
    expect(screen.queryByRole('button', { name: 'Suivant' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Commencer' }))
    expect(screen.getByText('Application')).toBeTruthy()
    expect(localStorage.getItem(CLE_ONBOARDING)).toBe('1')
  })

  it('déjà vu : l’application s’affiche directement', () => {
    localStorage.setItem(CLE_ONBOARDING, '1')
    render(<Hote />)
    expect(screen.getByText('Application')).toBeTruthy()
  })
})
