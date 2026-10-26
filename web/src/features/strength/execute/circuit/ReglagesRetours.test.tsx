// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLE_REGLAGES } from './reglages'
import { LancementCircuit } from './LancementCircuit'
import { ReglagesRetours } from './ReglagesRetours'

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ReglagesRetours', () => {
  it('trois interrupteurs accessibles aux valeurs par défaut : son et vibration activés, voix désactivée', () => {
    render(<ReglagesRetours />)
    expect(screen.getByRole('group', { name: 'Retours du circuit' })).toBeTruthy()
    expect((screen.getByRole('switch', { name: 'Son' }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('switch', { name: 'Vibration' }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('switch', { name: 'Voix' }) as HTMLInputElement).checked).toBe(false)
  })
  it('chaque changement est mémorisé par appareil', () => {
    render(<ReglagesRetours />)
    fireEvent.click(screen.getByRole('switch', { name: 'Son' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Voix' }))
    expect(JSON.parse(localStorage.getItem(CLE_REGLAGES)!)).toMatchObject({ son: false, voix: true })
  })
  it('le compte à rebours parlé n’est proposé que si la voix est activée', () => {
    render(<ReglagesRetours />)
    const compte = screen.getByRole('switch', { name: 'Compter 3-2-1 à voix haute' }) as HTMLInputElement
    expect(compte.disabled).toBe(true)
    fireEvent.click(screen.getByRole('switch', { name: 'Voix' }))
    expect(compte.disabled).toBe(false)
  })
  it('signale une vibration ou une voix indisponibles sur l’appareil, sans les masquer', () => {
    render(<ReglagesRetours />) // jsdom : ni navigator.vibrate ni speechSynthesis
    expect(screen.getByText(/Vibration indisponible sur cet appareil/)).toBeTruthy()
    expect(screen.getByText(/Voix indisponible sur cet appareil/)).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Vibration' })).toBeTruthy()
    cleanup()
    Object.defineProperty(navigator, 'vibrate', { value: () => true, configurable: true })
    render(<ReglagesRetours />)
    expect(screen.queryByText(/Vibration indisponible/)).toBeNull()
    delete (navigator as unknown as Record<string, unknown>).vibrate
  })
  it('cibles tactiles : chaque ligne porte la classe à 44 px minimum', () => {
    render(<ReglagesRetours />)
    for (const nom of ['Son', 'Vibration', 'Voix']) expect(screen.getByRole('switch', { name: nom }).closest('label')!.className).toContain('interrupteur')
  })
})

describe('dans l’encart de lancement', () => {
  it('les réglages sont accessibles depuis l’encart du circuit et du minuteur', () => {
    const { rerender } = render(<LancementCircuit lancement={{ type: 'circuit', blocId: 'b', reprise: false }} recap="x" erreur={null} onLancer={() => {}} />)
    expect(screen.getByText('Son, vibration, voix')).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Son', hidden: true })).toBeTruthy()
    rerender(<LancementCircuit lancement={{ type: 'seul', exerciceId: 'a' }} recap="" erreur={null} onLancer={() => {}} />)
    expect(screen.getByRole('switch', { name: 'Vibration', hidden: true })).toBeTruthy()
  })
})
