// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mapBloc, mapExerciceSeance } from '../../../../core/db/repos/mappers'
import { construireVue, type ExerciceVue } from '../vue'
import type { Sonneur } from './audio'
import type { Bip } from './bips'
import { useCircuit, type EntreesCircuit } from './useCircuit'

interface Exo { id: string; bloc?: string; series?: number; cibles?: string }

function exercices(exos: Exo[], inter = 5, fin = 8): ExerciceVue[] {
  const bs = [mapBloc({ id: 'b', nom: 'Circuit', position: 0, type: 'CIRCUIT', temps_repos_inter_sec: inter, temps_repos_fin_round_sec: fin })]
  const es = exos.map((e, i) =>
    mapExerciceSeance({
      id: e.id, exercise_id: e.id, bloc_id: e.bloc ?? 'b', position: i, nombre_series_prevues: e.series ?? 1,
      reps_cibles: e.cibles ?? '10', reps_type: 'DURATION', temps_repos_sec: 60,
    }),
  )
  return construireVue(bs, es, [], new Map(exos.map((e) => [e.id, 'Nom ' + e.id]))).exercices
}

let t = 0
const nowFn = () => t
type Valider = EntreesCircuit['valider']
const sonneur = () => ({ preparer: vi.fn(), jouer: vi.fn<(bip: Bip) => void>(), fermer: vi.fn() }) satisfies Sonneur

function monter(exos: Exo[], o: { valider?: ReturnType<typeof vi.fn<Valider>>; son?: ReturnType<typeof sonneur>; inter?: number; fin?: number; brouillons?: Record<string, { reps: number }> } = {}) {
  const valider = o.valider ?? vi.fn<Valider>(async () => true)
  const son = o.son ?? sonneur()
  const oublier = vi.fn()
  const demarrerSeance = vi.fn(async () => true)
  const surExercice = vi.fn()
  const entrees = {
    exercices: exercices(exos, o.inter, o.fin), precedentes: new Map(), brouillons: o.brouillons ?? {}, valider, oublierBrouillon: oublier, demarrerSeance, surExercice,
  }
  const r = renderHook(() => useCircuit(entrees, { nowFn, tickMs: 250, sonneur: son }))
  return { ...r, valider, son, oublier, demarrerSeance, surExercice }
}

// Avance l'horloge fausse ET les minuteries de `ms`, par pas de 250 ms comme le vrai intervalle
async function passer(ms: number) {
  for (let i = 0; i < ms / 250; i++) {
    t += 250
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250)
    })
  }
}

beforeEach(() => {
  t = 1_000_000
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete (navigator as unknown as Record<string, unknown>).wakeLock
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
})

