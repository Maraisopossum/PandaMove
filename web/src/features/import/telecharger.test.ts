// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { copierTexte, telechargerTexte } from './telecharger'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('telechargerTexte', () => {
  it('crée un lien de téléchargement nommé, le clique puis libère l\'URL', () => {
    vi.useFakeTimers()
    const creer = vi.fn(() => 'blob:x')
    const liberer = vi.fn()
    Object.assign(URL, { createObjectURL: creer, revokeObjectURL: liberer })
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('consigne.md')
      expect(this.href).toBe('blob:x')
    })
    expect(telechargerTexte('consigne.md', '# Titre', 'text/markdown')).toBe(true)
    expect(clic).toHaveBeenCalledTimes(1)
    expect(document.querySelector('a[download]')).toBeNull()
    vi.advanceTimersByTime(5000)
    expect(liberer).toHaveBeenCalledWith('blob:x')
  })

  it('renvoie false si le navigateur refuse', () => {
    Object.assign(URL, { createObjectURL: () => { throw new Error('non') } })
    expect(telechargerTexte('a.md', 'x', 'text/markdown')).toBe(false)
  })
})

describe('copierTexte', () => {
  it('copie via le presse-papiers', async () => {
    const ecrire = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: ecrire }, configurable: true })
    expect(await copierTexte('abc')).toBe(true)
    expect(ecrire).toHaveBeenCalledWith('abc')
  })

  it('false si l\'API est absente ou refusée', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    expect(await copierTexte('abc')).toBe(false)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('refusé')) }, configurable: true })
    expect(await copierTexte('abc')).toBe(false)
  })
})
