// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AlerteRejetEnvoiVue } from './AlerteRejetEnvoi'
import { messageRejet, rejetsEnvoi, useRejetEnvoi } from './rejetsEnvoi'

const REJET = { table: 'blocs_seance', operation: 'PUT', code: '23505', dateMs: 1 }

afterEach(() => {
  cleanup()
  rejetsEnvoi.effacer()
})

describe('rejetsEnvoi (store)', () => {
  it('garde le dernier rejet et prévient les abonnés ; effacer remet à null', () => {
    const abonne = vi.fn()
    const desabonner = rejetsEnvoi.abonner(abonne)
    rejetsEnvoi.signaler(REJET)
    expect(rejetsEnvoi.dernier()).toEqual(REJET)
    rejetsEnvoi.effacer()
    expect(rejetsEnvoi.dernier()).toBeNull()
    expect(abonne).toHaveBeenCalledTimes(2)
    desabonner()
    rejetsEnvoi.signaler(REJET)
    expect(abonne).toHaveBeenCalledTimes(2)
  })

  it('message français avec le code', () => {
    expect(messageRejet(REJET)).toBe("Une modification n'a pas pu être envoyée au serveur (code 23505).")
  })
})

describe('useRejetEnvoi', () => {
  it('suit le store et masque le message', () => {
    const { result } = renderHook(() => useRejetEnvoi())
    expect(result.current.message).toBeNull()
    act(() => rejetsEnvoi.signaler(REJET))
    expect(result.current.message).toBe("Une modification n'a pas pu être envoyée au serveur (code 23505).")
    act(() => result.current.masquer())
    expect(result.current.message).toBeNull()
    expect(rejetsEnvoi.dernier()).toBeNull()
  })
})

describe('AlerteRejetEnvoiVue', () => {
  it('rien sans message', () => {
    const { container } = render(<AlerteRejetEnvoiVue message={null} onMasquer={() => {}} />)
    expect(container.innerHTML).toBe('')
  })

  it('affiche une alerte et un bouton « Masquer »', () => {
    const masquer = vi.fn()
    render(<AlerteRejetEnvoiVue message="Une modification n'a pas pu être envoyée au serveur (code 42501)." onMasquer={masquer} />)
    expect(screen.getByRole('alert').textContent).toContain('code 42501')
    fireEvent.click(screen.getByRole('button', { name: "Masquer l'alerte d'envoi" }))
    expect(masquer).toHaveBeenCalledTimes(1)
  })
})