describe('useCircuit', () => {
  it('lance le circuit : décompte, auto-validation de chaque série via la validation manuelle, fin annoncée', async () => {
    const h = monter([{ id: 'a' }, { id: 'c' }])
    expect(h.result.current.affichage).toBeNull()
    act(() => h.result.current.lancer({ type: 'circuit', blocId: 'b' }))
    expect(h.result.current.affichage).toMatchObject({ phase: 'decompte', restantSec: 3, nomExercice: 'Nom a' })
    expect(h.son.preparer).toHaveBeenCalled()
    expect(h.demarrerSeance).toHaveBeenCalled()
    expect(h.surExercice).toHaveBeenCalledWith('a')
    await passer(3000)
    expect(h.result.current.affichage).toMatchObject({ phase: 'actif', restantSec: 10 })
    await passer(10_000)
    expect(h.valider).toHaveBeenCalledTimes(1)
    expect(h.valider).toHaveBeenLastCalledWith('a', { reps: 10, chargeKg: null, rpe: null }, 1, '')
    expect(h.oublier).toHaveBeenCalledWith('a', 1)
    expect(h.result.current.affichage).toMatchObject({ phase: 'repos', repos: { nature: 'inter', prochain: 'Nom c' } })
    await passer(5000 + 10_000)
    expect(h.valider).toHaveBeenCalledTimes(2)
    expect(h.valider).toHaveBeenLastCalledWith('c', { reps: 10, chargeKg: null, rpe: null }, 1, '')
    expect(h.surExercice).toHaveBeenCalledWith('c')
    expect(h.result.current.affichage).toBeNull()
    expect(h.result.current.message).toBe('Circuit terminé : toutes les séries sont enregistrées.')
  })

  it('refuse une durée invalide avec un message, sans rien démarrer', () => {
    const h = monter([{ id: 'a' }], { brouillons: { 'a#1': { reps: 0 } } })
    const r = h
    act(() => r.result.current.lancer({ type: 'seul', exerciceId: 'a' }))
    expect(r.result.current.erreur).toBe('Durée invalide : saisissez un nombre de secondes supérieur à 0.')
    expect(r.result.current.affichage).toBeNull()
    expect(h.demarrerSeance).not.toHaveBeenCalled()
  })

  it('arrêt manuel : plus aucune validation ensuite, ce qui est validé est conservé', async () => {
    const h = monter([{ id: 'a' }, { id: 'c' }])
    act(() => h.result.current.lancer({ type: 'circuit', blocId: 'b' }))
    await passer(13_000)
    expect(h.valider).toHaveBeenCalledTimes(1)
    act(() => h.result.current.arreter())
    expect(h.result.current.affichage).toBeNull()
    expect(h.result.current.message).toBe('Circuit arrêté : les séries déjà validées sont conservées.')
    await passer(60_000)
    expect(h.valider).toHaveBeenCalledTimes(1)
  })

  it('onglet en arrière-plan : au retour de visibilité, tout est rattrapé depuis les horodatages', async () => {
    const h = monter([{ id: 'a' }, { id: 'c' }])
    act(() => h.result.current.lancer({ type: 'circuit', blocId: 'b' }))
    // 30 s passent sans aucun tick (onglet suspendu)
    t += 30_000
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(h.valider.mock.calls.map((c) => [c[0], c[2]])).toEqual([['a', 1], ['c', 1]])
    expect(h.result.current.affichage).toBeNull()
  })

  it('chaque série est validée une seule fois, même avec des ticks très rapprochés', async () => {
    const h = monter([{ id: 'a' }], { })
    act(() => h.result.current.lancer({ type: 'seul', exerciceId: 'a' }))
    t += 20_000
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(h.valider).toHaveBeenCalledTimes(1)
    expect(h.result.current.message).toBe('Minuteur terminé : série enregistrée.')
  })

  it('une validation refusée arrête le circuit et le dit', async () => {
    const valider = vi.fn<Valider>(async () => false)
    const h = monter([{ id: 'a' }, { id: 'c' }], { valider })
    act(() => h.result.current.lancer({ type: 'circuit', blocId: 'b' }))
    await passer(13_000)
    expect(h.result.current.affichage).toBeNull()
    expect(h.result.current.message).toBe("Circuit interrompu : la série n'a pas pu être enregistrée.")
    await passer(30_000)
    expect(valider).toHaveBeenCalledTimes(1)
  })

  it('bips : départ, compte à rebours des 5 dernières secondes, fin ; aucun rejoué après une longue suspension', async () => {
    const son = sonneur()
    const h = monter([{ id: 'a', cibles: '8' }], { son })
    act(() => h.result.current.lancer({ type: 'seul', exerciceId: 'a' }))
    await passer(3000)
    expect(son.jouer.mock.calls.map((c) => c[0])).toEqual(['depart'])
    await passer(8000)
    expect(son.jouer.mock.calls.map((c) => c[0])).toEqual(['depart', 'compte', 'compte', 'compte', 'compte', 'compte', 'fin'])
    // suspension : fin de l'exercice pendant que l'onglet dort => pas de bip rejoué
    son.jouer.mockClear()
    const h2 = monter([{ id: 'a', cibles: '8' }], { son })
    act(() => h2.result.current.lancer({ type: 'seul', exerciceId: 'a' }))
    son.jouer.mockClear()
    t += 60_000
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(son.jouer).not.toHaveBeenCalled()
  })

  it('garde l’écran allumé pendant le circuit seulement', async () => {
    const release = vi.fn(async () => {})
    const request = vi.fn(async () => ({ release }))
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })
    const h = monter([{ id: 'a', cibles: '5' }])
    expect(request).not.toHaveBeenCalled()
    act(() => h.result.current.lancer({ type: 'seul', exerciceId: 'a' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(request).toHaveBeenCalledWith('screen')
    await passer(9000)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(release).toHaveBeenCalled()
  })

  it('démontage : plus aucune écriture ni minuterie', async () => {
    const h = monter([{ id: 'a', cibles: '5' }])
    act(() => h.result.current.lancer({ type: 'seul', exerciceId: 'a' }))
    h.unmount()
    t += 30_000
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(h.valider).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('un second lancement pendant un circuit est ignoré', () => {
    const h = monter([{ id: 'a' }])
    act(() => h.result.current.lancer({ type: 'circuit', blocId: 'b' }))
    act(() => h.result.current.lancer({ type: 'circuit', blocId: 'b' }))
    expect(h.demarrerSeance).toHaveBeenCalledTimes(1)
  })
})
