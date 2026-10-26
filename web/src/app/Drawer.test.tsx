// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Drawer } from './Drawer'
import { MODULES } from './modules'
import { useDeconnexion } from './useDeconnexion'

afterEach(cleanup)

function monter(chemin = '/stats', surcharge: Partial<Parameters<typeof Drawer>[0]> = {}) {
  const props = {
    ouvert: true,
    onNavigation: vi.fn(),
    deconnexion: { avertissement: null as string | null, enCours: false, deconnecter: vi.fn() },
    sombre: { dark: false, setDark: vi.fn() },
    ...surcharge,
  }
  render(
    <MemoryRouter initialEntries={[chemin]}>
      <Drawer {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('Drawer', () => {
  it('est un repère de navigation avec un lien par module et les sous-menus du renforcement', () => {
    monter()
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' })
    for (const { label } of Object.values(MODULES)) {
      expect(nav.textContent).toContain(label)
    }
    expect(screen.getAllByRole('link')).toHaveLength(Object.keys(MODULES).length + 3)
    // Sous-menus toujours visibles, en liste sémantique, même hors du module
    const sousMenus = screen.getByRole('list', { name: 'Renforcement' })
    expect(within(sousMenus).getAllByRole('link').map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Séances types', '/strength'],
      ['Séances programmées', '/strength/planned'],
      ['Séances terminées', '/strength/done'],
    ])
    expect(screen.getByRole('link', { name: MODULES.strength.label }).getAttribute('href')).toBe('/strength')
  })

  it('marque uniquement le lien actif avec aria-current', () => {
    monter('/stats')
    const actifs = screen.getAllByRole('link').filter((l) => l.hasAttribute('aria-current'))
    expect(actifs.map((l) => l.textContent)).toEqual([MODULES.stats.label])
  })

  it.each([
    ['/strength', 'Séances types'],
    ['/strength/planned', 'Séances programmées'],
    ['/strength/done', 'Séances terminées'],
  ])('%s : seul le sous-lien %s est la page courante ; le module est marqué comme section courante', (chemin, sousLien) => {
    monter(chemin)
    const pages = screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current') === 'page')
    expect(pages.map((l) => l.textContent)).toEqual([sousLien])
    expect(screen.getByRole('link', { name: MODULES.strength.label }).getAttribute('aria-current')).toBe('true')
  })

  it('sous-route sans sous-menu (édition) : le module reste marqué, aucun sous-lien courant', () => {
    monter('/strength/new')
    const pages = screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current') === 'page')
    expect(pages).toEqual([])
    expect(screen.getByRole('link', { name: MODULES.strength.label }).getAttribute('aria-current')).toBe('true')
  })

  it("affiche l'avertissement de déconnexion renvoyé par la synchro", () => {
    monter('/', {
      deconnexion: {
        avertissement: '2 modification(s) non synchronisée(s) seraient perdues',
        enCours: false,
        deconnecter: vi.fn(),
      },
    })
    expect(screen.getByRole('alert').textContent).toContain('2 modification(s) non synchronisée(s)')
  })

  it("n'affiche aucune alerte sans avertissement", () => {
    monter()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it("le bouton de déconnexion appelle l'action", () => {
    const props = monter()
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))
    expect(props.deconnexion.deconnecter).toHaveBeenCalledOnce()
  })

  it("le commutateur de mode sombre expose son état et l'inverse au clic", () => {
    const props = monter()
    const bouton = screen.getByRole('button', { name: 'Mode sombre' })
    expect(bouton.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(bouton)
    expect(props.sombre.setDark).toHaveBeenCalledWith(true)
  })

  it('un clic sur un lien notifie la navigation (fermeture du drawer étroit)', () => {
    const props = monter()
    fireEvent.click(screen.getByRole('link', { name: MODULES.calendar.label }))
    expect(props.onNavigation).toHaveBeenCalled()
  })
})

describe('useDeconnexion', () => {
  it("expose le message d'avertissement renvoyé par signOutSafely", async () => {
    const signOutSafely = vi.fn(async () => ({ ok: false, message: 'non synchronisé' }))
    const { result } = renderHook(() => useDeconnexion(signOutSafely))
    await act(async () => {
      await result.current.deconnecter()
    })
    expect(result.current.avertissement).toBe('non synchronisé')
    expect(result.current.enCours).toBe(false)
  })

  it("efface l'avertissement quand la déconnexion réussit", async () => {
    const signOutSafely = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, message: 'non synchronisé' })
      .mockResolvedValueOnce({ ok: true })
    const { result } = renderHook(() => useDeconnexion(signOutSafely))
    await act(async () => {
      await result.current.deconnecter()
    })
    await act(async () => {
      await result.current.deconnecter()
    })
    expect(result.current.avertissement).toBeNull()
  })
})
