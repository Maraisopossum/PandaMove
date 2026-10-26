// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLE_REGLAGES, DEFAUTS, analyserReglages, ecrireReglages, lireReglages, type Stockage } from './reglages'
import { useReglagesCircuit } from './useReglagesCircuit'

const faux = (contenu: Record<string, string> = {}): Stockage & { contenu: Record<string, string> } => ({
  contenu,
  getItem: (k) => contenu[k] ?? null,
  setItem: (k, v) => {
    contenu[k] = v
  },
})

describe('réglages du circuit (pur)', () => {
  it('valeurs par défaut : son et vibration activés, voix et compte à rebours parlé désactivés', () => {
    expect(DEFAUTS).toEqual({ son: true, vibration: true, voix: false, voixCompte: false })
    expect(CLE_REGLAGES).toBe('pandamove.circuit.reglages')
  })
  it('analyse tolérante : null, JSON invalide, mauvais types => valeur par défaut champ par champ', () => {
    expect(analyserReglages(null)).toEqual(DEFAUTS)
    expect(analyserReglages('{pas du json')).toEqual(DEFAUTS)
    expect(analyserReglages('[1,2]')).toEqual(DEFAUTS)
    expect(analyserReglages('{"son":false,"vibration":"oui","voix":true}')).toEqual({ son: false, vibration: true, voix: true, voixCompte: false })
  })
  it('lire / écrire passent par le stockage injecté et survivent à un stockage qui échoue', () => {
    const s = faux()
    ecrireReglages({ son: false, vibration: true, voix: true, voixCompte: true }, s)
    expect(JSON.parse(s.contenu[CLE_REGLAGES])).toEqual({ son: false, vibration: true, voix: true, voixCompte: true })
    expect(lireReglages(s)).toEqual({ son: false, vibration: true, voix: true, voixCompte: true })
    const casse: Stockage = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceeded')
      },
    }
    expect(lireReglages(casse)).toEqual(DEFAUTS)
    expect(() => ecrireReglages(DEFAUTS, casse)).not.toThrow()
    expect(lireReglages(null)).toEqual(DEFAUTS)
  })
})

describe('useReglagesCircuit', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('démarre sur les réglages mémorisés et mémorise chaque changement', () => {
    localStorage.setItem(CLE_REGLAGES, JSON.stringify({ son: false }))
    const { result } = renderHook(() => useReglagesCircuit())
    expect(result.current.reglages).toEqual({ ...DEFAUTS, son: false })
    act(() => result.current.changer('voix', true))
    expect(result.current.reglages.voix).toBe(true)
    expect(JSON.parse(localStorage.getItem(CLE_REGLAGES)!)).toMatchObject({ son: false, voix: true })
  })
  it('deux instances (encart et Profil) restent synchronisées', () => {
    const a = renderHook(() => useReglagesCircuit())
    const b = renderHook(() => useReglagesCircuit())
    act(() => a.result.current.changer('vibration', false))
    expect(b.result.current.reglages.vibration).toBe(false)
  })
  it('fonctionne en mémoire si le stockage est inaccessible', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqué')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqué')
    })
    const { result } = renderHook(() => useReglagesCircuit())
    expect(result.current.reglages).toEqual(DEFAUTS)
    act(() => result.current.changer('son', false))
    expect(result.current.reglages.son).toBe(false)
    vi.restoreAllMocks()
  })
})
