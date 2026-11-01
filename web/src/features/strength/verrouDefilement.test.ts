// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { verrouillerDefilement } from './verrouDefilement'

afterEach(() => {
  document.body.style.overflow = ''
  document.documentElement.style.overscrollBehavior = ''
})

describe('verrouillerDefilement', () => {
  it('bloque le défilement de la page puis restitue la valeur d’origine', () => {
    document.body.style.overflow = 'auto'
    const liberer = verrouillerDefilement()
    expect(document.body.style.overflow).toBe('hidden')
    liberer()
    expect(document.body.style.overflow).toBe('auto')
  })

  it('reste verrouillé tant qu’un dialogue empilé est ouvert (compteur)', () => {
    const premier = verrouillerDefilement()
    const second = verrouillerDefilement()
    premier()
    expect(document.body.style.overflow).toBe('hidden')
    second()
    expect(document.body.style.overflow).toBe('')
  })

  it('libérer deux fois est sans effet', () => {
    const a = verrouillerDefilement()
    const b = verrouillerDefilement()
    a()
    a()
    expect(document.body.style.overflow).toBe('hidden')
    b()
    expect(document.body.style.overflow).toBe('')
  })
})
