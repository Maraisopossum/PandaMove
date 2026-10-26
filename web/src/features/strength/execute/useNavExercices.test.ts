// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mapBloc, mapExerciceSeance, mapSerie } from '../../../core/db/repos/mappers'
import { defilerVersBadge, useNavExercices } from './useNavExercices'
import { construireVue } from './vue'

afterEach(() => vi.restoreAllMocks())

// Piste factice : 400 px de large, badges de 64 px à partir de x = 100, groupe encadré à x = 90
function piste(): { piste: HTMLElement; scrollTo: ReturnType<typeof vi.fn> } {
  const el = document.createElement('ul')
  el.innerHTML = `<li data-groupe-encadre="true"><ul><li><button data-nav-id="a"></button></li></ul></li>
    <li data-groupe-encadre="false"><ul><li><button data-nav-id="b"></button></li></ul></li>`
  const rect = (left: number, width: number) => ({ left, width, right: left + width, top: 0, bottom: 0, height: 0, x: left, y: 0, toJSON: () => ({}) }) as DOMRect
  el.getBoundingClientRect = () => rect(0, 400)
  const [ga, gb] = Array.from(el.querySelectorAll<HTMLElement>('[data-groupe-encadre]'))
  ga.getBoundingClientRect = () => rect(90, 90)
  gb.getBoundingClientRect = () => rect(600, 64)
  el.querySelector<HTMLElement>('[data-nav-id="a"]')!.getBoundingClientRect = () => rect(100, 64)
  el.querySelector<HTMLElement>('[data-nav-id="b"]')!.getBoundingClientRect = () => rect(600, 64)
  const scrollTo = vi.fn()
  el.scrollTo = scrollTo as unknown as typeof el.scrollTo
  return { piste: el, scrollTo }
}

describe('defilerVersBadge', () => {
  it('groupe encadré : début du groupe au bord gauche moins 16 px, animé', () => {
    const p = piste()
    defilerVersBadge(p.piste, 'a', false)
    expect(p.scrollTo).toHaveBeenCalledWith({ left: 74, behavior: 'smooth' })
  })
  it('badge libre : centré ; prefers-reduced-motion : sans animation', () => {
    const p = piste()
    defilerVersBadge(p.piste, 'b', true)
    expect(p.scrollTo).toHaveBeenCalledWith({ left: 432, behavior: 'auto' })
  })
  it('badge introuvable ou navigateur sans scrollTo : sans effet', () => {
    const p = piste()
    defilerVersBadge(p.piste, 'zzz', false)
    expect(p.scrollTo).not.toHaveBeenCalled()
    const sans = document.createElement('ul')
    expect(() => defilerVersBadge(sans, 'a', false)).not.toThrow()
  })
})

describe('useNavExercices', () => {
  const blocs = [mapBloc({ id: 'b', nom: 'Bloc', position: 0, type: 'AUTRE' })]
  const exos = [
    mapExerciceSeance({ id: 'a', exercise_id: 'x', bloc_id: 'b', position: 0, nombre_series_prevues: 1 }),
    mapExerciceSeance({ id: 'c', exercise_id: 'x', bloc_id: 'b', position: 1, nombre_series_prevues: 1 }),
  ]
  const vue = (series: ReturnType<typeof mapSerie>[]) => construireVue(blocs, exos, series, new Map([['x', 'Squat']]))

  it('actif par défaut = premier non terminé ; choix manuel ; avance après la dernière série', () => {
    const v0 = vue([])
    const r = renderHook(({ v }) => useNavExercices(v.blocs, v.exercices), { initialProps: { v: v0 } })
    expect(r.result.current.idActif).toBe('a')
    act(() => r.result.current.choisir('c'))
    expect(r.result.current.idActif).toBe('c')
    act(() => r.result.current.choisir('a'))
    r.rerender({ v: vue([mapSerie({ is_completed: 1, id: 's1', exercice_seance_id: 'a', numero_serie: 1 })]) })
    expect(r.result.current.idActif).toBe('c')
  })

  it("un choix dont l'exercice a disparu retombe sur le défaut", () => {
    const r = renderHook(({ v }) => useNavExercices(v.blocs, v.exercices), { initialProps: { v: vue([]) } })
    act(() => r.result.current.choisir('c'))
    const sans = construireVue(blocs, [exos[0]], [], new Map())
    r.rerender({ v: sans })
    expect(r.result.current.idActif).toBe('a')
  })
})
