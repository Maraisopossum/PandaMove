// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { lireSeances } from '../../core/db/repos/respiration'
import type { Db } from '../../core/db/Db'
import { createTestDb } from '../../test/sqliteDb'
import type { AudioRespiration } from './audio'
import { trouverIntegree, type Methode } from './methodes'
import { useSessionRespiration } from './useSessionRespiration'

const COHERENCE = trouverIntegree('coherence_cardiaque') as Methode // 5 s / 5 s
let db: Db
let audio: { tic: Mock<() => void>; demarrerTon: Mock<AudioRespiration['demarrerTon']>; arreterTon: Mock<() => void>; liberer: Mock<() => void> }

beforeEach(() => {
  vi.useFakeTimers()
  db = createTestDb()
  audio = { tic: vi.fn(), demarrerTon: vi.fn(), arreterTon: vi.fn(), liberer: vi.fn() }
})
afterEach(() => vi.useRealTimers())

const session = (cycles = 2) =>
  renderHook(() => useSessionRespiration(COHERENCE, cycles, { db, audio, maintenant: () => Date.now(), aujourdhui: () => '2026-11-04' }))

// Par pas de 100 ms, chacun dans son act : React applique les rendus (et relance les minuteries) entre deux pas, comme en vrai
const avancer = async (ms: number) => {
  for (let ecoule = 0; ecoule < ms; ecoule += 100) await act(() => vi.advanceTimersByTimeAsync(100))
}

describe('useSessionRespiration', () => {
  it('compte 5 s avec un bip par seconde, puis démarre sur l’inspiration', async () => {
    const { result } = session()
    expect(result.current).toMatchObject({ statut: 'decompte', decompte: 5, etat: null })
    expect(audio.tic).toHaveBeenCalledTimes(1)
    await avancer(1000)
    expect(result.current.decompte).toBe(4)
    await avancer(3000)
    expect(result.current.decompte).toBe(1)
    expect(audio.tic).toHaveBeenCalledTimes(5)
    await avancer(1000)
    expect(result.current.statut).toBe('en_cours')
    expect(result.current.etat).toMatchObject({ phase: 'inspire', cycle: 1, cyclesTotal: 2 })
    expect(audio.demarrerTon).toHaveBeenLastCalledWith('inspire', 5000)
  })

  it('change de phase et relance le son à chaque phase', async () => {
    const { result } = session()
    await avancer(5000 + 5000)
    expect(result.current.etat).toMatchObject({ phase: 'expire', cycle: 1 })
    expect(audio.demarrerTon).toHaveBeenLastCalledWith('expire', 5000)
    await avancer(5000)
    expect(result.current.etat).toMatchObject({ phase: 'inspire', cycle: 2 })
  })

  it('met en pause (son coupé, temps gelé) puis reprend sur le temps restant de la phase', async () => {
    const { result } = session()
    await avancer(5000 + 2000)
    act(() => result.current.pause())
    expect(result.current.statut).toBe('pause')
    expect(audio.arreterTon).toHaveBeenCalled()
    await avancer(60_000)
    expect(result.current.etat).toMatchObject({ phase: 'inspire', cycle: 1 })
    act(() => result.current.reprendre())
    expect(result.current.statut).toBe('en_cours')
    expect(audio.demarrerTon).toHaveBeenLastCalledWith('inspire', 3000)
    await avancer(3000)
    expect(result.current.etat).toMatchObject({ phase: 'expire' })
  })

  it('termine et enregistre la séance une seule fois', async () => {
    const { result } = session(2)
    await avancer(5000 + 20_000 + 500)
    expect(result.current.statut).toBe('termine')
    expect(result.current.dureeSec).toBe(20)
    expect(result.current.erreurEnregistrement).toBeNull()
    await avancer(5000)
    const seances = await lireSeances(db, 10)
    expect(seances).toHaveLength(1)
    expect(seances[0]).toMatchObject({ methodeId: 'coherence_cardiaque', methodeNom: 'Cohérence cardiaque', cycles: 2, dureeSec: 20, date: '2026-11-04' })
  })

  it('n’enregistre rien quand on quitte avant la fin', async () => {
    const { result, unmount } = session(2)
    await avancer(5000 + 8000)
    expect(result.current.statut).toBe('en_cours')
    unmount()
    expect(audio.liberer).toHaveBeenCalled()
    await avancer(60_000)
    expect(await lireSeances(db, 10)).toEqual([])
  })

  it('signale un échec d’enregistrement sans bloquer l’écran de fin', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const casse = { ...db, execute: () => Promise.reject(new Error('disque plein')) } as Db
    const { result } = renderHook(() =>
      useSessionRespiration(COHERENCE, 1, { db: casse, audio, maintenant: () => Date.now(), aujourdhui: () => '2026-11-04' }),
    )
    await avancer(5000 + 10_500)
    expect(result.current.statut).toBe('termine')
    expect(result.current.erreurEnregistrement).toMatch(/pas pu être enregistrée/)
  })
})
