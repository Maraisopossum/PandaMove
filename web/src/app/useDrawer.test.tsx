// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDrawer } from './useDrawer'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function Harnais() {
  const { ouvert, basculer, refBascule, refDrawer } = useDrawer()
  return (
    <>
      <nav ref={refDrawer}>
        <a href="/premier">Premier</a>
        <a href="/second">Second</a>
      </nav>
      <button ref={refBascule} onClick={basculer} aria-expanded={ouvert}>
        Menu
      </button>
    </>
  )
}

const stubLarge = (large: boolean) => vi.stubGlobal('matchMedia', () => ({ matches: large }))

describe('useDrawer : focus (mode étroit)', () => {
  it("l'ouverture place le focus sur le premier lien", () => {
    stubLarge(false)
    render(<Harnais />)
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Premier' }))
  })

  it('Échap ferme le drawer et rend le focus au bouton', () => {
    stubLarge(false)
    render(<Harnais />)
    const bouton = screen.getByRole('button', { name: 'Menu' })
    fireEvent.click(bouton)
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(bouton.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(bouton)
  })

  it('une autre touche ne ferme pas le drawer', () => {
    stubLarge(false)
    render(<Harnais />)
    const bouton = screen.getByRole('button', { name: 'Menu' })
    fireEvent.click(bouton)
    fireEvent.keyDown(document, { key: 'a' })
    expect(bouton.getAttribute('aria-expanded')).toBe('true')
  })

  it('ne vole pas le focus au montage', () => {
    stubLarge(false)
    render(<Harnais />)
    expect(document.activeElement).toBe(document.body)
  })
})

describe('useDrawer : mode large (drawer permanent)', () => {
  it("l'ouverture et la fermeture ne déplacent pas le focus", () => {
    stubLarge(true)
    render(<Harnais />)
    const bouton = screen.getByRole('button', { name: 'Menu' })
    bouton.focus()
    fireEvent.click(bouton)
    expect(document.activeElement).toBe(bouton)
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(document.activeElement).toBe(bouton)
  })
})
