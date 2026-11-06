// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { OngletsSeances } from './OngletsSeances'

afterEach(cleanup)

const afficher = (actif: Parameters<typeof OngletsSeances>[0]['actif'], comptes?: Parameters<typeof OngletsSeances>[0]['comptes']) =>
  render(
    <MemoryRouter>
      <OngletsSeances actif={actif} comptes={comptes} />
    </MemoryRouter>,
  )

describe('OngletsSeances', () => {
  it('lie les trois vues existantes et marque la vue courante', () => {
    afficher('programmees')
    const liens = screen.getAllByRole('link')
    expect(liens.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Types', '/strength'],
      ['Programmées', '/strength/planned'],
      ['Terminées', '/strength/done'],
    ])
    expect(liens.filter((l) => l.getAttribute('aria-current') === 'page').map((l) => l.textContent)).toEqual(['Programmées'])
  })

  it('affiche les effectifs quand ils sont connus', () => {
    afficher('types', { types: 4, programmees: 2, terminees: 12 })
    expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual(['Types4', 'Programmées2', 'Terminées12'])
  })
})
