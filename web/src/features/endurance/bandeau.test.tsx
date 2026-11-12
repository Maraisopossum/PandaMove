// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BandeauSortie } from './BandeauSortie'
import { MiniTrace } from './MiniTrace'

afterEach(cleanup)

const trace = JSON.stringify([[50.1, 3.0], [50.12, 3.02], [50.11, 3.05], [50.1, 3.0]])
const serie = JSON.stringify([{ t: 0, fc: null, w: 90, v: 3, a: 20, c: 70 }, { t: 10, fc: null, w: 120, v: 4, a: 21, c: 72 }])

describe('BandeauSortie', () => {
  it('avec un tracé : bandeau cartographique, titre et date en surimpression', () => {
    const { container } = render(<BandeauSortie sortie={{ trace, titre: 'Course', date: '2026-11-05', enSalle: false }} />)
    expect(screen.getByRole('img', { name: 'Tracé du parcours' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Course')
    expect(container.querySelector('.sorties__bandeau-ligne')).toBeTruthy()
  })

  it('sans tracé (salle ou saisie manuelle) : simple en-tête, « en salle » dans la date', () => {
    render(<BandeauSortie sortie={{ trace: null, titre: 'Sortie vélo en salle', date: '2026-11-07', enSalle: true }} />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText(/· en salle/)).toBeTruthy()
  })
})

describe('MiniTrace', () => {
  it('dessine le tracé, sinon la courbe de puissance, sinon un picto', () => {
    const a = render(<MiniTrace sortie={{ trace, serie: null, sport: 'course' }} />)
    expect(a.container.querySelector('circle')).toBeTruthy()
    a.unmount()
    const b = render(<MiniTrace sortie={{ trace: null, serie, sport: 'velo' }} />)
    expect(b.container.querySelector('polyline')).toBeTruthy()
    b.unmount()
    const c = render(<MiniTrace sortie={{ trace: null, serie: null, sport: 'velo' }} />)
    expect(c.container.querySelector('path')).toBeTruthy()
  })
})
