// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'
import { messageErreur, MESSAGE_CONFIGURATION } from './erreurs'

beforeEach(() => {
  // React journalise l'erreur capturée : on la silence pour garder une sortie propre
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function Bombe({ erreur }: { erreur: Error }): never {
  throw erreur
}

describe('ErrorBoundary', () => {
  it("affiche le message de configuration quand les variables d'environnement manquent", () => {
    render(
      <ErrorBoundary>
        <Bombe erreur={new Error("Configuration manquante : la variable VITE_SUPABASE_URL n'est pas définie (voir web/.env.example).")} />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert').textContent).toContain(
      'Configuration manquante : renseignez VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY et VITE_POWERSYNC_URL dans web/.env.local',
    )
  })

  it('affiche un message générique pour toute autre erreur', () => {
    render(
      <ErrorBoundary>
        <Bombe erreur={new Error('boum')} />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert').textContent).toContain('Une erreur est survenue')
  })

  it('rend les enfants quand tout va bien', () => {
    render(
      <ErrorBoundary>
        <p>contenu</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('contenu')).toBeDefined()
  })
})

describe('messageErreur', () => {
  it('reconnaît l’erreur de configuration de getSupabase', () => {
    expect(messageErreur(new Error('Configuration manquante : x'))).toBe(MESSAGE_CONFIGURATION)
  })
  it("gère une valeur levée qui n'est pas une Error", () => {
    expect(messageErreur('texte')).toContain('Une erreur est survenue')
  })
})
