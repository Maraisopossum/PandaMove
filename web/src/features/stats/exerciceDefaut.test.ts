// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CLE_EXERCICE_DEFAUT, ecrireExerciceDefaut, lireExerciceDefaut } from './exerciceDefaut'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('exercice affiché en premier', () => {
  it('écrit, relit et retire le réglage', () => {
    expect(lireExerciceDefaut()).toBeNull()
    ecrireExerciceDefaut('ex-sq')
    expect(localStorage.getItem(CLE_EXERCICE_DEFAUT)).toBe('ex-sq')
    expect(lireExerciceDefaut()).toBe('ex-sq')
    ecrireExerciceDefaut(null)
    expect(lireExerciceDefaut()).toBeNull()
  })

  it('stockage indisponible : lecture nulle, écriture sans erreur', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqué')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqué')
    })
    expect(lireExerciceDefaut()).toBeNull()
    expect(() => ecrireExerciceDefaut('ex')).not.toThrow()
  })
})
