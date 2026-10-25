// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { detailsErreur } from './erreurs'
import { EcranErreur } from './EcranErreur'
import { PageErreur } from './PageErreur'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function erreurTest() {
  const e = new TypeError('x.trim is not a function')
  e.stack = 'TypeError: x.trim is not a function\n    at musclesAffiches (http://localhost:5173/src/a.ts?t=1:10:5)'
  return e
}

describe('detailsErreur', () => {
  it('donne le nom, le message et la pile, sans origine ni paramètres d\'URL', () => {
    const d = detailsErreur(erreurTest())
    expect(d).toContain('TypeError: x.trim is not a function')
    expect(d).toContain('at musclesAffiches')
    expect(d).toContain('/src/a.ts:10:5')
    expect(d).not.toContain('localhost')
    expect(d).not.toContain('?t=1')
  })
  it("masque une adresse e-mail dans le message", () => {
    expect(detailsErreur(new Error('échec pour moi@exemple.fr'))).not.toContain('moi@exemple.fr')
  })
  it("gère une valeur levée qui n'est pas une Error", () => {
    expect(detailsErreur('texte brut')).toBe('Valeur levée : texte brut')
    expect(detailsErreur(undefined)).toContain('Valeur levée')
  })
})

describe('EcranErreur', () => {
  it('en développement : affiche le nom, le message et la pile', () => {
    render(<EcranErreur erreur={erreurTest()} dev />)
    expect(screen.getByRole('alert').textContent).toContain('Une erreur est survenue')
    const detail = screen.getByLabelText("Détail technique de l'erreur")
    expect(detail.textContent).toContain('TypeError: x.trim is not a function')
    expect(detail.textContent).toContain('at musclesAffiches')
  })

  it("en production : pas de détail affiché, mais un bouton pour copier", async () => {
    const ecrire = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: ecrire }, configurable: true })
    render(<EcranErreur erreur={erreurTest()} dev={false} />)
    expect(screen.queryByLabelText("Détail technique de l'erreur")).toBeNull()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Copier les détails de l'erreur" }))
    })
    expect(ecrire).toHaveBeenCalledTimes(1)
    expect(ecrire.mock.calls[0][0]).toContain('TypeError: x.trim is not a function')
    expect(screen.getByRole('status').textContent).toBe('Détails copiés dans le presse-papiers.')
  })

  it("annonce l'échec de la copie", async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('refus')) }, configurable: true })
    render(<EcranErreur erreur={erreurTest()} dev={false} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Copier les détails de l'erreur" }))
    })
    expect(screen.getByRole('status').textContent).toContain('Copie impossible')
  })

  it("sans API presse-papiers : annonce l'échec", async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    render(<EcranErreur erreur={erreurTest()} dev={false} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Copier les détails de l'erreur" }))
    })
    expect(screen.getByRole('status').textContent).toContain('Copie impossible')
  })
})

describe('PageErreur', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  it("affiche l'erreur de rendu d'une route avec son détail en développement", async () => {
    function Bombe(): never {
      throw erreurTest()
    }
    const routeur = createMemoryRouter([{ path: '/', element: <Bombe />, errorElement: <PageErreur /> }])
    render(<RouterProvider router={routeur} />)
    expect(await screen.findByLabelText("Détail technique de l'erreur")).toBeTruthy()
    expect(screen.getByRole('button', { name: "Copier les détails de l'erreur" })).toBeTruthy()
  })
})
