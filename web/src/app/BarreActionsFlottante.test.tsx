// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BarreActionsFlottante } from './BarreActionsFlottante'

afterEach(cleanup)

describe('BarreActionsFlottante', () => {
  it('regroupe l’action secondaire et le CTA principal dans un groupe nommé', () => {
    render(
      <BarreActionsFlottante
        libelle="Actions de la séance"
        secondaire={<button type="button">Pause</button>}
        principal={<button type="button">Terminer la séance</button>}
      />,
    )
    const groupe = screen.getByRole('group', { name: 'Actions de la séance' })
    expect(groupe.className).toBe('execution__actions-flottantes')
    expect(within(groupe).getAllByRole('button').map((b) => b.textContent)).toEqual(['Pause', 'Terminer la séance'])
  })

  it('sans action secondaire, le CTA principal est seul', () => {
    render(<BarreActionsFlottante libelle="Actions" principal={<button type="button">Démarrer</button>} />)
    const groupe = screen.getByRole('group', { name: 'Actions' })
    expect(within(groupe).getAllByRole('button')).toHaveLength(1)
    expect(groupe.querySelector('.execution__actions-flottantes__secondaire')).toBeNull()
  })
})
