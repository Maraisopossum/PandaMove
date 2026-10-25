// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppuiLong } from './useAppuiLong'
import { useSelection } from './useSelection'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useSelection (sélection multiple façon Android)', () => {
  it('démarre hors mode sélection', () => {
    const { result } = renderHook(() => useSelection())
    expect(result.current.mode).toBe(false)
    expect(result.current.nombre).toBe(0)
  })

  it('« entrer » sans élément ouvre le mode (bouton Sélectionner), avec un élément le sélectionne (appui long)', () => {
    const { result } = renderHook(() => useSelection())
    act(() => result.current.entrer())
    expect(result.current.mode).toBe(true)
    expect(result.current.nombre).toBe(0)
    act(() => result.current.quitter())
    act(() => result.current.entrer('a'))
    expect(result.current.mode).toBe(true)
    expect(result.current.estSelectionne('a')).toBe(true)
  })

  it('« basculer » ajoute puis retire ; retirer le dernier élément quitte le mode (comme l’Android)', () => {
    const { result } = renderHook(() => useSelection())
    act(() => result.current.entrer())
    act(() => result.current.basculer('a'))
    act(() => result.current.basculer('b'))
    expect(result.current.nombre).toBe(2)
    act(() => result.current.basculer('a'))
    expect(result.current.estSelectionne('a')).toBe(false)
    expect(result.current.mode).toBe(true)
    act(() => result.current.basculer('b'))
    expect(result.current.mode).toBe(false)
  })

  it('« quitter » vide tout', () => {
    const { result } = renderHook(() => useSelection())
    act(() => result.current.entrer('a'))
    act(() => result.current.quitter())
    expect(result.current.mode).toBe(false)
    expect(result.current.nombre).toBe(0)
    expect(result.current.identifiants).toEqual([])
  })

  it('identifiants : liste des éléments choisis', () => {
    const { result } = renderHook(() => useSelection())
    act(() => result.current.entrer('a'))
    act(() => result.current.basculer('b'))
    expect([...result.current.identifiants].sort()).toEqual(['a', 'b'])
  })
})

describe('useAppuiLong', () => {
  beforeEach(() => vi.useFakeTimers())

  function Carte({ surAppuiLong, surClic }: { surAppuiLong: () => void; surClic: () => void }) {
    const appui = useAppuiLong(surAppuiLong)
    return (
      <button type="button" {...appui} onClick={surClic}>
        carte
      </button>
    )
  }

  it('un appui prolongé déclenche l’action une fois et n’émet pas de clic', () => {
    const appuiLong = vi.fn()
    const clic = vi.fn()
    render(<Carte surAppuiLong={appuiLong} surClic={clic} />)
    const b = screen.getByRole('button', { name: 'carte' })
    fireEvent.pointerDown(b, { clientX: 5, clientY: 5 })
    act(() => void vi.advanceTimersByTime(600))
    expect(appuiLong).toHaveBeenCalledTimes(1)
    fireEvent.pointerUp(b)
    fireEvent.click(b)
    expect(clic).not.toHaveBeenCalled()
  })

  it('un appui court laisse passer le clic', () => {
    const appuiLong = vi.fn()
    const clic = vi.fn()
    render(<Carte surAppuiLong={appuiLong} surClic={clic} />)
    const b = screen.getByRole('button', { name: 'carte' })
    fireEvent.pointerDown(b, { clientX: 5, clientY: 5 })
    act(() => void vi.advanceTimersByTime(100))
    fireEvent.pointerUp(b)
    act(() => void vi.advanceTimersByTime(600))
    fireEvent.click(b)
    expect(appuiLong).not.toHaveBeenCalled()
    expect(clic).toHaveBeenCalledTimes(1)
  })

  it('un déplacement du doigt (défilement) annule l’appui long', () => {
    const appuiLong = vi.fn()
    render(<Carte surAppuiLong={appuiLong} surClic={() => {}} />)
    const b = screen.getByRole('button', { name: 'carte' })
    fireEvent.pointerDown(b, { clientX: 5, clientY: 5 })
    fireEvent.pointerMove(b, { clientX: 5, clientY: 60 })
    act(() => void vi.advanceTimersByTime(600))
    expect(appuiLong).not.toHaveBeenCalled()
  })

  it('le clic suivant un appui long ne reste pas bloqué pour les appuis suivants', () => {
    const clic = vi.fn()
    render(<Carte surAppuiLong={() => {}} surClic={clic} />)
    const b = screen.getByRole('button', { name: 'carte' })
    fireEvent.pointerDown(b, { clientX: 5, clientY: 5 })
    act(() => void vi.advanceTimersByTime(600))
    fireEvent.pointerUp(b)
    fireEvent.click(b)
    fireEvent.pointerDown(b, { clientX: 5, clientY: 5 })
    fireEvent.pointerUp(b)
    fireEvent.click(b)
    expect(clic).toHaveBeenCalledTimes(1)
  })
})
